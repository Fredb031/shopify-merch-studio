"""Tests for the Phase 8 Prometheus exporter."""
from __future__ import annotations

import threading
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from prometheus_client import CollectorRegistry
from prometheus_client.exposition import generate_latest
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from sanmar.db import init_schema, make_engine, make_session_factory
from sanmar.exporter import SanmarMetricsCollector
from sanmar.exporter_app import build_server
from sanmar.models import InventorySnapshot, OrderRow, SyncState


def _seed_engine(tmp_path: Path) -> Engine:
    """Build a fresh SQLite engine with an empty schema applied."""
    engine = make_engine(tmp_path / "exporter.db")
    init_schema(engine)
    return engine


def _session(engine: Engine) -> Session:
    return make_session_factory(engine)()


def _scrape_text(collector: SanmarMetricsCollector) -> str:
    """Render the collector against an isolated registry as text.

    Using a per-test :class:`CollectorRegistry` rather than the global
    REGISTRY keeps tests order-independent — a previous test's
    registrations can't leak into this one.
    """
    registry = CollectorRegistry()
    registry.register(collector)
    return generate_latest(registry).decode("utf-8")


def test_collector_handles_empty_db(tmp_path: Path) -> None:
    """Fresh DB must yield zero metrics, never crash. This is the
    day-zero contract — Prometheus scraping a brand-new install
    must succeed."""
    engine = _seed_engine(tmp_path)
    collector = SanmarMetricsCollector(engine=engine)

    text = _scrape_text(collector)

    # All seven metric families must render even when empty — the
    # presence of the HELP lines is what we assert here.
    for name in (
        "sanmar_sync_duration_seconds",
        "sanmar_sync_errors_total",
        "sanmar_sync_success_total",
        "sanmar_orders_open",
        "sanmar_orders_by_status",
        "sanmar_inventory_snapshots_24h",
        "sanmar_last_sync_timestamp_seconds",
    ):
        assert f"# HELP {name}" in text, f"missing HELP for {name}"

    # And the gauge families that always emit a single sample even
    # when the table is empty must show 0.
    assert "sanmar_orders_open 0.0" in text
    assert "sanmar_inventory_snapshots_24h_total 0.0" in text


def test_orders_open_gauge_matches_seeded_data(tmp_path: Path) -> None:
    """sanmar_orders_open must equal the count of OrderRow.is_open
    rows — i.e., status_id NOT IN (80, 99) plus NULL status_id."""
    engine = _seed_engine(tmp_path)
    with _session(engine) as session:
        session.add_all([
            OrderRow(po_number="PO-A", status_id=10),   # open (in production)
            OrderRow(po_number="PO-B", status_id=60),   # open
            OrderRow(po_number="PO-C", status_id=80),   # closed (shipped)
            OrderRow(po_number="PO-D", status_id=99),   # closed (cancelled)
            OrderRow(po_number="PO-E", status_id=None), # open (unknown)
        ])
        session.commit()

    collector = SanmarMetricsCollector(engine=engine)
    text = _scrape_text(collector)

    # 3 of 5 rows are open: 10, 60, NULL.
    assert "sanmar_orders_open 3.0" in text


def test_sync_errors_total_aggregates_error_count(tmp_path: Path) -> None:
    """sanmar_sync_errors_total{sync_type=...} must sum SyncState.error_count
    across all rows of that type — a single sync's errors should bump
    the counter by error_count, not by 1."""
    engine = _seed_engine(tmp_path)
    now = datetime.now(tz=timezone.utc)
    with _session(engine) as session:
        # Inventory: one good run (0 errors), one with 7 errors.
        session.add(SyncState(
            sync_type="inventory",
            started_at=now - timedelta(minutes=20),
            finished_at=now - timedelta(minutes=19),
            success_count=300,
            error_count=0,
        ))
        session.add(SyncState(
            sync_type="inventory",
            started_at=now - timedelta(minutes=10),
            finished_at=now - timedelta(minutes=9),
            success_count=250,
            error_count=7,
        ))
        # Catalog delta with 2 errors.
        session.add(SyncState(
            sync_type="catalog_delta",
            started_at=now - timedelta(minutes=5),
            finished_at=now - timedelta(minutes=4),
            success_count=42,
            error_count=2,
        ))
        session.commit()

    collector = SanmarMetricsCollector(engine=engine)
    text = _scrape_text(collector)

    assert 'sanmar_sync_errors_total{sync_type="inventory"} 7.0' in text
    assert 'sanmar_sync_errors_total{sync_type="catalog_delta"} 2.0' in text


