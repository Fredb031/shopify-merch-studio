"""Tests for the Phase 10 read-only HTTP API.

Each test builds a fresh in-memory SQLite via
:func:`sanmar.db.make_engine` against ``tmp_path``, seeds the rows
the test cares about, and overrides the ``get_engine`` dependency on
the FastAPI app so the route handlers see the test DB instead of the
production one.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from sanmar.api.app import create_app, get_engine
from sanmar.db import init_schema, make_engine, make_session_factory
from sanmar.models import (
    Brand,
    InventorySnapshot,
    Product,
    SyncState,
    Variant,
)


def _seed_engine(tmp_path: Path) -> Engine:
    """Build a fresh SQLite engine with the empty schema applied."""
    engine = make_engine(tmp_path / "api.db")
    init_schema(engine)
    return engine


@pytest.fixture
def client_factory(tmp_path):
    """Yield a callable that returns ``(client, engine)`` per test.

    The factory builds a new app per call so the lifespan + cache
    don't bleed between tests. Tests that need different seed data
    therefore can't accidentally observe a cached response from a
    previous test.
    """
    created: list[TestClient] = []

    def _make() -> tuple[TestClient, Engine]:
        engine = _seed_engine(tmp_path)
        application = create_app()
        application.dependency_overrides[get_engine] = lambda: engine
        # Stub out lifespan-resolved engine so handlers that call
        # ``request.app.state.engine`` directly also see the test DB.
        application.state.engine = engine
        client = TestClient(application)
        created.append(client)
        return client, engine

    yield _make
    for c in created:
        c.close()


def _seed_product(
    engine: Engine,
    *,
    style: str = "PC54",
    brand: str = "Port & Company",
    name: str = "Core Tee",
    category: str = "Tees",
    variants: list[tuple[str, str, float]] | None = None,
) -> int:
    """Insert a Brand + Product + Variants. Return the product id."""
    factory = make_session_factory(engine)
    with factory() as session:
        b = session.execute(
            __import__("sqlalchemy").select(Brand).where(Brand.name == brand)
        ).scalar_one_or_none()
        if b is None:
            b = Brand(name=brand, slug=brand.lower().replace(" ", "-"))
            session.add(b)
            session.flush()
        p = Product(
            style_number=style,
            brand_id=b.id,
            name=name,
            category=category,
            status="active",
        )
        session.add(p)
        session.flush()
        for color, size, price in variants or [
            ("Black", "L", 12.50),
            ("Black", "XL", 12.50),
        ]:
            session.add(
                Variant(
                    product_id=p.id,
                    full_sku=f"{style}-{color}-{size}",
                    color=color,
                    size=size,
                    price_cad=price,
                )
            )
        session.commit()
        return p.id


def test_health_returns_200_with_db_connected(client_factory) -> None:
    """``GET /health`` on a valid DB must return 200 with
    ``db_connected: true``. This is the cheapest possible
    smoke-test of the whole wiring."""
    client, _ = client_factory()
    r = client.get("/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["db_connected"] is True
    assert body["status"] in {"ok", "warning"}
    assert "last_sync" in body


def test_products_empty_db_returns_total_zero(client_factory) -> None:
    """``GET /products`` against an empty DB must return ``total: 0``
    with an empty ``products`` list — no 500."""
    client, _ = client_factory()
    r = client.get("/products")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["products"] == []
    assert body["page"] == 1
    assert body["page_size"] == 50


def test_get_product_404_for_unknown_style(client_factory) -> None:
    """``GET /products/{style}`` must 404 when the style isn't cached."""
    client, _ = client_factory()
    r = client.get("/products/NONEXISTENT")
    assert r.status_code == 404
    assert "not in cache" in r.json()["detail"].lower()


def test_get_product_returns_seeded_product(client_factory) -> None:
    """A seeded product must come back with brand + variants
    surfaced in ``list_of_colors`` / ``list_of_sizes``."""
    client, engine = client_factory()
    _seed_product(engine)
    r = client.get("/products/PC54")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["styleNumber"] == "PC54"
    assert body["brandName"] == "Port & Company"
    assert "Black" in body["listOfColors"]
    assert "L" in body["listOfSizes"]
    assert "XL" in body["listOfSizes"]


