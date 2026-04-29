"""Prometheus exporter — turns the SQLite cache into scrapable metrics.

This is the read-only observability spine for the SanMar integration:
the orchestrator writes :class:`SyncState`, :class:`OrderRow`, and
:class:`InventorySnapshot` rows during normal operation, and the
exporter recomputes seven Prometheus metrics on every scrape by
querying that same SQLite file. No background process, no extra
state — Prometheus pulls when it wants and pays the query cost.

Why a custom Collector vs. the default registry?
------------------------------------------------
The metrics here are *snapshot* metrics derived from a database, not
events tracked in-process. If we used the default global registry +
push-style Counter/Gauge, every exporter restart would zero them out
and the cumulative counters would lie. By implementing
:class:`prometheus_client.registry.Collector.collect` we recompute
from the source of truth on each scrape, so the exporter is fully
stateless and can crash/restart freely.

Empty-table case is handled explicitly — a fresh DB returns zero for
every counter/gauge and an empty histogram, so Prometheus never sees
NaN or a missing series on day zero.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable, Iterator, Optional

from prometheus_client.core import (
    CounterMetricFamily,
    GaugeMetricFamily,
    HistogramMetricFamily,
    Metric,
)
from prometheus_client.registry import Collector
from sqlalchemy import func, select
from sqlalchemy.engine import Engine

from sanmar.config import Settings, get_settings
from sanmar.db import init_schema, make_engine, session_scope
from sanmar.models import InventorySnapshot, OrderRow, SyncState

# Histogram buckets in seconds. SanMar SOAP calls are single-digit
# seconds in steady state but spike to tens of seconds on bulk
# inventory; the 0.5 → 600s ladder catches both fast and pathological
# runs without blowing up the cardinality.
_DURATION_BUCKETS_SECONDS: tuple[float, ...] = (
    0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0,
)

# How many recent SyncState rows feed the duration histogram. 100 is
# enough to cover ~3 days of every-15-min syncs without dragging the
# scrape latency above ~50ms on a million-row DB.
_RECENT_SYNCS_LIMIT: int = 100


def _bucket_durations(durations: list[float]) -> tuple[list[tuple[str, float]], float]:
    """Bucketize a list of durations into Prometheus cumulative buckets.

    Returns ``(buckets, sum)`` where ``buckets`` is a list of
    ``(le_label, cumulative_count)`` tuples ending in the ``+Inf``
    bucket, matching the contract of
    :class:`HistogramMetricFamily.add_metric`.
    """
    buckets: list[tuple[str, float]] = []
    cumulative = 0
    for upper in _DURATION_BUCKETS_SECONDS:
        cumulative += sum(1 for d in durations if d <= upper)
        buckets.append((str(upper), float(cumulative)))
    # +Inf bucket holds *every* observation.
    buckets.append(("+Inf", float(len(durations))))
    return buckets, float(sum(durations))


class SanmarMetricsCollector(Collector):
    """Custom Prometheus collector reading from the SQLite cache.

    Construction is cheap — the engine is built once, tables are
    ensured, and every scrape opens a short-lived session via
    :func:`sanmar.db.session_scope`. Tests pass an in-memory engine
    via the ``engine`` kwarg so they don't touch the real DB.
    """

    def __init__(
        self,
        settings: Optional[Settings] = None,
        *,
        engine: Optional[Engine] = None,
    ) -> None:
        self._settings = settings or get_settings()
        if engine is not None:
            self._engine = engine
        else:
            self._engine = make_engine(self._settings.db_path)
            init_schema(self._engine)

    # ── public API ─────────────────────────────────────────────────────

    def collect(self) -> Iterator[Metric]:
        """Yield the seven SanMar metrics on every scrape.

        Order is stable — Prometheus doesn't require it, but stable
        order makes the exposition output diff-friendly for the
        tests in :mod:`tests.test_exporter`.
        """
        with session_scope(self._engine) as session:
            yield from self._collect_sync_duration(session)
            yield self._collect_sync_errors(session)
            yield self._collect_sync_success(session)
            yield self._collect_orders_open(session)
            yield self._collect_orders_by_status(session)
            yield self._collect_inventory_snapshots_24h(session)
            yield self._collect_last_sync_timestamp(session)

    # ── individual metric builders ─────────────────────────────────────

    def _collect_sync_duration(self, session) -> Iterable[Metric]:
        """Histogram of recent sync durations, labeled by type + outcome.

        We bucket the most recent :data:`_RECENT_SYNCS_LIMIT` finished
        rows per (sync_type, outcome) pair rather than streaming the
        whole table — keeps scrape latency bounded.
        """
        family = HistogramMetricFamily(
            "sanmar_sync_duration_seconds",
            "Wall-clock duration of recent SanMar sync runs.",
            labels=["sync_type", "outcome"],
        )

        rows = (
            session.execute(
                select(SyncState)
                .where(SyncState.finished_at.is_not(None))
                .order_by(SyncState.finished_at.desc())
                .limit(_RECENT_SYNCS_LIMIT)
            )
            .scalars()
            .all()
        )

        # Group durations by (sync_type, outcome). outcome == "success"
        # iff error_count == 0; "error" otherwise. Mixing both into one
        # series would make the dashboard p95 useless.
        grouped: dict[tuple[str, str], list[float]] = {}
        for row in rows:
            assert row.finished_at is not None  # filter above guarantees this
            duration = (row.finished_at - row.started_at).total_seconds()
            outcome = "error" if row.error_count > 0 else "success"
            grouped.setdefault((row.sync_type, outcome), []).append(duration)

        for (sync_type, outcome), durations in grouped.items():
            buckets, total = _bucket_durations(durations)
            family.add_metric(
                labels=[sync_type, outcome],
                buckets=buckets,
                sum_value=total,
            )

        yield family

    def _collect_sync_errors(self, session) -> Metric:
        """Counter — total error rows by sync_type.

        ``error_count`` is summed (not row-counted) because a single
        sync can encounter many errors before completing.
        """
        family = CounterMetricFamily(
            "sanmar_sync_errors_total",
            "Total error count across all SanMar sync runs, by type.",
            labels=["sync_type"],
        )
        rows = session.execute(
            select(SyncState.sync_type, func.coalesce(func.sum(SyncState.error_count), 0))
            .group_by(SyncState.sync_type)
        ).all()
        for sync_type, total in rows:
            family.add_metric([sync_type], float(total or 0))
        return family

    def _collect_sync_success(self, session) -> Metric:
        """Counter — total successful items processed, by sync_type."""
        family = CounterMetricFamily(
            "sanmar_sync_success_total",
            "Total success count across all SanMar sync runs, by type.",
            labels=["sync_type"],
        )
        rows = session.execute(
            select(SyncState.sync_type, func.coalesce(func.sum(SyncState.success_count), 0))
            .group_by(SyncState.sync_type)
        ).all()
        for sync_type, total in rows:
            family.add_metric([sync_type], float(total or 0))
        return family

    def _collect_orders_open(self, session) -> Metric:
        """Gauge — current count of OrderRow rows where is_open is true."""
        family = GaugeMetricFamily(
            "sanmar_orders_open",
            "Number of SanMar orders not yet in a terminal status (80, 99).",
        )
        count = session.execute(
            select(func.count()).select_from(OrderRow).where(OrderRow.is_open)
        ).scalar() or 0
        family.add_metric([], float(count))
        return family

    def _collect_orders_by_status(self, session) -> Metric:
        """Gauge — count of OrderRow rows grouped by status_id.

        ``status_id`` NULL rows surface as the literal label
        ``"unknown"`` so Prometheus doesn't drop them.
        """
        family = GaugeMetricFamily(
            "sanmar_orders_by_status",
            "Number of SanMar orders grouped by SanMar status_id.",
            labels=["status_id"],
        )
        rows = session.execute(
            select(OrderRow.status_id, func.count())
            .group_by(OrderRow.status_id)
        ).all()
        for status_id, count in rows:
            label = "unknown" if status_id is None else str(status_id)
            family.add_metric([label], float(count))
        return family

    def _collect_inventory_snapshots_24h(self, session) -> Metric:
        """Counter — InventorySnapshot rows written in the last 24h.

        Modeled as a Counter (not Gauge) because the value is monotonic
        within the rolling window — Prometheus' ``rate()`` then yields
        snapshots/sec without weird negative blips when the window
        rolls past midnight.
        """
        family = CounterMetricFamily(
            "sanmar_inventory_snapshots_24h",
            "InventorySnapshot rows written in the trailing 24 hours.",
        )
        cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=24)
        count = session.execute(
            select(func.count())
            .select_from(InventorySnapshot)
            .where(InventorySnapshot.fetched_at >= cutoff)
        ).scalar() or 0
        family.add_metric([], float(count))
        return family

    def _collect_last_sync_timestamp(self, session) -> Metric:
        """Gauge — UNIX timestamp of the latest finished sync per type.

        Drives the "time since last sync" stat panel on the Grafana
        dashboard. NULL ``finished_at`` rows are excluded so an
        in-flight sync doesn't reset the timestamp to zero.
        """
        family = GaugeMetricFamily(
            "sanmar_last_sync_timestamp_seconds",
            "UNIX timestamp of the most recent finished sync per type.",
            labels=["sync_type"],
        )
        rows = session.execute(
            select(SyncState.sync_type, func.max(SyncState.finished_at))
            .where(SyncState.finished_at.is_not(None))
            .group_by(SyncState.sync_type)
        ).all()
        for sync_type, finished_at in rows:
            if finished_at is None:
                continue
            # SQLAlchemy can return naive datetimes from SQLite even
            # when the column is timezone-aware — coerce to UTC so the
            # timestamp() call doesn't reinterpret as local time.
            if finished_at.tzinfo is None:
                finished_at = finished_at.replace(tzinfo=timezone.utc)
            family.add_metric([sync_type], finished_at.timestamp())
        return family