def test_last_sync_timestamp_returns_latest_per_type(tmp_path: Path) -> None:
    """sanmar_last_sync_timestamp_seconds must be MAX(finished_at)
    grouped by sync_type — older runs of the same type must not
    overwrite the timestamp."""
    engine = _seed_engine(tmp_path)
    older = datetime(2026, 4, 28, 12, 0, tzinfo=timezone.utc)
    newer = datetime(2026, 4, 29, 12, 0, tzinfo=timezone.utc)

    with _session(engine) as session:
        session.add(SyncState(
            sync_type="inventory",
            started_at=older - timedelta(minutes=1),
            finished_at=older,
            success_count=1, error_count=0,
        ))
        session.add(SyncState(
            sync_type="inventory",
            started_at=newer - timedelta(minutes=1),
            finished_at=newer,
            success_count=2, error_count=0,
        ))
        # In-flight row (no finished_at) must be ignored.
        session.add(SyncState(
            sync_type="inventory",
            started_at=newer + timedelta(minutes=10),
            finished_at=None,
            success_count=0, error_count=0,
        ))
        session.commit()

    collector = SanmarMetricsCollector(engine=engine)
    text = _scrape_text(collector)

    # Parse the value out of the exposition text — Prometheus may
    # emit it in scientific notation (1.777464e+09), so a literal
    # string match would be brittle.
    target = 'sanmar_last_sync_timestamp_seconds{sync_type="inventory"}'
    matching = [ln for ln in text.splitlines() if ln.startswith(target)]
    assert len(matching) == 1, f"expected one inventory line, got: {matching}"
    value = float(matching[0].split()[1])
    assert value == pytest.approx(newer.timestamp(), abs=1.0)


def test_inventory_snapshots_24h_counts_recent_only(tmp_path: Path) -> None:
    """sanmar_inventory_snapshots_24h must include only rows whose
    fetched_at is within the trailing 24 hours — older rows must not
    inflate the count."""
    engine = _seed_engine(tmp_path)
    now = datetime.now(tz=timezone.utc)
    with _session(engine) as session:
        # 3 rows in window.
        for i in range(3):
            session.add(InventorySnapshot(
                full_sku=f"SKU-{i}",
                warehouse_code="VAN",
                quantity=10,
                fetched_at=now - timedelta(hours=2),
            ))
        # 2 rows out of window (>24h old).
        for i in range(2):
            session.add(InventorySnapshot(
                full_sku=f"SKU-OLD-{i}",
                warehouse_code="VAN",
                quantity=10,
                fetched_at=now - timedelta(days=2),
            ))
        session.commit()

    collector = SanmarMetricsCollector(engine=engine)
    text = _scrape_text(collector)

    assert "sanmar_inventory_snapshots_24h_total 3.0" in text


def test_http_endpoint_serves_prometheus_format(tmp_path: Path) -> None:
    """End-to-end: build_server() + a real HTTP GET to /metrics must
    return text in the Prometheus exposition format (`# HELP …`)."""
    # Patch get_settings so the exporter points at our tmp DB.
    import sanmar.exporter_app as app_mod
    import sanmar.exporter as exporter_mod

    engine = _seed_engine(tmp_path)
    with _session(engine) as session:
        session.add(OrderRow(po_number="PO-HTTP-1", status_id=10))
        session.commit()

    # Inject our seeded engine into the collector by monkey-patching
    # the constructor — keeps the test pure (no real DB path required).
    original_init = exporter_mod.SanmarMetricsCollector.__init__

    def patched_init(self, settings=None, *, engine=None):  # noqa: ANN001
        original_init(self, settings=settings, engine=engine or _scoped_engine[0])

    _scoped_engine = [engine]
    exporter_mod.SanmarMetricsCollector.__init__ = patched_init  # type: ignore[method-assign]

    try:
        # Bind to port 0 so the OS picks a free port — keeps the test
        # safe to run in parallel.
        server = build_server(host="127.0.0.1", port=0)
        bound_port = server.server_address[1]

        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{bound_port}/metrics", timeout=5
            ) as resp:
                body = resp.read().decode("utf-8")
                content_type = resp.headers.get("Content-Type", "")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

        assert "# HELP sanmar_orders_open" in body
        assert "sanmar_orders_open 1.0" in body
        # Prometheus exposition Content-Type is text/plain; version=…
        assert "text/plain" in content_type
    finally:
        exporter_mod.SanmarMetricsCollector.__init__ = original_init  # type: ignore[method-assign]
        # Clean up any global registry registrations build_server() made.
        from prometheus_client import REGISTRY
        for collector in list(REGISTRY._collector_to_names.keys()):
            if isinstance(collector, exporter_mod.SanmarMetricsCollector):
                REGISTRY.unregister(collector)


def test_metrics_cli_command_is_registered() -> None:
    """The Typer CLI must expose `sanmar metrics` so operators can
    launch the exporter without running a Python module path."""
    from typer.testing import CliRunner

    from sanmar.cli import app

    runner = CliRunner()
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "metrics" in result.stdout


@pytest.mark.parametrize("status_id,expected_label", [
    (10, "10"),
    (80, "80"),
    (None, "unknown"),
])
def test_orders_by_status_labels(
    tmp_path: Path, status_id: int | None, expected_label: str
) -> None:
    """sanmar_orders_by_status must label each row with its status_id
    (or "unknown" when NULL) — Grafana drops series with empty labels."""
    engine = _seed_engine(tmp_path)
    with _session(engine) as session:
        session.add(OrderRow(po_number=f"PO-{status_id}", status_id=status_id))
        session.commit()

    collector = SanmarMetricsCollector(engine=engine)
    text = _scrape_text(collector)

    assert f'sanmar_orders_by_status{{status_id="{expected_label}"}} 1.0' in text
