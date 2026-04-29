"""Phase 10 — locally cached pricing rows.

The HTTP API exposes ``GET /products/{style}/pricing`` strictly out of
the local SQLite cache: storefront calls must never round-trip to SOAP.
A nightly job (out of scope for Phase 10 — flagged as a follow-up) is
expected to populate this table; until then it stays empty and the
endpoint returns a 404 with a hint pointing at ``sync-pricing``.

Why a separate table rather than columns on :class:`Variant`?
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
SanMar pricing is a tiered ladder per (style, color, size, fob_id,
price_type) — multiple rows per variant, with min/max quantity windows.
Variants stay scalar; price ladders live here.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from sanmar.db import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class CachedPricing(Base):
    """One persisted price ladder for a (style, color, size) variant.

    ``breaks`` is a JSON list of ``{min_qty, max_qty, price_cad}`` dicts
    so the storefront can render the full quantity-discount table without
    a join. ``cached_at`` lets the API return staleness info to clients.
    """

    __tablename__ = "cached_pricing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    style_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    color: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    size: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="CAD")
    fob_id: Mapped[str] = mapped_column(String(32), nullable=False, default="CUSTOMER")
    price_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="BLANK"
    )
    breaks: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    cached_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    __table_args__ = (
        UniqueConstraint(
            "style_number",
            "color",
            "size",
            "fob_id",
            "price_type",
            name="uq_cached_pricing_variant",
        ),
        Index(
            "ix_cached_pricing_style_color_size",
            "style_number",
            "color",
            "size",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"CachedPricing(style={self.style_number!r}, "
            f"color={self.color!r}, size={self.size!r})"
        )
