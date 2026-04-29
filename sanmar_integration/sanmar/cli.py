"""Typer-based CLI for the SanMar integration (Phase 6).

Wraps every public service method and orchestrator workflow behind a
single `python -m sanmar` entry point with rich-formatted output. Use
``sanmar --help`` to discover commands.

Design notes
------------
* Each subcommand opens its own :class:`Settings` + service instance,
  so failures in one don't poison another.
* Network-touching commands print a friendly message and exit 0 when
  credentials are placeholders, rather than blowing up with a SOAP
  fault. This is what makes the ``health`` subcommand safe to wire
  into a CI smoke test.
* All tabular output uses :class:`rich.table.Table`; long syncs use
  :class:`rich.progress.Progress` so operators see motion.
"""
from __future__ import annotations

from datetime import date as date_cls, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from sanmar.config import Settings, get_settings
from sanmar.exceptions import SanmarApiError
from sanmar.orchestrator import SanmarOrchestrator

app = typer.Typer(
    name="sanmar",
    help="SanMar Canada PromoStandards CLI — wraps all 8 services + orchestrator.",
    no_args_is_help=True,
    add_completion=False,
)

console = Console()

# Style number used by the `health` smoke check. NF0A529K is the
# canonical ATC Pro Tee — has stock in all warehouses, has a price
# ladder, has imagery, and is cheap to query.
HEALTH_PROBE_STYLE: str = "NF0A529K"


def _credentials_present(settings: Settings) -> bool:
    """Return True when settings carry non-placeholder creds.

    Placeholders are empty strings or anything starting with ``cust-``
    / ``secret-`` (the patterns used by Pydantic test fixtures).
    """
    if not settings.customer_id or not settings.password:
        return False
    if settings.customer_id.startswith("cust-"):
        return False
    if settings.password.startswith("secret-"):
        return False
    return True


def _orchestrator() -> SanmarOrchestrator:
    """Build the orchestrator from cached settings — one place to
    monkeypatch in tests."""
    return SanmarOrchestrator(get_settings())


# ── catalog ────────────────────────────────────────────────────────────


@app.command("sync-catalog")
def sync_catalog(
    full: bool = typer.Option(
        False, "--full", help="Run a full catalog walk (slow, weekly)."
    ),
    delta: bool = typer.Option(
        False, "--delta", help="Run an incremental delta sync (fast, nightly)."
    ),
    since: Optional[str] = typer.Option(
        None, "--since", help="ISO date (YYYY-MM-DD) for delta start."
    ),
) -> None:
    """Sync the local catalog. Pick exactly one of --full / --delta."""
    if full and delta:
        console.print("[red]Pick exactly one of --full / --delta.[/red]")
        raise typer.Exit(code=2)
    if not full and not delta:
        console.print("[yellow]Defaulting to --delta.[/yellow]")
        delta = True

    orch = _orchestrator()
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        if full:
            task = progress.add_task("Walking full catalog…", total=None)
            try:
                result = orch.sync_catalog_full()
            except SanmarApiError as e:
                console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
                raise typer.Exit(code=1) from None
            progress.remove_task(task)
        else:
            since_dt = (
                datetime.fromisoformat(since)
                if since
                else datetime.now(tz=timezone.utc) - timedelta(days=1)
            )
            task = progress.add_task(
                f"Pulling delta since {since_dt.date()}…", total=None
            )
            try:
                result = orch.sync_catalog_delta(since_dt)
            except SanmarApiError as e:
                console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
                raise typer.Exit(code=1) from None
            progress.remove_task(task)

    table = Table(title="Catalog sync result")
    table.add_column("metric")
    table.add_column("value", justify="right")
    table.add_row("success", str(result.success_count))
    table.add_row("errors", str(result.error_count))
    table.add_row("products seen", str(result.products_seen))
    table.add_row("duration ms", str(result.duration_ms))
    if result.window_end:
        table.add_row("window end", result.window_end.isoformat())
    console.print(table)


# ── inventory ──────────────────────────────────────────────────────────


@app.command("sync-inventory")
def sync_inventory(
    limit: Optional[int] = typer.Option(
        None, "--limit", help="Cap distinct styles processed (smoke test)."
    ),
) -> None:
    """Refresh inventory snapshots for every active SKU in the local DB."""
    from sanmar.config import get_settings as _gs
    from sanmar.db import make_engine, session_scope

    orch = _orchestrator()
    settings = _gs()

    engine = make_engine(settings.db_path)
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("Walking active SKUs…", total=None)
        with session_scope(engine) as session:
            try:
                result = orch.sync_inventory_for_active_skus(
                    session, limit=limit
                )
            except SanmarApiError as e:
                console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
                raise typer.Exit(code=1) from None
        progress.remove_task(task)

    table = Table(title="Inventory sync result")
    table.add_column("metric")
    table.add_column("value", justify="right")
    table.add_row("success", str(result.success_count))
    table.add_row("errors", str(result.error_count))
    table.add_row("snapshots written", str(result.snapshots_written))
    table.add_row("duration ms", str(result.duration_ms))
    console.print(table)


