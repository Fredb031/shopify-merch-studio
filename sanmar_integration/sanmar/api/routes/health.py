"""Health endpoint — DB reachability + sync freshness.

``GET /health`` returns:

- 503 when the SQLite DB is unreachable / can't open a session.
- 200 with ``warnings`` populated when any sync_type's last finished
  run is older than 48 hours.
- 200 clean when every sync is fresh.

The response carries both the legacy ``db_connected`` field and the
brief-mandated ``db`` boolean + ``sync_freshness`` integer-age map so
existing clients and Phase 10 storefront callers both work.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.engine import Engine

from sanmar.api.app import get_engine
from sanmar.api.models import HealthResponse
from sanmar.db import session_scope
from sanmar.models import SyncState

router = APIRouter(prefix="/health", tags=["health"])

STALE_THRESHOLD_HOURS: int = 48

# Map sync_type → freshness bucket. Both catalog_full and catalog_delta
# refresh the catalog, so they share a bucket and the smaller age wins.
_FRESHNESS_BUCKET = {
    "catalog_full": "catalog_age_seconds",
    "catalog_delta": "catalog_age_seconds",
    "inventory": "inventory_age_seconds",
    "order_reconcile": "order_status_age_seconds",
}


def _normalize_finished_at(value: Optional[datetime]) -> Optional[datetime]:
    """SQLite hands back naive datetimes — coerce to UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _age_seconds(when: Optional[datetime]) -> Optional[int]:
    if when is None:
        return None
    return int((datetime.now(tz=timezone.utc) - when).total_seconds())


@router.get("", response_model=HealthResponse, name="health_check")
async def health_check(
    response: Response,
    engine: Engine = Depends(get_engine),
) -> HealthResponse:
    """Open a session, query the SyncState table, return status."""
    try:
        with session_scope(engine) as session:
            rows = session.execute(
                select(
                    SyncState.sync_type,
                    func.max(SyncState.finished_at),
                )
                .where(SyncState.finished_at.is_not(None))
                .group_by(SyncState.sync_type)
            ).all()
    except Exception:  # noqa: BLE001 — any DB failure is a 503
        response.status_code = 503
        return HealthResponse(
            status="error",
            db=False,
            db_connected=False,
            last_sync={},
            warnings=["DB unreachable"],
            sync_freshness={
                "catalog_age_seconds": None,
                "inventory_age_seconds": None,
                "order_status_age_seconds": None,
            },
        )

    last_sync: dict[str, Optional[datetime]] = {
        sync_type: _normalize_finished_at(finished_at)
        for sync_type, finished_at in rows
    }

    sync_freshness: dict[str, Optional[int]] = {
        "catalog_age_seconds": None,
        "inventory_age_seconds": None,
        "order_status_age_seconds": None,
    }
    for sync_type, finished_at in last_sync.items():
        bucket = _FRESHNESS_BUCKET.get(sync_type)
        if bucket is None:
            continue
        age = _age_seconds(finished_at)
        if age is None:
            continue
        existing = sync_freshness[bucket]
        if existing is None or age < existing:
            sync_freshness[bucket] = age

    now = datetime.now(tz=timezone.utc)
    cutoff = now - timedelta(hours=STALE_THRESHOLD_HOURS)
    warnings: list[str] = []
    for sync_type, finished_at in last_sync.items():
        if finished_at is None or finished_at < cutoff:
            warnings.append(
                f"{sync_type} last finished at "
                f"{finished_at.isoformat() if finished_at else 'never'} "
                f"(>{STALE_THRESHOLD_HOURS}h)"
            )

    return HealthResponse(
        status="ok" if not warnings else "warning",
        db=True,
        db_connected=True,
        last_sync=last_sync,
        warnings=warnings,
        sync_freshness=sync_freshness,
    )
