"""Request/response wrappers specific to the Phase 10 HTTP API.

These sit on top of the SOAP-shaped DTOs in :mod:`sanmar.dto` — DTOs
are reused for individual product / inventory / pricing payloads so
API consumers see the same field names as the underlying SanMar SOAP
responses (modulo the alias-vs-snake_case translation pydantic v2
handles automatically).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from sanmar.dto import ProductResponse


class ProductListResponse(BaseModel):
    """Paginated wrapper for the ``GET /products`` list endpoint.

    ``total`` is the count *before* pagination so a UI can render a
    page count; ``page`` and ``page_size`` echo the request so the
    caller can implement next/prev links without re-deriving them.
    """

    model_config = ConfigDict(populate_by_name=True)

    products: list[ProductResponse] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 50


class VariantRow(BaseModel):
    """One cell in the ``GET /products/{style}/variants`` matrix."""

    model_config = ConfigDict(populate_by_name=True)

    full_sku: str
    color: Optional[str] = None
    size: Optional[str] = None
    price_cad: Optional[float] = None


class VariantMatrixResponse(BaseModel):
    """Color-by-size variant grid for a single style."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    rows: list[VariantRow] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Payload of ``GET /health``.

    ``last_sync`` is ``{sync_type: finished_at | None}``; ``None`` means
    that sync type has never completed. ``warnings`` is a free list —
    populated when any ``last_sync`` value is older than the
    health-check threshold (>48h). ``sync_freshness`` is the integer
    seconds-since-last-sync map the brief calls out for the storefront.
    """

    model_config = ConfigDict(populate_by_name=True)

    status: str = "ok"
    db: bool = True
    db_connected: bool = True
    last_sync: dict[str, Optional[datetime]] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    sync_freshness: dict[str, Optional[int]] = Field(default_factory=dict)


class FreshnessResponse(BaseModel):
    """Payload of ``GET /metrics/freshness``.

    Three integer ages, one per logical sync stream. ``None`` = never
    synced; non-``None`` = seconds since the most recent ``finished_at``.
    """

    model_config = ConfigDict(populate_by_name=True)

    catalog_age_seconds: Optional[int] = None
    inventory_age_seconds: Optional[int] = None
    order_status_age_seconds: Optional[int] = None
