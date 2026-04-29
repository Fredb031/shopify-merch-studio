"""SQLAlchemy 2.0 ORM models for the local SanMar catalog cache."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sanmar.db import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="brand", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"Brand(id={self.id!r}, name={self.name!r})"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    style_number: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    parent_sku: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    brand_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("brands.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    brand: Mapped[Optional[Brand]] = relationship("Brand", back_populates="products")
    variants: Mapped[list["Variant"]] = relationship(
        "Variant", back_populates="product", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"Product(id={self.id!r}, style_number={self.style_number!r})"


class Variant(Base):
    __tablename__ = "variants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_sku: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    color: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    weight_g: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    price_cad: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    product: Mapped[Product] = relationship("Product", back_populates="variants")

    __table_args__ = (
        UniqueConstraint("full_sku", name="uq_variants_full_sku"),
        Index("ix_variants_product_color_size", "product_id", "color", "size"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"Variant(id={self.id!r}, full_sku={self.full_sku!r})"


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_sku: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    warehouse_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )

    __table_args__ = (
        Index("ix_inv_snap_sku_fetched", "full_sku", "fetched_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"InventorySnapshot(full_sku={self.full_sku!r}, "
            f"warehouse={self.warehouse_code!r}, qty={self.quantity})"
        )
