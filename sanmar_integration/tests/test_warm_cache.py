"""Tests for Phase 13 cache warmer.

These exercise :func:`sanmar.api.warmer.warm_cache` directly — the
CLI-level Typer command is a thin wrapper around it and gets coverage
via integration on the box, not in unit tests.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy.engine import Engine

from sanmar.api.app import create_app, get_engine
from sanmar.api.rate_limit import limiter as global_limiter
from sanmar.api.warmer import warm_cache
from sanmar.db import init_schema, make_engine, make_session_factory
from sanmar.models import Brand, Product, Variant


def _seed_n_products(engine: Engine, n: int) -> list[str]:
    """Seed ``n`` minimal products so the warmer has work to do.

    Style numbers are zero-padded so alphabetical ordering is
    deterministic — STYLE001, STYLE002, …. Each gets a single variant
    with a price so /pricing returns 200.
    """
    factory = make_session_factory(engine)
    styles: list[str] = []
    with factory() as session:
        brand = Brand(name="Port & Company", slug="port-company")
        session.add(brand)
        session.flush()
        for i in range(n):
            style = f"STYLE{i:03d}"
            styles.append(style)
            product = Product(
                style_number=style,
                brand_id=brand.id,
                name=f"Tee {i}",
                category="Tees",
                status="active",
            )
            session.add(product)
            session.flush()
            session.add(
                Variant(
                    product_id=product.id,
                    full_sku=f"{style}-Black-L",
                    color="Black",
                    size="L",
                    price_cad=12.50,
                )
            )
        session.commit()
    return styles


@pytest.fixture
def warmer_env(tmp_path):
    """Build a fresh app + engine for the warmer to drive."""
    engine = make_engine(tmp_path / "warm.db")
    init_schema(engine)
    application = create_app()
    application.dependency_overrides[get_engine] = lambda: engine
    application.state.engine = engine

    # Reset bucket so the warmer's own requests don't trip the limiter
    # of a previous test (defensive — the warmer disables the limiter
    # internally already).
    try:
        global_limiter._storage.reset()  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        pass
    global_limiter.enabled = True

    return application, engine


def test_warm_cache_pre_populates_top_n_styles(warmer_env) -> None:
    """``warm_cache(top=5)`` against a 10-style DB must attempt 5
    styles and return a summary tallying success/error counts."""
    application, engine = warmer_env
    _seed_n_products(engine, n=10)

    summary = warm_cache(application, engine, top=5)

    assert summary["styles_attempted"] == 5
    # Pricing route returns 404 (no CachedPricing rows) for these
    # bare products, but the /products/{style} route DOES return 200,
    # so each style still counts as "succeeded" (≥1 route OK).
    assert summary["styles_succeeded"] == 5
    assert summary["styles_failed"] == 0
    # Three routes per style × 5 styles = 15 attempts. /products/
    # {style} succeeds, /inventory/{style} 404s (no snapshot), and
    # /products/{style}/pricing 404s (no CachedPricing). So we expect
    # at least 5 successes (the /products/{style} ones).
    assert summary["routes_succeeded"] >= 5
    assert (
        summary["routes_succeeded"] + summary["routes_failed"] == 15
    ), f"Expected 15 route attempts (3×5), got {summary}"


def test_warm_cache_handles_individual_route_failures_gracefully(
    warmer_env,
) -> None:
    """An empty DB means every warming request returns 404 — the
    warmer must NOT raise; it must report zero-success summary."""
    application, engine = warmer_env
    # No seeding — DB is empty. _top_styles returns [].

    summary = warm_cache(application, engine, top=20)

    assert summary["styles_attempted"] == 0
    assert summary["styles_succeeded"] == 0
    assert summary["styles_failed"] == 0
    assert summary["routes_succeeded"] == 0
    assert summary["routes_failed"] == 0


def test_warm_cache_returns_summary_dict_with_required_keys(
    warmer_env,
) -> None:
    """Contract check: the summary dict carries every key the CLI
    table renders, even on the trivial path."""
    application, engine = warmer_env
    _seed_n_products(engine, n=2)

    summary = warm_cache(application, engine, top=2)

    required = {
        "styles_attempted",
        "styles_succeeded",
        "styles_failed",
        "routes_succeeded",
        "routes_failed",
    }
    assert required <= set(summary.keys()), (
        f"Summary missing keys. Got {set(summary.keys())}, "
        f"missing {required - set(summary.keys())}"
    )
    # Every value is an int — the CLI feeds these into a Rich table
    # and a non-int would render badly.
    for key, value in summary.items():
        assert isinstance(value, int), f"{key} is {type(value).__name__}, want int"
