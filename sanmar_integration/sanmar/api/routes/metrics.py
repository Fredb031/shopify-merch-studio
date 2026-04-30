"""Metrics endpoint — sync freshness for storefront debugging.

``GET /metrics/freshness`` returns the integer seconds since each
sync stream last finished. The storefront uses this to render a debug
banner ("inventory last refreshed 4 minutes ago") without having to
parse the full health payload.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.engine import Engine

from sanmar.api.app import get_engine
from sanmar.api.rate_limit import limiter
from sanmar.api.models import FreshnessResponse
from sanmar.db import session_scope
from sanmar.models import SyncState

router = APIRouter(prefix="/metrics", tags=["metrics"])

_FRESHNESS_BUCKET = {
    "catalog_full": "catalog_age_seconds",
    "catalog_delta": "catalog_age_seconds",
    "inventory": "inventory_age_seconds",
    "order_reconcile": "order_status_age_seconds",
}


def _age_seconds(when: Optional[datetime]) -> Optional[int]:
    if when is None:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return int((datetime.now(tz=timezone.utc) - when).total_seconds())


@router.get(
    "/freshness", response_model=FreshnessResponse, name="metrics_freshness"
)
@limiter.limit("10/minute")
async def metrics_freshness(
    request: Request,
    engine: Engine = Depends(get_engine),
) -> FreshnessResponse:
    """Return seconds since last successful finish for each sync stream."""
    with session_scope(engine) as session:
        rows = session.execute(
            select(SyncState.sync_type, func.max(SyncState.finished_at))
            .where(SyncState.finished_at.is_not(None))
            .group_by(SyncState.sync_type)
        ).all()

    out = FreshnessResponse(
        catalog_age_seconds=None,
        inventory_age_seconds=None,
        order_status_age_seconds=None,
    )
    for sync_type, finished_at in rows:
        bucket = _FRESHNESS_BUCKET.get(sync_type)
        if bucket is None:
            continue
        age = _age_seconds(finished_at)
        if age is None:
            continue
        existing = getattr(out, bucket)
        if existing is None or age < existing:
            setattr(out, bucket, age)
    return out