# ── orders ─────────────────────────────────────────────────────────────


@app.command("reconcile-orders")
def reconcile_orders() -> None:
    """Reconcile local OrderRow.is_open against SanMar status."""
    from sanmar.config import get_settings as _gs
    from sanmar.db import make_engine, session_scope

    orch = _orchestrator()
    settings = _gs()
    engine = make_engine(settings.db_path)

    with session_scope(engine) as session:
        try:
            result = orch.reconcile_open_orders(session)
        except SanmarApiError as e:
            console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
            raise typer.Exit(code=1) from None

    table = Table(title="Order reconciliation result")
    table.add_column("metric")
    table.add_column("value", justify="right")
    table.add_row("success", str(result.success_count))
    table.add_row("errors", str(result.error_count))
    table.add_row("transitions", str(result.transitions))
    table.add_row("duration ms", str(result.duration_ms))
    console.print(table)


# ── product ────────────────────────────────────────────────────────────


@app.command("product")
def product(
    style: str = typer.Argument(..., help="SanMar style number, e.g. NF0A529K"),
    color: Optional[str] = typer.Option(None, "--color", help="Filter by color"),
    size: Optional[str] = typer.Option(None, "--size", help="Filter by size"),
) -> None:
    """Fetch and pretty-print a product."""
    orch = _orchestrator()
    try:
        prod = orch.product_data.get_product(style, color=color, size=size)
    except SanmarApiError as e:
        console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
        raise typer.Exit(code=1) from None

    table = Table(title=f"Product {prod.style_number}")
    table.add_column("field")
    table.add_column("value")
    table.add_row("brand", prod.brand_name)
    table.add_row("name", prod.product_name)
    table.add_row("category", prod.category)
    table.add_row("status", prod.status)
    table.add_row("colors", ", ".join(prod.list_of_colors) or "—")
    table.add_row("sizes", ", ".join(prod.list_of_sizes) or "—")
    if prod.image_url:
        table.add_row("image", prod.image_url)
    console.print(table)


# ── inventory single ───────────────────────────────────────────────────


@app.command("inventory")
def inventory_cmd(
    style: str = typer.Argument(..., help="SanMar style number"),
    color: Optional[str] = typer.Option(None, "--color"),
    size: Optional[str] = typer.Option(None, "--size"),
) -> None:
    """Pretty-print the warehouse breakdown for a style."""
    orch = _orchestrator()
    try:
        inv = orch.inventory.get_inventory_levels(style, color=color, size=size)
    except SanmarApiError as e:
        console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
        raise typer.Exit(code=1) from None

    table = Table(title=f"Inventory {inv.style_number} (total {inv.total})")
    table.add_column("warehouse")
    table.add_column("qty", justify="right")
    table.add_column("future")
    for loc in inv.locations:
        future = ", ".join(
            f"{f.quantity}@{f.expected_date}" for f in loc.future_quantities
        )
        table.add_row(loc.warehouse_name, str(loc.quantity), future or "—")
    console.print(table)


# ── pricing ────────────────────────────────────────────────────────────


@app.command("pricing")
def pricing_cmd(
    style: str = typer.Argument(..., help="SanMar style number"),
) -> None:
    """Pretty-print the CAD price ladder."""
    orch = _orchestrator()
    try:
        price = orch.pricing.get_pricing(style)
    except SanmarApiError as e:
        console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
        raise typer.Exit(code=1) from None

    table = Table(title=f"Pricing {price.style_number} ({price.currency})")
    table.add_column("min qty", justify="right")
    table.add_column("max qty", justify="right")
    table.add_column("price", justify="right")
    for br in price.breaks:
        table.add_row(
            str(br.min_quantity),
            "∞" if br.max_quantity is None else str(br.max_quantity),
            f"${br.price_cad:.2f}",
        )
    console.print(table)


# ── tracking ───────────────────────────────────────────────────────────


@app.command("track")
def track(
    po: str = typer.Argument(..., help="SanMar PO number"),
) -> None:
    """Pretty-print tracking info for a PO."""
    orch = _orchestrator()
    try:
        tracking = orch.shipment.get_tracking_info(po)
    except SanmarApiError as e:
        console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
        raise typer.Exit(code=1) from None

    if not tracking:
        console.print(f"[yellow]No tracking yet for {po}.[/yellow]")
        return

    table = Table(title=f"Tracking {po}")
    table.add_column("carrier")
    table.add_column("tracking #")
    table.add_column("ship date")
    for t in tracking:
        table.add_row(
            t.carrier or "—",
            t.tracking_number or "—",
            t.ship_date.isoformat() if t.ship_date else "—",
        )
    console.print(table)


