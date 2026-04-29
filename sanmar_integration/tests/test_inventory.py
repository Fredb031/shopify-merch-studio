"""Unit tests for the Inventory v2.0.0 wrapper.

These tests fully mock the zeep client. The fixtures emulate the
namespace-stripped dict shape that zeep / fast-xml-parser produce
against the live WSDL — including the ``Quantity { value }`` envelope
the TS layer carries a bug-fix comment about.
"""
from __future__ import annotations

from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import InventoryResponse, WarehouseLevel
from sanmar.services.base import SanmarApiError
from sanmar.services.inventory import InventoryService


# ── Fixtures ───────────────────────────────────────────────────────────


@pytest.fixture
def settings() -> Settings:
    return Settings(
        customer_id="cust-123",
        password="secret-pw",
        media_password="media-pw",
        env="uat",
    )


@pytest.fixture
def service(settings: Settings) -> InventoryService:
    return InventoryService(settings)


# ── Canned responses ───────────────────────────────────────────────────


def _single_warehouse_response() -> dict:
    """One part, one warehouse (Vancouver), no future stock."""
    return {
        "Inventory": {
            "productId": "117023",
            "PartInventoryArray": {
                "PartInventory": {
                    "partId": "117023-Black-M",
                    "partColor": "Black",
                    "labelSize": "M",
                    "InventoryLocationArray": {
                        "InventoryLocation": {
                            "inventoryLocationId": "1",
                            "inventoryLocationQuantity": {
                                "Quantity": {"uom": "EA", "value": "42"}
                            },
                        }
                    },
                }
            },
        }
    }


def _multi_warehouse_response() -> dict:
    """One part, three warehouses with mixed quantities."""
    return {
        "Inventory": {
            "productId": "117023",
            "PartInventoryArray": {
                "PartInventory": {
                    "partId": "117023-Black-L",
                    "partColor": "Black",
                    "labelSize": "L",
                    "InventoryLocationArray": {
                        "InventoryLocation": [
                            {
                                "inventoryLocationId": "1",
                                "inventoryLocationQuantity": {
                                    "Quantity": {"uom": "EA", "value": "10"}
                                },
                            },
                            {
                                "inventoryLocationId": "2",
                                "inventoryLocationQuantity": {
                                    "Quantity": {"uom": "EA", "value": "25"}
                                },
                            },
                            {
                                "inventoryLocationId": "4",
                                "inventoryLocationQuantity": {
                                    "Quantity": {"uom": "EA", "value": "7"}
                                },
                            },
                        ]
                    },
                }
            },
        }
    }


def _response_with_future_availability() -> dict:
    return {
        "Inventory": {
            "productId": "117023",
            "PartInventoryArray": {
                "PartInventory": {
                    "partId": "117023-Black-M",
                    "partColor": "Black",
                    "labelSize": "M",
                    "InventoryLocationArray": {
                        "InventoryLocation": {
                            "inventoryLocationId": "2",
                            "inventoryLocationQuantity": {
                                "Quantity": {"uom": "EA", "value": "5"}
                            },
                            "futureAvailabilityArray": {
                                "FutureAvailability": [
                                    {
                                        "Quantity": {"value": "100"},
                                        "availableOn": "2026-05-15",
                                    },
                                    {
                                        "Quantity": {"value": "200"},
                                        "availableOn": "2026-06-01",
                                    },
                                ]
                            },
                        }
                    },
                }
            },
        }
    }


# ── Tests ──────────────────────────────────────────────────────────────


