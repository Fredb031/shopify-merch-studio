"""Inventory routes — last-known snapshots from the local cache.

Inventory in :class:`sanmar.models.InventorySnapshot` is one row per
``(full_sku, warehouse_code, fetched_at)``; this module collapses the
most-recent batch into the SOAP-shaped :class:`sanmar.dto.
InventoryResponse` so API consumers see the same wire shape as the
underlying SanMar SOAP service.

Staleness is enforced via a ``max_age_hours`` query parameter
(default 24h). Older snapshots return 404 — the caller is expected
to fall back to a live SOAP call when the cache is stale, rather
than render zero stock to a customer.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from sanmar.api.app import get_engine
from sanmar.api.rate_limit import limiter
from sanmar.db import session_scope
from sanmar.dto import WAREHOUSE_NAMES, InventoryResponse, WarehouseLevel
from sanmar.models import InventorySnapshot, Product, Variant

router = APIRouter(prefix="/inventory", tags=["inventory"])

_WAREHOUSE_CODE_TO_ID: dict[str, int] = {v: k for k, v in WAREHOUSE_NAMES.items()}


def _resolve_warehouse_id(code: str) -> int:
    """Best-effort warehouse code → numeric ID resolver."""
    return _WAREHOUSE_CODE_TO_ID.get(code, 0)


def _latest_snapshots_for_skus(
    session: Session, full_skus: list[str]
) -> list[InventorySnapshot]:
    """Return the newest InventorySnapshot per (full_sku, warehouse_code)."""
    if not full_skus:
        return []
    rows = (
        session.execute(
            select(InventorySnapshot)
            .where(InventorySnapshot.full_sku.in_(full_skus))
            .order_by(InventorySnapshot.fetched_at.desc())
        )
        .scalars()
        .all()
    )
    seen: set[tuple[str, str]] = set()
    latest: list[InventorySnapshot] = []
    for row in rows:
        key = (row.full_sku, row.warehouse_code)
        if key in seen:
            continue
        seen.add(key)
        latest.append(row)
    return latest


def _check_staleness(
    snapshots: list[InventorySnapshot],
    max_age_hours: int,
    style_number: str,
) -> list[InventorySnapshot]:
    """Return only fresh snapshots; raise 404 when none remain."""
    if not snapshots:
        raise HTTPException(
            status_code=404,
            detail=f"No inventory snapshot for '{style_number}'.",
        )
    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=max_age_hours)
    fresh: list[InventorySnapshot] = []
    for snap in snapshots:
        fetched = snap.fetched_at
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=timezone.utc)
        if fetched >= cutoff:
            fresh.append(snap)
    if not fresh:
        raise HTTPException(
            status_code=404,
            detail=(
                f"All inventory snapshots for '{style_number}' are older "
                f"than {max_age_hours}h."
            ),
        )
    return fresh


@router.get(
    "/{style_number}",
    response_model=InventoryResponse,
    name="get_inventory_for_style",
)
@limiter.limit("30/minute")
async def get_inventory_for_style(
    request: Request,
    style_number: str = Path(..., description="SanMar style number"),
    max_age_hours: int = Query(24, ge=1),
    engine: Engine = Depends(get_engine),
) -> InventoryResponse:
    """Aggregate inventory snapshot across every variant of a style."""
    with session_scope(engine) as session:
        product = session.execute(
            select(Product).where(Product.style_number == style_number)
        ).scalar_one_or_none()
        if product is None:
            raise HTTPException(
                status_code=404,
                detail=f"Style '{style_number}' not in cache.",
            )
        full_skus = [
            v.full_sku
            for v in session.execute(
                select(Variant).where(Variant.product_id == product.id)
            )
            .scalars()
            .all()
        ]
        if not full_skus:
            raise HTTPException(
                status_code=404,
                detail=f"No variants for style '{style_number}'.",
            )
        snapshots = _latest_snapshots_for_skus(session, full_skus)
        fresh = _check_staleness(snapshots, max_age_hours, style_number)

        per_wh: dict[str, int] = {}
        for snap in fresh:
            per_wh[snap.warehouse_code] = (
                per_wh.get(snap.warehouse_code, 0) + snap.quantity
            )

        locations = [
            WarehouseLevel(
                inventoryLocationId=_resolve_warehouse_id(code),
                qty=qty,
            )
            for code, qty in sorted(per_wh.items())
        ]
        return InventoryResponse(
            productId=style_number,
            locations=locations,
        )


@router.get(
    "/{style_number}/{color}/{size}",
    response_model=InventoryResponse,
    name="get_inventory_for_sku",
)
@limiter.limit("30/minute")
async def get_inventory_for_sku(
    request: Request,
    style_number: str = Path(..., description="SanMar style number"),
    color: str = Path(..., description="Color name as cached in Variant.color"),
    size: str = Path(..., description="Size name as cached in Variant.size"),
    max_age_hours: int = Query(24, ge=1),
    engine: Engine = Depends(get_engine),
) -> InventoryResponse:
    """Per-SKU inventory snapshot — one warehouse row per location."""
    with session_scope(engine) as session:
        variant = session.execute(
            select(Variant)
            .join(Product, Variant.product_id == Product.id)
            .where(Product.style_number == style_number)
            .where(Variant.color == color)
            .where(Variant.size == size)
        ).scalar_one_or_none()
        if variant is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Variant ({style_number}, {color}, {size}) not in cache."
                ),
            )
        snapshots = _latest_snapshots_for_skus(session, [variant.full_sku])
        fresh = _check_staleness(snapshots, max_age_hours, style_number)

        locations = [
            WarehouseLevel(
                inventoryLocationId=_resolve_warehouse_id(snap.warehouse_code),
                qty=snap.quantity,
            )
            for snap in sorted(fresh, key=lambda s: s.warehouse_code)
        ]
        return InventoryResponse(
            productId=style_number,
            partColor=color,
            labelSize=size,
            locations=locations,
        )