# ── invoices ───────────────────────────────────────────────────────────


@app.command("invoice")
def invoice_cmd(
    number: str = typer.Argument(..., help="Invoice number"),
) -> None:
    """Fetch and format a single invoice."""
    orch = _orchestrator()
    try:
        inv = orch.invoice.get_invoice(number)
    except SanmarApiError as e:
        console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
        raise typer.Exit(code=1) from None

    table = Table(title=f"Invoice {inv.invoice_number}")
    table.add_column("field")
    table.add_column("value")
    table.add_row("po", inv.po_number)
    table.add_row(
        "invoice date", inv.invoice_date.isoformat() if inv.invoice_date else "—"
    )
    table.add_row("due date", inv.due_date.isoformat() if inv.due_date else "—")
    table.add_row("subtotal", f"${inv.subtotal:.2f}")
    table.add_row("tax", f"${inv.tax:.2f}")
    table.add_row("shipping", f"${inv.shipping:.2f}")
    table.add_row("total", f"${inv.total:.2f}")
    table.add_row("balance due", f"${inv.balance_due:.2f}")
    table.add_row("status", inv.status)
    console.print(table)


@app.command("open-invoices")
def open_invoices(
    days: int = typer.Option(30, "--days", help="Lookback window in days."),
) -> None:
    """List open invoices since N days ago."""
    orch = _orchestrator()
    since = datetime.now(tz=timezone.utc) - timedelta(days=days)
    try:
        invoices = orch.invoice.get_open_invoices(since=since)
    except SanmarApiError as e:
        console.print(f"[red]SOAP error: {e.code} {e.message}[/red]")
        raise typer.Exit(code=1) from None

    if not invoices:
        console.print(f"[green]No open invoices in the last {days} days.[/green]")
        return

    total_due = sum((inv.balance_due for inv in invoices), Decimal("0"))
    table = Table(
        title=f"Open invoices (last {days}d) — total balance ${total_due:.2f}"
    )
    table.add_column("number")
    table.add_column("po")
    table.add_column("due", justify="right")
    table.add_column("balance", justify="right")
    table.add_column("status")
    for inv in invoices:
        table.add_row(
            inv.invoice_number,
            inv.po_number,
            inv.due_date.isoformat() if inv.due_date else "—",
            f"${inv.balance_due:.2f}",
            inv.status,
        )
    console.print(table)


# ── health ─────────────────────────────────────────────────────────────


@app.command("health")
def health() -> None:
    """Smoke-check product / inventory / pricing for one known SKU.

    Skips gracefully (exit 0) when credentials are placeholders so
    this is safe to run from CI as a build-gate.
    """
    settings = get_settings()
    if not _credentials_present(settings):
        console.print(
            "[yellow]Placeholder credentials detected — skipping smoke "
            "check (set SANMAR_CUSTOMER_ID / SANMAR_PASSWORD to run).[/yellow]"
        )
        return

    orch = SanmarOrchestrator(settings)
    table = Table(title=f"Health check ({HEALTH_PROBE_STYLE})")
    table.add_column("service")
    table.add_column("status")
    table.add_column("detail")

    checks: list[tuple[str, callable]] = [
        ("product_data", lambda: orch.product_data.get_product(HEALTH_PROBE_STYLE)),
        ("inventory", lambda: orch.inventory.get_inventory_levels(HEALTH_PROBE_STYLE)),
        ("pricing", lambda: orch.pricing.get_pricing(HEALTH_PROBE_STYLE)),
    ]
    any_red = False
    for name, fn in checks:
        try:
            fn()
            table.add_row(name, "[green]green[/green]", "ok")
        except SanmarApiError as e:
            any_red = True
            table.add_row(name, "[red]red[/red]", f"{e.code}: {e.message}")
        except Exception as e:  # noqa: BLE001
            any_red = True
            table.add_row(name, "[red]red[/red]", str(e))

    console.print(table)
    if any_red:
        raise typer.Exit(code=1)


# ── observability ──────────────────────────────────────────────────────


@app.command("metrics")
def metrics_cmd(
    host: Optional[str] = typer.Option(
        None,
        "--host",
        help="Bind host (default 0.0.0.0, overridable via EXPORTER_HOST).",
    ),
    port: Optional[int] = typer.Option(
        None,
        "--port",
        help="Bind port (default 9100, overridable via EXPORTER_PORT).",
    ),
) -> None:
    """Start the Prometheus exporter on the configured port (Phase 8).

    Long-running — designed to live under ``sanmar-exporter.service``
    on the production box. Ctrl-C or SIGTERM stops it cleanly.
    """
    from sanmar.exporter_app import serve_forever

    serve_forever(host=host, port=port)


if __name__ == "__main__":  # pragma: no cover
    app()
