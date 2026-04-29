"""Product routes — list, search, single, variants, inventory, pricing.

The list/single/variants endpoints project SQLAlchemy ORM rows onto
the SOAP-shaped pydantic v2 DTOs from :mod:`sanmar.dto` plus the
API-shaped wrappers in :mod:`sanmar.api.models`. Pagination on the
list endpoint is ``page`` / ``page_size`` with a hard ceiling of 100
items per page so a misconfigured client can't exfiltrate the catalog
in one shot.

Phase 10 also surfaces brief-mandated nested routes — search,
``/products/{style}/inventory``, ``/products/{style}/pricing`` — so
the storefront can stay on a single ``/products/...`` namespace
instead of juggling top-level pricing/inventory paths.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy import desc, func, or_, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, selectinload

from sanmar.api.app import get_engine
from sanmar.api.cache import cache_response
from sanmar.api.cache_pricing import CachedPricing
from sanmar.api.models import (
    ProductListResponse,
    VariantMatrixResponse,
    VariantRow,
)
from sanmar.db import session_scope
from sanmar.dto import (
    WAREHOUSE_NAMES,
    InventoryResponse,
    PriceBreak,
    PricingResponse,
    ProductResponse,
    WarehouseLevel,
)
from sanmar.models import Brand, InventorySnapshot, Product, Variant

router = APIRouter(prefix="/products", tags=["products"])

MAX_PAGE_SIZE: int = 100

_WAREHOUSE_CODE_TO_ID: dict[str, int] = {v: k for k, v in WAREHOUSE_NAMES.items()}


def _resolve_warehouse_id(code: str) -> int:
    """Best-effort warehouse code → numeric ID resolver."""
    return _WAREHOUSE_CODE_TO_ID.get(code, 0)


def _product_to_dto(product: Product, brand_name: Optional[str]) -> ProductResponse:
    """Project an ORM ``Product`` row onto the SOAP-shaped DTO.

    ``Variant.color`` / ``size`` is the only place colors / sizes are
    persisted, so we derive ``list_of_colors`` / ``list_of_sizes`` from
    the variant rows. Empty entries are filtered so the front-end
    doesn't render empty chips.
    """
    colors = sorted({v.color for v in product.variants if v.color})
    sizes = sorted({v.size for v in product.variants if v.size})
    return ProductResponse(
        styleNumber=product.style_number,
        brandName=brand_name or "",
        productName=product.name or "",
        description=product.description or "",
        category=product.category or "",
        status=product.status or "active",
        listOfColors=colors,
        listOfSizes=sizes,
    )


def _load_product_or_404(session: Session, style_number: str) -> Product:
    """Fetch a Product (with variants + brand) or raise 404."""
    stmt = (
        select(Product)
        .where(Product.style_number == style_number)
        .options(selectinload(Product.variants), selectinload(Product.brand))
    )
    product = session.execute(stmt).unique().scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=404,
            detail=f"Style '{style_number}' not in cache.",
        )
    return product


# ── /products/search (must come BEFORE /{style_number}) ────────────────


@router.get(
    "/search",
    response_model=list[ProductResponse],
    name="search_products",
)
async def search_products(
    request: Request,
    q: str = Query(..., min_length=1, description="Search term"),
    limit: int = Query(20, ge=1, le=200),
    engine: Engine = Depends(get_engine),
) -> list[ProductResponse]:
    """SQL LIKE search on name + style_number + description.

    Declared *before* ``/{style_number}`` so FastAPI's matcher prefers
    the static route — otherwise ``/products/search`` would resolve to
    detail with style_number="search".
    """
    like = f"%{q}%"
    with session_scope(engine) as session:
        stmt = (
            select(Product)
            .options(
                selectinload(Product.brand),
                selectinload(Product.variants),
            )
            .where(
                or_(
                    Product.name.ilike(like),
                    Product.style_number.ilike(like),
                    Product.description.ilike(like),
                )
            )
            .order_by(Product.style_number)
            .limit(limit)
        )
        rows = session.execute(stmt).unique().scalars().all()
        return [
            _product_to_dto(p, p.brand.name if p.brand else "")
            for p in rows
        ]


# ── /products (list) ───────────────────────────────────────────────────


@router.get("", response_model=ProductListResponse, name="list_products")
@cache_response(ttl_seconds=30)
async def list_products(
    request: Request,
    brand: Optional[str] = Query(None, description="Filter by exact brand name."),
    category: Optional[str] = Query(None, description="Filter by exact category."),
    q: Optional[str] = Query(None, description="Substring search on Product.name."),
    active: Optional[bool] = Query(
        None, description="When true, only status='active'."
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=MAX_PAGE_SIZE),
    limit: Optional[int] = Query(
        None,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Alias for page_size — brief uses limit/offset.",
    ),
    offset: Optional[int] = Query(
        None,
        ge=0,
        description="Alias for (page-1)*page_size — brief uses limit/offset.",
    ),
    engine: Engine = Depends(get_engine),
) -> ProductListResponse:
    """Paginated, filterable product list.

    Accepts both ``page``/``page_size`` (legacy) and ``limit``/``offset``
    (brief) — when ``limit`` or ``offset`` is supplied, it overrides
    the legacy parameters so a single client style works.
    """
    if limit is not None:
        page_size = limit
    if offset is not None:
        page = (offset // page_size) + 1

    with session_scope(engine) as session:
        stmt = (
            select(Product)
            .outerjoin(Brand, Product.brand_id == Brand.id)
            .options(selectinload(Product.variants), selectinload(Product.brand))
        )
        if brand:
            stmt = stmt.where(Brand.name == brand)
        if category:
            stmt = stmt.where(Product.category == category)
        if q:
            stmt = stmt.where(Product.name.like(f"%{q}%"))
        if active is True:
            stmt = stmt.where(Product.status == "active")
        elif active is False:
            stmt = stmt.where(Product.status != "active")

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.execute(count_stmt).scalar() or 0

        stmt = (
            stmt.order_by(Product.style_number)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        rows = session.execute(stmt).unique().scalars().all()
        products = [
            _product_to_dto(p, p.brand.name if p.brand else "") for p in rows
        ]

    return ProductListResponse(
        products=products,
        total=int(total),
        page=page,
        page_size=page_size,
    )


# ── /products/{style_number} (single) ──────────────────────────────────


@router.get(
    "/{style_number}",
    response_model=ProductResponse,
    name="get_product",
)
async def get_product(
    style_number: str = Path(..., description="SanMar style number, e.g. NF0A529K"),
    engine: Engine = Depends(get_engine),
) -> ProductResponse:
    """Single product, including the full color / size axis lists."""
    with session_scope(engine) as session:
        product = _load_product_or_404(session, style_number)
        brand_name = product.brand.name if product.brand else ""
        return _product_to_dto(product, brand_name)


# ── /products/{style_number}/variants ──────────────────────────────────


@router.get(
    "/{style_number}/variants",
    response_model=VariantMatrixResponse,
    name="get_product_variants",
)
async def get_product_variants(
    style_number: str = Path(..., description="SanMar style number"),
    engine: Engine = Depends(get_engine),
) -> VariantMatrixResponse:
    """Color × size variant matrix for one style."""
    with session_scope(engine) as session:
        product = _load_product_or_404(session, style_number)
        rows = [
            VariantRow(
                full_sku=v.full_sku,
                color=v.color,
                size=v.size,
                price_cad=float(v.price_cad) if v.price_cad is not None else None,
            )
            for v in product.variants
        ]
        colors = sorted({v.color for v in product.variants if v.color})
        sizes = sorted({v.size for v in product.variants if v.size})
        return VariantMatrixResponse(
            style_number=product.style_number,
            colors=colors,
            sizes=sizes,
            rows=rows,
        )


# ── /products/{style_number}/inventory ─────────────────────────────────


@router.get(
    "/{style_number}/inventory",
    response_model=InventoryResponse,
    name="get_product_inventory",
)
async def get_product_inventory(
    style_number: str = Path(..., description="SanMar style number"),
    engine: Engine = Depends(get_engine),
) -> InventoryResponse:
    """Latest snapshot per (variant, warehouse) + total across warehouses.

    The underlying ``InventorySnapshot`` table accumulates history; we
    reduce to the latest row per (full_sku, warehouse) so the storefront
    sees current stock, not a sum across history.
    """
    with session_scope(engine) as session:
        product = session.execute(
            select(Product).where(Product.style_number == style_number)
        ).scalar_one_or_none()
        if product is None:
            raise HTTPException(
                status_code=404,
                detail=f"Style '{style_number}' not in cache.",
            )

        skus = [
            v.full_sku
            for v in session.execute(
                select(Variant).where(Variant.product_id == product.id)
            )
            .scalars()
            .all()
        ]
        if not skus:
            return InventoryResponse(productId=style_number, locations=[])

        # Latest fetched_at per (sku, warehouse).
        latest_subq = (
            select(
                InventorySnapshot.full_sku,
                InventorySnapshot.warehouse_code,
                func.max(InventorySnapshot.fetched_at).label("max_fetched"),
            )
            .where(InventorySnapshot.full_sku.in_(skus))
            .group_by(
                InventorySnapshot.full_sku, InventorySnapshot.warehouse_code
            )
            .subquery()
        )
        rows = session.execute(
            select(InventorySnapshot)
            .join(
                latest_subq,
                (InventorySnapshot.full_sku == latest_subq.c.full_sku)
                & (
                    InventorySnapshot.warehouse_code
                    == latest_subq.c.warehouse_code
                )
                & (InventorySnapshot.fetched_at == latest_subq.c.max_fetched),
            )
        ).scalars().all()

        per_wh: dict[str, int] = {}
        for snap in rows:
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


# ── /products/{style_number}/pricing ───────────────────────────────────


@router.get(
    "/{style_number}/pricing",
    response_model=PricingResponse,
    name="get_product_cached_pricing",
)
async def get_product_cached_pricing(
    style_number: str = Path(..., description="SanMar style number"),
    color: Optional[str] = Query(None),
    size: Optional[str] = Query(None),
    engine: Engine = Depends(get_engine),
) -> PricingResponse:
    """Read CACHED pricing only — never hits SOAP.

    Returns 404 with a hint when no row is in :class:`CachedPricing`
    yet so the storefront can fall back to "Contact us for pricing"
    rather than blow up.
    """
    with session_scope(engine) as session:
        stmt = select(CachedPricing).where(
            CachedPricing.style_number == style_number
        )
        if color is not None:
            stmt = stmt.where(CachedPricing.color == color)
        if size is not None:
            stmt = stmt.where(CachedPricing.size == size)
        stmt = stmt.order_by(desc(CachedPricing.cached_at)).limit(1)
        row = session.execute(stmt).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Pricing not yet cached, run sync-pricing",
            )
        breaks = [
            PriceBreak(
                minQuantity=int(b.get("min_qty", 1)),
                maxQuantity=b.get("max_qty"),
                price=Decimal(str(b.get("price_cad", "0"))),
            )
            for b in (row.breaks or [])
        ]
        return PricingResponse(
            productId=row.style_number,
            partColor=row.color or None,
            labelSize=row.size or None,
            currency=row.currency,
            fobId=row.fob_id,
            breaks=breaks,
        )
