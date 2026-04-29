"""SanMar PromoStandards Inventory Service v2.0.0 wrapper.

Reference: ``supabase/functions/_shared/sanmar/inventory.ts`` for the
parsing logic and the ``Quantity { value }`` envelope drill (the TS
layer carries a comment about this exact bug — we replicate the fix
here so the Python and TypeScript stacks behave identically).

SanMar Canada warehouse IDs
---------------------------
* ``1`` = Vancouver
* ``2`` = Mississauga
* ``4`` = Calgary

These IDs are stable per the published PDF; the names live in
``sanmar.dto.WAREHOUSE_NAMES`` so DTO and service stay aligned.
"""
from __future__ import annotations

from typing import Any, ClassVar, Optional

from sanmar.dto import (
    FutureStock,
    InventoryResponse,
    WarehouseLevel,
)
from sanmar.services.base import SanmarServiceBase


def _to_str(value: Any, default: str = "") -> str:
    """Coerce zeep's loosely-typed return values to ``str``."""
    if value is None:
        return default
    return str(value)


def _to_int(value: Any, default: int = 0) -> int:
    """Coerce a zeep-emitted scalar (str | int | None) to ``int``.

    PromoStandards returns numeric quantities as XML strings; zeep does
    not always know to coerce them when the WSDL declares ``xs:int``
    against a ``Quantity`` complex type. Be defensive."""
    if value is None:
        return default
    try:
        return int(str(value))
    except (TypeError, ValueError):
        try:
            return int(float(str(value)))
        except (TypeError, ValueError):
            return default


def _to_list(value: Any) -> list[Any]:
    """Coerce ``T | list[T] | None`` → ``list[T]``."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _get(obj: Any, *keys: str) -> Any:
    """Walk a chain of keys/attrs through a zeep-or-dict response."""
    for k in keys:
        if obj is None:
            return None
        if isinstance(obj, dict):
            obj = obj.get(k)
            continue
        obj = getattr(obj, k, None)
    return obj


def _drill_quantity(container: Any) -> int:
    """Drill into the ``inventoryLocationQuantity`` envelope.

    Wire shape::

        <inventoryLocationQuantity>
          <Quantity>
            <uom>EA</uom>
            <value>123</value>
          </Quantity>
        </inventoryLocationQuantity>

    After namespace stripping zeep / fast-xml-parser hand us::

        { "Quantity": { "uom": "EA", "value": "123" } }

    so we have to take **two hops** — first into ``Quantity``, then into
    ``value`` — to read the integer. The TS layer had a bug where it
    read ``container.value`` directly and got ``undefined``; we accept
    the inline form as a fallback for legacy stub fixtures."""
    if container is None:
        return 0
    inner = _get(container, "Quantity")
    if inner is None:
        inner = _get(container, "quantity")
    if inner is not None:
        # Two-hop happy path.
        v = _get(inner, "value")
        if v is None:
            v = _get(inner, "Value")
        if v is not None:
            return _to_int(v)
        # `inner` may itself be a numeric string in some stub fixtures.
        if isinstance(inner, (str, int, float)):
            return _to_int(inner)
    # Legacy/inline fallback: container holds `value` directly.
    v = _get(container, "value")
    if v is None:
        v = _get(container, "Value")
    if v is not None:
        return _to_int(v)
    if isinstance(container, (str, int, float)):
        return _to_int(container)
    return 0


class InventoryService(SanmarServiceBase):
    """Wrapper around the Inventory Service v2.0.0 endpoint."""

    # WSDL discovery path for Inventory v2 — the canonical SanMar URL is
    # ``inventory/v2/?wsdl``. The published TS layer points at the
    # PHP gateway directly (``inventory2.0/InventoryServiceV2.php``);
    # both paths resolve to the same WSDL on the SanMar edge.
    wsdl_path: ClassVar[str] = "inventory/v2/?wsdl"

    def get_inventory_levels(
        self,
        style_number: str,
        color: Optional[str] = None,
        size: Optional[str] = None,
    ) -> InventoryResponse:
        """Fetch live inventory for a style (optionally narrowed to a SKU).

        Returns an :class:`InventoryResponse` with per-warehouse
        quantities and any scheduled future availability. The
        ``InventoryResponse.total`` computed_field aggregates across
        warehouses so the caller doesn't have to."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "2.0.0",
            "productId": style_number,
        }
        if color is not None:
            params["partColor"] = color
        if size is not None:
            params["labelSize"] = size

        raw = self._call("getInventoryLevels", **params)
        return self._parse_inventory(raw, style_number, color, size)

    @staticmethod
    def _parse_inventory(
        raw: Any,
        fallback_style: str,
        color: Optional[str],
        size: Optional[str],
    ) -> InventoryResponse:
        """Project a zeep response into :class:`InventoryResponse`.

        Tolerates both attribute and key access so this also works
        against plain ``dict`` mocks in unit tests.
        """
        # The response root may be the operation envelope, an
        # `Inventory` element, or — in mocks — the bare dict. Normalize.
        inventory = (
            _get(raw, "Inventory")
            or _get(raw, "inventory")
            or raw
        )

        product_id = (
            _to_str(_get(inventory, "productId"))
            or _to_str(_get(raw, "productId"))
            or fallback_style
        )

        part_array = _get(inventory, "PartInventoryArray") or _get(
            inventory, "partInventoryArray"
        )
        part_nodes = _to_list(
            _get(part_array, "PartInventory")
            or _get(part_array, "partInventory")
        )

        # Aggregate locations across every part the response surfaces.
        # When the caller narrowed by color/size, this is typically a
        # single part; when they didn't, we sum per location across all
        # parts to give one rollup view.
        loc_by_id: dict[int, WarehouseLevel] = {}

        for p in part_nodes:
            loc_array = _get(p, "InventoryLocationArray") or _get(
                p, "inventoryLocationArray"
            )
            loc_nodes = _to_list(
                _get(loc_array, "InventoryLocation")
                or _get(loc_array, "inventoryLocation")
            )
            for loc in loc_nodes:
                loc_id = _to_int(_get(loc, "inventoryLocationId"))
                qty_container = _get(loc, "inventoryLocationQuantity") or _get(
                    loc, "InventoryLocationQuantity"
                )
                qty = _drill_quantity(qty_container)

                future_container = _get(loc, "futureAvailabilityArray") or _get(
                    loc, "FutureAvailabilityArray"
                )
                future_nodes = _to_list(
                    _get(future_container, "FutureAvailability")
                    or _get(future_container, "futureAvailability")
                )
                future_stocks: list[FutureStock] = []
                for f in future_nodes:
                    f_qty_container = _get(f, "Quantity") or _get(f, "quantity")
                    if f_qty_container is None:
                        # Some stubs emit `qty` inline.
                        f_qty = _to_int(_get(f, "qty"))
                    else:
                        f_qty = _drill_quantity({"Quantity": f_qty_container})
                    future_stocks.append(
                        FutureStock(
                            quantity=f_qty,
                            expected_date=_to_str(
                                _get(f, "availableOn")
                                or _get(f, "AvailableOn")
                            ),
                        )
                    )

                if loc_id in loc_by_id:
                    existing = loc_by_id[loc_id]
                    existing.quantity += qty
                    existing.future_quantities.extend(future_stocks)
                else:
                    loc_by_id[loc_id] = WarehouseLevel(
                        warehouse_id=loc_id,
                        quantity=qty,
                        future_quantities=future_stocks,
                    )

        locations = sorted(loc_by_id.values(), key=lambda l: l.warehouse_id)
        return InventoryResponse(
            style_number=product_id,
            color=color,
            size=size,
            locations=locations,
        )