def test_get_inventory_levels_parses_single_warehouse(
    service: InventoryService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getInventoryLevels.return_value = (
        _single_warehouse_response()
    )

    with patch.object(
        InventoryService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_inventory_levels("117023", color="Black", size="M")

    assert isinstance(result, InventoryResponse)
    assert result.style_number == "117023"
    assert result.color == "Black"
    assert result.size == "M"
    assert len(result.locations) == 1

    loc = result.locations[0]
    assert isinstance(loc, WarehouseLevel)
    assert loc.warehouse_id == 1
    assert loc.warehouse_name == "Vancouver"
    assert loc.quantity == 42
    assert loc.future_quantities == []

    # Auth + filter params propagated.
    kwargs = mock_client.service.getInventoryLevels.call_args.kwargs
    assert kwargs["id"] == "cust-123"
    assert kwargs["password"] == "secret-pw"
    assert kwargs["productId"] == "117023"
    assert kwargs["partColor"] == "Black"
    assert kwargs["labelSize"] == "M"
    assert kwargs["wsVersion"] == "2.0.0"


def test_get_inventory_levels_parses_multi_warehouse(
    service: InventoryService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getInventoryLevels.return_value = (
        _multi_warehouse_response()
    )

    with patch.object(
        InventoryService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_inventory_levels("117023")

    assert len(result.locations) == 3
    by_id = {loc.warehouse_id: loc for loc in result.locations}
    assert by_id[1].warehouse_name == "Vancouver"
    assert by_id[1].quantity == 10
    assert by_id[2].warehouse_name == "Mississauga"
    assert by_id[2].quantity == 25
    assert by_id[4].warehouse_name == "Calgary"
    assert by_id[4].quantity == 7


def test_get_inventory_levels_handles_missing_future_array(
    service: InventoryService,
) -> None:
    """A warehouse with no scheduled replenishment must yield an empty
    `future_quantities` list, not raise on missing keys."""
    mock_client = MagicMock()
    mock_client.service.getInventoryLevels.return_value = (
        _single_warehouse_response()
    )

    with patch.object(
        InventoryService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_inventory_levels("117023")

    assert result.locations[0].future_quantities == []


def test_get_inventory_levels_drills_quantity_value(
    service: InventoryService,
) -> None:
    """Critical regression test for the TS-layer bug where the parser
    read `inventoryLocationQuantity.value` directly instead of drilling
    through `Quantity` first. The mock here ONLY exposes the value via
    the two-hop `Quantity.value` path; if the parser tried to read
    `.value` at the outer level it would get None and we'd see qty=0."""
    mock_client = MagicMock()
    mock_client.service.getInventoryLevels.return_value = {
        "Inventory": {
            "productId": "117023",
            "PartInventoryArray": {
                "PartInventory": {
                    "partId": "117023-Red-S",
                    "InventoryLocationArray": {
                        "InventoryLocation": {
                            "inventoryLocationId": "4",
                            # NB: `value` lives ONLY inside Quantity.
                            "inventoryLocationQuantity": {
                                "Quantity": {"uom": "EA", "value": "999"}
                            },
                        }
                    },
                }
            },
        }
    }

    with patch.object(
        InventoryService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_inventory_levels("117023")

    assert len(result.locations) == 1
    assert result.locations[0].warehouse_id == 4
    assert result.locations[0].quantity == 999, (
        "Parser failed to drill Quantity.value — "
        "this is the TS-layer bug we're guarding against."
    )


def test_get_inventory_levels_parses_future_availability(
    service: InventoryService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getInventoryLevels.return_value = (
        _response_with_future_availability()
    )

    with patch.object(
        InventoryService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_inventory_levels("117023")

    loc = result.locations[0]
    assert loc.warehouse_id == 2
    assert loc.warehouse_name == "Mississauga"
    assert loc.quantity == 5
    assert len(loc.future_quantities) == 2
    assert loc.future_quantities[0].quantity == 100
    assert loc.future_quantities[0].expected_date == "2026-05-15"
    assert loc.future_quantities[1].quantity == 200
    assert loc.future_quantities[1].expected_date == "2026-06-01"


def test_inventory_response_total_sums_locations() -> None:
    """The `total` computed_field must reflect a fresh sum every read."""
    resp = InventoryResponse(
        style_number="117023",
        color="Black",
        size="M",
        locations=[
            WarehouseLevel(warehouse_id=1, quantity=10),
            WarehouseLevel(warehouse_id=2, quantity=25),
            WarehouseLevel(warehouse_id=4, quantity=7),
        ],
    )
    assert resp.total == 42

    # Empty inventory → total is 0, never raises.
    empty = InventoryResponse(style_number="X")
    assert empty.total == 0


def test_inventory_fault_maps_to_sanmar_api_error(
    service: InventoryService,
) -> None:
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    mock_client = MagicMock()
    mock_client.service.getInventoryLevels.side_effect = FakeFault(
        "Auth failed", code="100"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        InventoryService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.get_inventory_levels("117023")

    err = exc_info.value
    assert err.code == "100"
    assert err.operation == "getInventoryLevels"
    assert "Auth failed" in err.message
