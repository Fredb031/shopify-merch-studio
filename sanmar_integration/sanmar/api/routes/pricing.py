"""Pricing routes — break ladders from the local cache.

Pricing in SanMar Canada changes rarely (a handful of SKUs per
quarter), so this route serves directly from cached
``Variant.price_cad`` rows and synthesises a single ``PriceBreak``
ladder. There's intentionally no staleness gate here — the absence
of a price is the only failure mode worth handling, and that's a 404.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import select
from sqlalchemy.engine import Engine

from sanmar.api.app import get_engine
from sanmar.db import session_scope
from sanmar.dto import PriceBreak, PricingResponse
from sanmar.models import Product, Variant

router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.get(
    "/{style_number}",
    response_model=PricingResponse,
    name="get_pricing_for_style",
)
async def get_pricing_for_style(
    style_number: str = Path(..., description="SanMar style number"),
    color: Optional[str] = Query(None),
    size: Optional[str] = Query(None),
    engine: Engine = Depends(get_engine),
) -> PricingResponse:
    """Return cached price breaks for a style (optionally filtered)."""
    with session_scope(engine) as session:
        product = session.execute(
            select(Product).where(Product.style_number == style_number)
        ).scalar_one_or_none()
        if product is None:
            raise HTTPException(
                status_code=404,
                detail=f"Style '{style_number}' not in cache.",
            )

        stmt = select(Variant).where(Variant.product_id == product.id)
        if color is not None:
            stmt = stmt.where(Variant.color == color)
        if size is not None:
            stmt = stmt.where(Variant.size == size)
        variants = session.execute(stmt).scalars().all()
        prices = sorted(
            {
                Decimal(str(v.price_cad))
                for v in variants
                if v.price_cad is not None
            }
        )
        if not prices:
            raise HTTPException(
                status_code=404,
                detail=f"No pricing on file for style '{style_number}'.",
            )

        breaks = [PriceBreak(minQuantity=1, maxQuantity=None, price=p) for p in prices]
        return PricingResponse(
            productId=style_number,
            partColor=color,
            labelSize=size,
            breaks=breaks,
        )
