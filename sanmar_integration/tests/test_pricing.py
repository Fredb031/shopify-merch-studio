"""Unit tests for the Pricing & Configuration v1.0.0 wrapper.

Mocks the zeep client end-to-end. Verifies that prices are surfaced as
:class:`decimal.Decimal` (never ``float``) so cents stay precise, and
that the standing CAD/CUSTOMER/BLANK parameter set rides on every
call."""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import PriceBreak, PricingResponse
from sanmar.services.base import SanmarApiError
from sanmar.services.pricing import PricingService


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
def service(settings: Settings) -> PricingService:
    return PricingService(settings)


# ── Canned responses ───────────────────────────────────────────────────


def _single_break_response() -> dict:
    """One part, one tier (qty 1+, $19.99)."""
    return {
        "Configuration": {
            "productId": "411092",
            "currency": "CAD",
            "fobId": "CUSTOMER",
            "PartArray": {
                "Part": {
                    "partId": "411092(Black,31516-1,)",
                    "PartPriceArray": {
                        "PartPrice": {
                            "minQuantity": "1",
                            "price": "19.99",
                        }
                    },
                }
            },
        }
    }


def _multi_break_response() -> dict:
    """Classic four-tier ladder: 1-11 / 12-23 / 24-71 / 72+."""
    return {
        "Configuration": {
            "productId": "411092",
            "currency": "CAD",
            "fobId": "CUSTOMER",
            "PartArray": {
                "Part": {
                    "partId": "411092(Black,31516-1,)",
                    "PartPriceArray": {
                        "PartPrice": [
                            {
                                "minQuantity": "1",
                                "maxQuantity": "11",
                                "price": "24.99",
                            },
                            {
                                "minQuantity": "12",
                                "maxQuantity": "23",
                                "price": "22.49",
                            },
                            {
                                "minQuantity": "24",
                                "maxQuantity": "71",
                                "price": "19.99",
                            },
                            # Final tier — open ended, no maxQuantity
                            {"minQuantity": "72", "price": "17.49"},
                        ]
                    },
                }
            },
        }
    }


# ── Tests ──────────────────────────────────────────────────────────────


def test_get_pricing_parses_single_break(service: PricingService) -> None:
    mock_client = MagicMock()
    mock_client.service.getConfigurationAndPricing.return_value = (
        _single_break_response()
    )

    with patch.object(
        PricingService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_pricing(
            "411092", color="Black", size="31516-1"
        )

    assert isinstance(result, PricingResponse)
    assert result.style_number == "411092"
    assert result.color == "Black"
    assert result.size == "31516-1"
    assert result.currency == "CAD"
    assert result.fob_id == "CUSTOMER"
    assert len(result.breaks) == 1

    only = result.breaks[0]
    assert only.min_quantity == 1
    assert only.max_quantity is None
    assert only.price_cad == Decimal("19.99")

    # Standing parameter set rides on every call.
    kwargs = mock_client.service.getConfigurationAndPricing.call_args.kwargs
    assert kwargs["currency"] == "CAD"
    assert kwargs["fobId"] == "CUSTOMER"
    assert kwargs["priceType"] == "BLANK"
    assert kwargs["localizationCountry"] == "CA"
    assert kwargs["localizationLanguage"] == "EN"
    assert kwargs["productId"] == "411092"
    assert kwargs["partColor"] == "Black"
    assert kwargs["labelSize"] == "31516-1"
    assert kwargs["wsVersion"] == "1.0.0"


def test_get_pricing_parses_multi_break_ladder(service: PricingService) -> None:
    mock_client = MagicMock()
    mock_client.service.getConfigurationAndPricing.return_value = (
        _multi_break_response()
    )

    with patch.object(
        PricingService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_pricing("411092")

    assert len(result.breaks) == 4

    # Sorted ascending by min_quantity.
    qtys = [(b.min_quantity, b.max_quantity) for b in result.breaks]
    assert qtys == [(1, 11), (12, 23), (24, 71), (72, None)]

    prices = [b.price_cad for b in result.breaks]
    assert prices == [
        Decimal("24.99"),
        Decimal("22.49"),
        Decimal("19.99"),
        Decimal("17.49"),
    ]


def test_price_break_is_decimal_not_float(service: PricingService) -> None:
    """Prices MUST be Decimal — round-tripping through float corrupts
    cents (the canonical 0.1 + 0.2 != 0.3 problem)."""
    mock_client = MagicMock()
    mock_client.service.getConfigurationAndPricing.return_value = (
        _single_break_response()
    )

    with patch.object(
        PricingService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_pricing("411092")

    price = result.breaks[0].price_cad
    assert isinstance(price, Decimal)
    assert not isinstance(price, float)
    # Exactly 19.99 — no float drift.
    assert str(price) == "19.99"

    # Direct DTO construction also lands as Decimal.
    direct = PriceBreak(min_quantity=1, max_quantity=None, price_cad="0.1")
    assert isinstance(direct.price_cad, Decimal)
    assert direct.price_cad == Decimal("0.1")


def test_get_pricing_max_quantity_none_for_open_ended_tier(
    service: PricingService,
) -> None:
    """The top tier in a ladder ('72+') has no `maxQuantity` — must
    surface as `None`, not 0."""
    mock_client = MagicMock()
    mock_client.service.getConfigurationAndPricing.return_value = (
        _multi_break_response()
    )

    with patch.object(
        PricingService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_pricing("411092")

    top = result.breaks[-1]
    assert top.min_quantity == 72
    assert top.max_quantity is None
    assert top.price_cad == Decimal("17.49")


def test_pricing_fault_maps_to_sanmar_api_error(
    service: PricingService,
) -> None:
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    mock_client = MagicMock()
    mock_client.service.getConfigurationAndPricing.side_effect = FakeFault(
        "Bad partId", code="115"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        PricingService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.get_pricing("411092")

    err = exc_info.value
    assert err.code == "115"
    assert err.operation == "getConfigurationAndPricing"
    assert "Bad partId" in err.message
