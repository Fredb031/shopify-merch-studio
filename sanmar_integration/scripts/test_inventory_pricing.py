"""Live smoke test for the Inventory v2.0.0 + Pricing v1.0.0 wrappers.

Runs one inventory call and one pricing call against the configured
SanMar environment (default UAT). Prints green ✓ / red ✗ per call.
Skips silently with exit 0 when credentials are still the placeholders
from `.env.example` so this is safe to run in CI.

Usage::

    python -m scripts.test_inventory_pricing
"""
from __future__ import annotations

import sys
from typing import Callable

from rich.console import Console
from rich.table import Table

from sanmar.config import get_settings
from sanmar.dto import InventoryResponse, PricingResponse
from sanmar.services.inventory import InventoryService
from sanmar.services.pricing import PricingService

console = Console()


PLACEHOLDER_VALUES = {"", "your_edi_password", "your_customer_id"}


def _is_placeholder(s: str) -> bool:
    return s.strip() in PLACEHOLDER_VALUES


def _run(label: str, fn: Callable[[], object]) -> bool:
    try:
        result = fn()
    except Exception as exc:  # noqa: BLE001 - smoke test, surface anything
        console.print(f"[red]✗[/red] {label}: {type(exc).__name__}: {exc}")
        return False

    if isinstance(result, InventoryResponse):
        table = Table(title=f"Inventory — {result.style_number}")
        table.add_column("Warehouse")
        table.add_column("ID", justify="right")
        table.add_column("Qty", justify="right")
        table.add_column("Future")
        for loc in result.locations:
            future_str = ", ".join(
                f"{f.quantity}@{f.expected_date}" for f in loc.future_quantities
            ) or "—"
            table.add_row(
                loc.warehouse_name,
                str(loc.warehouse_id),
                str(loc.quantity),
                future_str,
            )
        console.print(f"[green]✓[/green] {label}: total={result.total}")
        console.print(table)
    elif isinstance(result, PricingResponse):
        table = Table(
            title=f"Pricing — {result.style_number} ({result.currency})"
        )
        table.add_column("Min Qty", justify="right")
        table.add_column("Max Qty", justify="right")
        table.add_column("Price (CAD)", justify="right")
        for b in result.breaks:
            table.add_row(
                str(b.min_quantity),
                str(b.max_quantity if b.max_quantity is not None else "+"),
                f"{b.price_cad:.2f}",
            )
        console.print(f"[green]✓[/green] {label}: {len(result.breaks)} breaks")
        console.print(table)
    else:
        console.print(f"[green]✓[/green] {label}: {result!r}")
    return True


def main() -> int:
    settings = get_settings()
    if _is_placeholder(settings.password) or _is_placeholder(
        settings.customer_id
    ):
        console.print(
            "[yellow]Credentials not set, skipping live test[/yellow]"
        )
        return 0

    console.print(
        f"[bold]SanMar Phase 3 smoke test[/bold] — env={settings.env} "
        f"base_url={settings.base_url}"
    )

    inv = InventoryService(settings)
    pricing = PricingService(settings)

    ok = True
    ok &= _run(
        "get_inventory_levels('117023')",
        lambda: inv.get_inventory_levels("117023"),
    )
    ok &= _run(
        "get_pricing('411092', size='31516-1')",
        lambda: pricing.get_pricing("411092", size="31516-1"),
    )

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
