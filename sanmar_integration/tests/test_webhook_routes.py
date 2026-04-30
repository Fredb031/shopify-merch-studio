"""Phase 19 — tests for the ``/webhook-deliveries`` HTTP API.

Covers the GET listing (filter combinations + admin-token gating) and
the POST test-fire endpoint (synthetic delivery + rate limit + payload
shape with ``is_test: true``). Each test builds a fresh FastAPI app +
in-memory SQLite so the slowapi per-IP bucket and the ``WebhookDelivery``
table both start clean.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from sanmar.api.app import create_app, get_engine
from sanmar.api.rate_limit import limiter as global_limiter
from sanmar.db import init_schema, make_engine, session_scope
from sanmar.models import WebhookDelivery


@pytest.fixture
def fresh_app(tmp_path, monkeypatch):
    """Build a fresh app + engine, reset rate-limit storage,
    drop any pre-existing admin token from the env (per-test opt-in).
    """
    monkeypatch.delenv("SANMAR_ADMIN_API_TOKEN", raising=False)

    engine = make_engine(tmp_path / "wh-routes.db")
    init_schema(engine)

    try:
        global_limiter._storage.reset()  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        pass
    global_limiter.enabled = True

    application = create_app()
    application.dependency_overrides[get_engine] = lambda: engine
    application.state.engine = engine
    client = TestClient(application)
    yield client, engine
    client.close()


def _seed_delivery(
    engine: Engine,
    *,
    po_number: str = "VA-1",
    event: str = "order.shipped",
    status_code: int | None = 200,
    outcome: str = "success",
    attempt_count: int = 1,
    response_ms: int | None = 100,
    signature_hex: str = "deadbeefcafebabe1234",
    signed_at: datetime | None = None,
) -> int:
    """Insert one ``WebhookDelivery`` row, return its id."""
    from sanmar.db import make_session_factory

    factory = make_session_factory(engine)
    with factory() as session:
        row = WebhookDelivery(
            po_number=po_number,
            event=event,
            payload_json="{}",
            signature_hex=signature_hex,
            attempt_count=attempt_count,
            status_code=status_code,
            outcome=outcome,
            response_ms=response_ms,
            signed_at=signed_at or datetime.now(tz=timezone.utc),
        )
        session.add(row)
        session.commit()
        return int(row.id)


# ── 1. GET returns recent rows ──────────────────────────────────────


def test_get_webhook_deliveries_returns_recent_rows(fresh_app) -> None:
    client, engine = fresh_app
    _seed_delivery(engine, po_number="VA-1")
    _seed_delivery(engine, po_number="VA-2")

    res = client.get("/webhook-deliveries/")
    assert res.status_code == 200, res.text

    body = res.json()
    assert "deliveries" in body
    assert body["total_count"] == 2
    assert body["has_more"] is False
    pos = {d["po_number"] for d in body["deliveries"]}
    assert pos == {"VA-1", "VA-2"}

    # Signature must be truncated to last 8 chars (security).
    for d in body["deliveries"]:
        assert len(d["signature_hex"]) <= 8


# ── 2. Filter by outcome ────────────────────────────────────────────


def test_get_filters_by_outcome(fresh_app) -> None:
    client, engine = fresh_app
    _seed_delivery(engine, po_number="VA-OK", outcome="success")
    _seed_delivery(engine, po_number="VA-FAIL", outcome="failed")
    _seed_delivery(engine, po_number="VA-FAIL-2", outcome="failed")

    res = client.get("/webhook-deliveries/?outcome=success")
    assert res.status_code == 200
    body = res.json()
    assert body["total_count"] == 1
    assert body["deliveries"][0]["po_number"] == "VA-OK"

    res2 = client.get("/webhook-deliveries/?outcome=failed")
    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["total_count"] == 2


# ── 3. Filter by PO ─────────────────────────────────────────────────


def test_get_filters_by_po(fresh_app) -> None:
    client, engine = fresh_app
    _seed_delivery(engine, po_number="PO123", event="order.shipped")
    _seed_delivery(engine, po_number="PO123", event="order.picked")
    _seed_delivery(engine, po_number="PO999", event="order.shipped")

    res = client.get("/webhook-deliveries/?po=PO123")
    assert res.status_code == 200
    body = res.json()
    assert body["total_count"] == 2
    pos = {d["po_number"] for d in body["deliveries"]}
    assert pos == {"PO123"}


# ── 4. Admin token gating ───────────────────────────────────────────


def test_get_requires_admin_token_when_configured(fresh_app, monkeypatch) -> None:
    client, engine = fresh_app
    _seed_delivery(engine, po_number="VA-1")

    monkeypatch.setenv("SANMAR_ADMIN_API_TOKEN", "s3cret-admin-token")

    # No header → 401
    res_unauth = client.get("/webhook-deliveries/")
    assert res_unauth.status_code == 401

    # Wrong token → 401
    res_wrong = client.get(
        "/webhook-deliveries/",
        headers={"Authorization": "Bearer not-the-right-one"},
    )
    assert res_wrong.status_code == 401

    # Right token → 200
    res_ok = client.get(
        "/webhook-deliveries/",
        headers={"Authorization": "Bearer s3cret-admin-token"},
    )
    assert res_ok.status_code == 200, res_ok.text
    assert res_ok.json()["total_count"] == 1


# ── 5. POST /test fires + persists row ──────────────────────────────


def test_post_test_fires_real_delivery(fresh_app) -> None:
    """The synthetic order should produce an ``is_test: true`` payload,
    persist a WebhookDelivery row, and return it shaped."""
    client, engine = fresh_app

    fake_response = MagicMock(status_code=200)
    fake_response.text = "ok"
    captured: dict[str, bytes] = {}

    def _capture_post(url, data=None, headers=None, timeout=None):
        captured["url"] = url
        captured["body"] = data
        captured["headers"] = headers
        return fake_response

    # Configure a webhook URL so the fire actually attempts to POST.
    from sanmar.config import get_settings

    get_settings.cache_clear()  # type: ignore[attr-defined]
    with patch.dict(
        os.environ,
        {
            "SANMAR_CUSTOMER_WEBHOOK_URL": "https://customer.example.com/hook",
            "SANMAR_CUSTOMER_WEBHOOK_SECRET": "s3cr3t",
        },
    ):
        get_settings.cache_clear()  # type: ignore[attr-defined]
        with patch("sanmar.orchestrator.requests.post", side_effect=_capture_post):
            res = client.post(
                "/webhook-deliveries/test",
                json={"po_number": "TEST-PHASE19", "event": "order.shipped"},
            )

    # Reset settings cache for following tests.
    get_settings.cache_clear()  # type: ignore[attr-defined]

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["is_test"] is True
    assert body["delivery"] is not None
    assert body["delivery"]["po_number"] == "TEST-PHASE19"
    assert body["delivery"]["event"] == "order.shipped"

    # The signed body must include is_test:true.
    import json as _json

    sent_body = captured.get("body")
    assert sent_body is not None, "expected requests.post to have been called"
    parsed = _json.loads(sent_body.decode("utf-8"))
    assert parsed.get("is_test") is True

    # The DB persisted a row.
    with session_scope(engine) as session:
        rows = session.query(WebhookDelivery).all()
    assert len(rows) == 1
    assert rows[0].po_number == "TEST-PHASE19"


# ── 6. POST /test rate-limited at 6th request ───────────────────────


def test_post_test_rate_limited_at_six(fresh_app) -> None:
    """Limit is 5/minute. Hits 1-5 are served (200/skipped), hit 6 is
    429 regardless of whether the inner fire succeeds."""
    client, _engine = fresh_app

    # Don't configure a customer URL — fire becomes a no-op (skipped),
    # which still counts against the rate-limit bucket. We only care
    # that the 6th request gets 429.
    statuses: list[int] = []
    for _ in range(6):
        res = client.post("/webhook-deliveries/test", json={})
        statuses.append(res.status_code)

    assert statuses[:5] == [200, 200, 200, 200, 200], statuses
    assert statuses[5] == 429, statuses
