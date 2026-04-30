"""Tests for Phase 13 rate limiting on the read-only HTTP API.

The slowapi limiter keys on the remote address. Under TestClient
every request comes from "testclient" so the bucket per-test is
shared — that's exactly what we want for the "61st request fails"
assertion. Each test re-builds the FastAPI app via ``create_app()``
so the limiter's bucket starts fresh.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from sanmar.api.app import create_app, get_engine
from sanmar.api.rate_limit import limiter as global_limiter
from sanmar.db import init_schema, make_engine


@pytest.fixture
def fresh_app(tmp_path):
    """Build a fresh app + engine and reset the limiter's storage.

    slowapi's :class:`Limiter` carries an in-memory storage backend
    that persists between :func:`create_app` calls when the limiter
    is a module-level singleton (which it is, by design — the per-
    route decorators capture it at import time). Resetting the
    storage between tests is the cleanest way to guarantee bucket
    independence without monkey-patching slowapi internals.
    """
    engine = make_engine(tmp_path / "rate.db")
    init_schema(engine)

    # Reset the storage so a previous test's 61 requests don't bleed
    # into this one's bucket.
    try:
        global_limiter._storage.reset()  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001 — best-effort reset
        pass
    global_limiter.enabled = True

    application = create_app()
    application.dependency_overrides[get_engine] = lambda: engine
    application.state.engine = engine
    client = TestClient(application)
    yield client, engine
    client.close()


def test_health_is_exempt_from_rate_limiting(fresh_app) -> None:
    """``/health`` carries no @limiter.limit decorator — uptime
    monitors should be able to hammer it. 100 hits, all 200."""
    client, _ = fresh_app
    for _ in range(100):
        r = client.get("/health")
        assert r.status_code == 200, r.text


def test_products_list_60th_request_within_minute_succeeds(fresh_app) -> None:
    """The 60/minute limit means request #60 is the last allowed in
    a one-minute window — it must still return 200."""
    client, _ = fresh_app
    last_status: int = 0
    for i in range(60):
        r = client.get("/products")
        last_status = r.status_code
        # Tolerate any successful status — the route returns 200 with
        # an empty list when the DB has no products.
        assert r.status_code == 200, (
            f"Request #{i+1} unexpectedly failed: {r.status_code} {r.text}"
        )
    assert last_status == 200


def test_products_list_61st_request_returns_429_with_retry_after(
    fresh_app,
) -> None:
    """One past the 60/minute ceiling must come back 429 with a
    ``Retry-After`` header so well-behaved clients back off."""
    client, _ = fresh_app
    # Burn the budget.
    for _ in range(60):
        client.get("/products")
    r = client.get("/products")
    assert r.status_code == 429, (
        f"Expected 429 on 61st request, got {r.status_code}: {r.text}"
    )
    assert "retry-after" in {k.lower() for k in r.headers.keys()}, (
        f"429 response missing Retry-After header. Headers: {dict(r.headers)}"
    )


def test_rate_limit_resets_after_disabling_limiter(fresh_app) -> None:
    """Disabling the limiter (the equivalent of a window reset for
    the purposes of this in-process test) must allow further
    requests to proceed — proving the gate is the limiter, not some
    other state. We don't sleep through a real 60s window because
    that would slow the suite to a crawl; toggling ``enabled`` is
    slowapi's own contract for "open the gate."""
    client, _ = fresh_app
    for _ in range(60):
        client.get("/products")
    blocked = client.get("/products")
    assert blocked.status_code == 429

    # Simulate window expiry by clearing the bucket.
    try:
        global_limiter._storage.reset()  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        global_limiter.enabled = False

    after = client.get("/products")
    assert after.status_code == 200, (
        f"After reset, expected 200, got {after.status_code}: {after.text}"
    )
