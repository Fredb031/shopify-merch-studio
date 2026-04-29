"""Idempotent upsert of a cleaned catalog DataFrame into local SQLite."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from loguru import logger
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from sanmar.models import Brand, Product, Variant


def _slugify(name: str) -> str:
    """Return a lowercase, no-space slug of `name`."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _coerce_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    s = str(value).strip()
    return s or None


def _coerce_float(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compose_full_sku(style: str, color: str | None, size: str | None) -> str:
    parts = [p for p in (style, color or "", size or "") if p is not None]
    return "-".join(p.replace(" ", "_") for p in parts if p != "")


def persist_catalog(df: pd.DataFrame, session: Session) -> dict[str, int]:
    """Upsert the cleaned catalog DataFrame into Brand/Product/Variant tables.

    Args:
        df: A DataFrame returned by `loader.load_catalog`.
        session: An open SQLAlchemy session.

    Returns:
        A dict with counts: `{'brands', 'products', 'variants', 'rows_processed'}`.
    """
    now = datetime.now(tz=timezone.utc)

    brand_names: set[str] = set()
    if "brand_name" in df.columns:
        brand_names = {
            _coerce_str(v)  # type: ignore[misc]
            for v in df["brand_name"].dropna().unique()
            if _coerce_str(v) is not None
        }

    # ---- Brands -----------------------------------------------------------
    if brand_names:
        brand_rows = [{"name": n, "slug": _slugify(n)} for n in sorted(brand_names)]
        stmt = sqlite_insert(Brand).values(brand_rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=[Brand.name],
            set_={"slug": stmt.excluded.slug},
        )
        session.execute(stmt)
        session.flush()

    brand_id_by_name: dict[str, int] = {
        b.name: b.id for b in session.query(Brand).all()
    }

    # ---- Products ---------------------------------------------------------
    product_payload: dict[str, dict[str, Any]] = {}
    for _, row in df.iterrows():
        style = _coerce_str(row.get("style_number")) if "style_number" in df.columns else None
        if not style:
            continue
        if style in product_payload:
            continue
        brand_name = (
            _coerce_str(row.get("brand_name")) if "brand_name" in df.columns else None
        )
        product_payload[style] = {
            "style_number": style,
            "parent_sku": _coerce_str(row.get("parent_sku"))
            if "parent_sku" in df.columns
            else None,
            "brand_id": brand_id_by_name.get(brand_name) if brand_name else None,
            "name": _coerce_str(row.get("full_feature_description"))
            if "full_feature_description" in df.columns
            else None,
            "description": _coerce_str(row.get("full_feature_description"))
            if "full_feature_description" in df.columns
            else None,
            "category": _coerce_str(row.get("category"))
            if "category" in df.columns
            else None,
            "status": (_coerce_str(row.get("status")) or "active")
            if "status" in df.columns
            else "active",
            "last_synced_at": now,
        }

    if product_payload:
        stmt = sqlite_insert(Product).values(list(product_payload.values()))
        stmt = stmt.on_conflict_do_update(
            index_elements=[Product.style_number],
            set_={
                "parent_sku": stmt.excluded.parent_sku,
                "brand_id": stmt.excluded.brand_id,
                "name": stmt.excluded.name,
                "description": stmt.excluded.description,
                "category": stmt.excluded.category,
                "status": stmt.excluded.status,
                "last_synced_at": stmt.excluded.last_synced_at,
            },
        )
        session.execute(stmt)
        session.flush()

    product_id_by_style: dict[str, int] = {
        p.style_number: p.id for p in session.query(Product).all()
    }

    # ---- Variants ---------------------------------------------------------
    variant_payload: dict[str, dict[str, Any]] = {}
    for _, row in df.iterrows():
        style = _coerce_str(row.get("style_number")) if "style_number" in df.columns else None
        if not style:
            continue
        product_id = product_id_by_style.get(style)
        if product_id is None:
            continue
        color = _coerce_str(row.get("color_name")) if "color_name" in df.columns else None
        size = _coerce_str(row.get("size")) if "size" in df.columns else None
        full_sku = (
            _coerce_str(row.get("full_sku")) if "full_sku" in df.columns else None
        ) or _compose_full_sku(style, color, size)
        if not full_sku or full_sku in variant_payload:
            continue
        variant_payload[full_sku] = {
            "product_id": product_id,
            "full_sku": full_sku,
            "color": color,
            "size": size,
            "weight_g": _coerce_float(row.get("weight_g"))
            if "weight_g" in df.columns
            else None,
            "price_cad": _coerce_float(row.get("price_cad"))
            if "price_cad" in df.columns
            else None,
            "last_synced_at": now,
        }

    if variant_payload:
        stmt = sqlite_insert(Variant).values(list(variant_payload.values()))
        stmt = stmt.on_conflict_do_update(
            index_elements=[Variant.full_sku],
            set_={
                "product_id": stmt.excluded.product_id,
                "color": stmt.excluded.color,
                "size": stmt.excluded.size,
                "weight_g": stmt.excluded.weight_g,
                "price_cad": stmt.excluded.price_cad,
                "last_synced_at": stmt.excluded.last_synced_at,
            },
        )
        session.execute(stmt)
        session.flush()

    counts = {
        "brands": session.query(Brand).count(),
        "products": session.query(Product).count(),
        "variants": session.query(Variant).count(),
        "rows_processed": int(len(df)),
    }
    logger.info(
        "Persisted catalog: brands={brands} products={products} "
        "variants={variants} rows_processed={rows_processed}",
        **counts,
    )
    return counts
