"""Tests for the Phase 6 Typer CLI."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

from sanmar.cli import app
from sanmar.dto import (
    InventoryResponse,
    PriceBreak,
    PricingResponse,
    ProductResponse,
)


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


def test_app_help_returns_zero(runner: CliRunner) -> None:
    """The CLI must wire up — `--help` should exit 0 and list every
    subcommand. This is the cheapest possible smoke test."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    # Every subcommand should appear in the help output.
    for cmd in (
        "sync-catalog",
        "sync-inventory",
        "reconcile-orders",
        "product",
        "inventory",
        "pricing",
        "track",
        "invoice",
        "open-invoices",
        "health",
    ):
        assert cmd in result.stdout


def test_health_skips_with_placeholder_credentials(runner: CliRunner) -> None:
    """`health` is wired into CI; with no real creds it must skip
    (exit 0) rather than blow up the build."""
    # Default Settings() has empty customer_id / password — that's the
    # placeholder case the smoke check should detect.
    with patch("sanmar.cli.get_settings") as mock_get:
        mock_settings = MagicMock()
        mock_settings.customer_id = ""
        mock_settings.password = ""
        mock_get.return_value = mock_settings

        result = runner.invoke(app, ["health"])

    assert result.exit_code == 0
    assert "Placeholder" in result.stdout or "placeholder" in result.stdout


def test_product_subcommand_routes_to_product_data(
    runner: CliRunner,
) -> None:
    """The `product` subcommand must call ProductDataService.get_product
    with the user-supplied style/color/size."""
    fake = ProductResponse(
        style_number="PC54",
        brand_name="Port & Company",
        product_name="Core Tee",
        description="cotton",
        category="Tees",
        status="active",
        list_of_colors=["Black"],
        list_of_sizes=["L"],
    )

    with patch("sanmar.cli._orchestrator") as mock_orch_factory:
        mock_orch = MagicMock()
        mock_orch.product_data.get_product.return_value = fake
        mock_orch_factory.return_value = mock_orch

        result = runner.invoke(
            app, ["product", "PC54", "--color", "Black", "--size", "L"]
        )

    assert result.exit_code == 0, result.stdout
    mock_orch.product_data.get_product.assert_called_once_with(
        "PC54", color="Black", size="L"
    )
    # The brand should appear in the rich table output.
    assert "Port & Company" in result.stdout


def test_pricing_subcommand_renders_breaks(runner: CliRunner) -> None:
    """The `pricing` subcommand must hit PricingService.get_pricing
    and render every price break."""
    fake = PricingResponse(
        style_number="PC54",
        currency="CAD",
        breaks=[
            PriceBreak(min_quantity=1, max_quantity=11, price=12.50),
            PriceBreak(min_quantity=12, max_quantity=71, price=10.25),
            PriceBreak(min_quantity=72, max_quantity=None, price=8.00),
        ],
    )

    with patch("sanmar.cli._orchestrator") as mock_orch_factory:
        mock_orch = MagicMock()
        mock_orch.pricing.get_pricing.return_value = fake
        mock_orch_factory.return_value = mock_orch

        result = runner.invoke(app, ["pricing", "PC54"])

    assert result.exit_code == 0, result.stdout
    mock_orch.pricing.get_pricing.assert_called_once_with("PC54")
    # The "$8.00" tier (with the open-ended max) should render.
    assert "8.00" in result.stdout


def test_inventory_subcommand_renders_warehouses(
    runner: CliRunner,
) -> None:
    """`inventory <style>` must call InventoryService and show one
    row per warehouse."""
    fake = InventoryResponse(
        productId="PC54",
        locations=[
            {"inventoryLocationId": 1, "qty": 12},  # Vancouver
            {"inventoryLocationId": 2, "qty": 34},  # Mississauga
        ],
    )

    with patch("sanmar.cli._orchestrator") as mock_orch_factory:
        mock_orch = MagicMock()
        mock_orch.inventory.get_inventory_levels.return_value = fake
        mock_orch_factory.return_value = mock_orch

        result = runner.invoke(app, ["inventory", "PC54"])

    assert result.exit_code == 0, result.stdout
    mock_orch.inventory.get_inventory_levels.assert_called_once_with(
        "PC54", color=None, size=None
    )
    # The mock warehouses (Vancouver/Mississauga) should appear.
    assert "Vancouver" in result.stdout
    assert "Mississauga" in result.stdout
