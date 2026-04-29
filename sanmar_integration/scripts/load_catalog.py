"""CLI: load the SanMar master catalog XLSX into local SQLite."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rich.console import Console
from rich.table import Table

from sanmar.catalog.loader import load_catalog
from sanmar.catalog.store import persist_catalog
from sanmar.config import get_settings
from sanmar.db import init_schema, make_engine, session_scope

console = Console()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="sanmar-load-catalog",
        description="Load the SanMar master catalog XLSX into local SQLite.",
    )
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=None,
        help="Path to master catalog XLSX (defaults to SANMAR_CATALOG_XLSX).",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to local SQLite DB (defaults to SANMAR_DB_PATH).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    settings = get_settings()
    xlsx_path: Path = args.xlsx or settings.catalog_xlsx
    db_path: Path = args.db or settings.db_path

    console.rule("[bold cyan]SanMar — Phase 1 catalog loader")
    console.print(f"[dim]XLSX:[/dim] {xlsx_path}")
    console.print(f"[dim]DB:  [/dim] {db_path}")

    engine = make_engine(db_path)
    init_schema(engine)

    try:
        with console.status("[bold green]Reading XLSX…", spinner="dots"):
            df = load_catalog(xlsx_path)
    except FileNotFoundError as e:
        console.print(f"[bold red]ERROR:[/bold red] {e}")
        return 2

    console.print(f"[green]✓[/green] Loaded [bold]{len(df):,}[/bold] rows")

    with session_scope(engine) as session:
        with console.status("[bold green]Upserting into SQLite…", spinner="dots"):
            counts = persist_catalog(df, session)

    table = Table(title="Catalog persisted", show_header=True, header_style="bold magenta")
    table.add_column("Entity", style="cyan")
    table.add_column("Rows", justify="right", style="green")
    for k in ("brands", "products", "variants", "rows_processed"):
        table.add_row(k, f"{counts[k]:,}")
    console.print(table)
    return 0


if __name__ == "__main__":
    sys.exit(main())