def test_products_filter_by_brand(client_factory) -> None:
    """``?brand=Port Authority`` must filter to that brand only."""
    client, engine = client_factory()
    _seed_product(engine, style="PC54", brand="Port & Company")
    _seed_product(
        engine,
        style="K500",
        brand="Port Authority",
        name="Silk Touch Polo",
        category="Polos",
    )
    r = client.get("/products", params={"brand": "Port Authority"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["products"][0]["styleNumber"] == "K500"
    assert body["products"][0]["brandName"] == "Port Authority"


def test_products_pagination_returns_next_slice(client_factory) -> None:
    """Page 2 with ``page_size=2`` must skip the first 2 styles."""
    client, engine = client_factory()
    for i, style in enumerate(["A001", "A002", "A003", "A004", "A005"]):
        _seed_product(
            engine,
            style=style,
            brand="Port & Company",
            name=f"Tee {i}",
        )
    r = client.get("/products", params={"page": 2, "page_size": 2})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 5
    assert body["page"] == 2
    assert body["page_size"] == 2
    style_numbers = [p["styleNumber"] for p in body["products"]]
    # Order is by style_number ASC, so page 2 of size 2 is A003 + A004.
    assert style_numbers == ["A003", "A004"]


def test_inventory_404_when_no_snapshot(client_factory) -> None:
    """``GET /inventory/{style}`` must 404 when no snapshots exist
    for any of the style's variants."""
    client, engine = client_factory()
    _seed_product(engine)  # variants exist, but no snapshots
    r = client.get("/inventory/PC54")
    assert r.status_code == 404


def test_inventory_respects_max_age_hours(client_factory) -> None:
    """A snapshot >max_age_hours old must yield 404; a fresh one
    on the same SKU must yield 200."""
    client, engine = client_factory()
    _seed_product(engine)
    factory = make_session_factory(engine)
    stale = datetime.now(tz=timezone.utc) - timedelta(hours=50)
    fresh = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
    with factory() as session:
        session.add(
            InventorySnapshot(
                full_sku="PC54-Black-L",
                warehouse_code="Vancouver",
                quantity=12,
                fetched_at=stale,
            )
        )
        session.commit()

    # max_age_hours=24 — only stale snapshot, must 404.
    r = client.get("/inventory/PC54", params={"max_age_hours": 24})
    assert r.status_code == 404

    # Add a fresh snapshot — must now succeed.
    with factory() as session:
        session.add(
            InventorySnapshot(
                full_sku="PC54-Black-XL",
                warehouse_code="Mississauga",
                quantity=5,
                fetched_at=fresh,
            )
        )
        session.commit()
    r = client.get("/inventory/PC54", params={"max_age_hours": 24})
    assert r.status_code == 200, r.text
    body = r.json()
    # Only the fresh snapshot should be in the response.
    location_qtys = {loc["warehouse_name"]: loc["qty"] for loc in body["locations"]}
    assert location_qtys.get("Mississauga") == 5
    # Total is the sum of fresh-only snapshots.
    assert body["total"] == 5


def test_pricing_returns_price_ladder(client_factory) -> None:
    """``GET /pricing/{style}`` must return cached prices as a
    PriceBreak ladder."""
    client, engine = client_factory()
    _seed_product(
        engine,
        variants=[
            ("Black", "L", 12.50),
            ("Black", "XL", 14.00),
            ("White", "L", 12.50),
        ],
    )
    r = client.get("/pricing/PC54")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["productId"] == "PC54"
    breaks = body["breaks"]
    assert len(breaks) == 2  # distinct prices: 12.50 and 14.00
    prices = sorted(float(b["price"]) for b in breaks)
    assert prices == [12.50, 14.00]


def test_pricing_404_for_unknown_style(client_factory) -> None:
    """Pricing must 404 for an unseeded style — separate from the
    'no prices on file' branch which is also 404."""
    client, _ = client_factory()
    r = client.get("/pricing/NONEXISTENT")
    assert r.status_code == 404


def test_variants_endpoint_returns_matrix(client_factory) -> None:
    """``GET /products/{style}/variants`` must return a flat row
    list plus the unique color / size axes."""
    client, engine = client_factory()
    _seed_product(
        engine,
        variants=[
            ("Black", "L", 12.50),
            ("Black", "XL", 14.00),
            ("White", "L", 12.50),
        ],
    )
    r = client.get("/products/PC54/variants")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["style_number"] == "PC54"
    assert sorted(body["colors"]) == ["Black", "White"]
    assert sorted(body["sizes"]) == ["L", "XL"]
    assert len(body["rows"]) == 3


def test_health_warning_when_sync_stale(client_factory) -> None:
    """A SyncState row >48h old must surface in ``warnings``."""
    client, engine = client_factory()
    factory = make_session_factory(engine)
    long_ago = datetime.now(tz=timezone.utc) - timedelta(hours=72)
    with factory() as session:
        sync = SyncState(
            sync_type="catalog_delta",
            started_at=long_ago,
            finished_at=long_ago,
            success_count=0,
            error_count=0,
            total_processed=0,
        )
        session.add(sync)
        session.commit()
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "warning"
    assert any("catalog_delta" in w for w in body["warnings"])
