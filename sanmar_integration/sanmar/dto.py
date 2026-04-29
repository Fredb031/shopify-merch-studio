"""Pydantic v2 response DTOs for SanMar SOAP responses.

These are *separate* from the SQLAlchemy ORM models in `sanmar/models.py`.
The ORM persists rows; the DTOs shape SOAP responses for transit. Keep
them decoupled: a DTO change must not force a schema migration.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


class ProductResponse(BaseModel):
    """Normalized projection of a `getProduct` response."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="styleNumber")
    brand_name: str = Field(default="", alias="brandName")
    product_name: str = Field(default="", alias="productName")
    description: str = Field(default="", alias="description")
    category: str = Field(default="", alias="category")
    status: str = Field(default="active", alias="status")
    list_of_colors: list[str] = Field(default_factory=list, alias="listOfColors")
    list_of_sizes: list[str] = Field(default_factory=list, alias="listOfSizes")
    image_url: Optional[str] = Field(default=None, alias="imageUrl")


class SellableVariant(BaseModel):
    """One row from `getProductSellable` after partId regex parsing."""

    model_config = ConfigDict(populate_by_name=True)

    part_id: str = Field(alias="partId")
    style_number: str = Field(alias="styleNumber")
    color: str
    size: str
    sku: str


class ActivePart(BaseModel):
    """One row from `getAllActiveParts`."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="styleNumber")
    color: str
    size: str
    sku: str


# ── Inventory v2.0.0 ───────────────────────────────────────────────────


# SanMar Canada warehouse names keyed by `inventoryLocationId`. Per the
# Inventory Service PDF: 1=Vancouver, 2=Mississauga, 4=Calgary. ID 3 is
# unused on the Canadian side; we don't synthesize a name for unknown IDs
# so callers can still tell when SanMar surfaces a new location.
WAREHOUSE_NAMES: dict[int, str] = {
    1: "Vancouver",
    2: "Mississauga",
    4: "Calgary",
}


class FutureStock(BaseModel):
    """Back-ordered / incoming-shipment row attached to a warehouse.

    SanMar emits these inside `futureAvailabilityArray.FutureAvailability`
    when there is replenishment scheduled. The TS layer parses the same
    `Quantity { value }` envelope we drill through here.
    """

    model_config = ConfigDict(populate_by_name=True)

    quantity: int = Field(alias="qty")
    expected_date: str = Field(default="", alias="availableOn")


class WarehouseLevel(BaseModel):
    """One warehouse's slice of an `InventoryResponse`.

    `warehouse_name` is computed from the well-known `WAREHOUSE_NAMES`
    table so callers don't carry the mapping around. Unknown warehouse
    IDs surface as `Location <id>` rather than blank.
    """

    model_config = ConfigDict(populate_by_name=True)

    warehouse_id: int = Field(alias="inventoryLocationId")
    quantity: int = Field(default=0, alias="qty")
    future_quantities: list[FutureStock] = Field(
        default_factory=list, alias="futureAvailability"
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def warehouse_name(self) -> str:
        return WAREHOUSE_NAMES.get(
            self.warehouse_id, f"Location {self.warehouse_id}"
        )


class InventoryResponse(BaseModel):
    """Normalized projection of `getInventoryLevels`.

    `total` is a computed_field that sums `locations[*].quantity` so the
    caller never has to do the math (and so we never disagree with
    ourselves about what "total stock" means).
    """

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="productId")
    color: Optional[str] = Field(default=None, alias="partColor")
    size: Optional[str] = Field(default=None, alias="labelSize")
    locations: list[WarehouseLevel] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total(self) -> int:
        return sum(loc.quantity for loc in self.locations)


# ── Pricing & Configuration v1.0.0 ─────────────────────────────────────


class PriceBreak(BaseModel):
    """One tier in the price ladder returned by `getConfigurationAndPricing`.

    `max_quantity` is `None` when the tier is open-ended (the last/top
    break, e.g. "72+"). Prices are stored as `Decimal` because
    round-tripping currency through `float` corrupts cents — pydantic v2
    accepts strings/numerics and coerces them to Decimal at validation.
    """

    model_config = ConfigDict(populate_by_name=True)

    min_quantity: int = Field(alias="minQuantity")
    max_quantity: Optional[int] = Field(default=None, alias="maxQuantity")
    price_cad: Decimal = Field(alias="price")


class PricingResponse(BaseModel):
    """Normalized projection of a `getConfigurationAndPricing` response."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="productId")
    color: Optional[str] = Field(default=None, alias="partColor")
    size: Optional[str] = Field(default=None, alias="labelSize")
    currency: str = Field(default="CAD")
    fob_id: str = Field(default="CUSTOMER", alias="fobId")
    breaks: list[PriceBreak] = Field(default_factory=list)
