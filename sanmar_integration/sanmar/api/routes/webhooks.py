"""Phase 19 — webhook deliveries audit + test-fire endpoints.

Two endpoints for the storefront-side `/admin/sanmar` webhook panel
(mirror of the Streamlit Phase 18 panel for operators who don't run
Streamlit):

* ``GET /webhook-deliveries/`` — last-N rows with ``outcome`` / ``po``
  / ``event`` filters. Read-only.
* ``POST /webhook-deliveries/test`` — operator-fired synthetic webhook
  used to verify a customer endpoint is reachable. Builds a fake
  :class:`~sanmar.models.OrderRow` (status_id=80 → ``order.shipped``),
  invokes :class:`~sanmar.orchestrator.OrderWebhookClient.fire`, and
  returns the resulting :class:`~sanmar.models.WebhookDelivery` row.
  The synthetic payload carries ``is_test: true`` so receivers can
  ignore in production logic.

Auth model (defence in depth)
-----------------------------

* Both endpoints accept an optional ``Authorization: Bearer <token>``
  shared-secret. The expected value is ``SANMAR_ADMIN_API_TOKEN`` env
  (or ``Settings.admin_api_token``). When the env is unset the gate
  is open — the cache layer is normally only reachable from inside
  the storefront's egress and the edge-function in front does the
  Supabase JWT check. When the env is set, missing / wrong tokens get
  a generic ``401`` so we don't leak whether a token is configured.
* Rate limited via the existing slowapi ``limiter``: read endpoint at
  ``30/minute`` (matches detail routes), test fire at ``5/minute`` so
  a misclick can't pummel a customer's receiver.

Security note: the response strips ``signature_hex`` down to its last
8 hex chars. The full HMAC stays in the SQLite row (the replay CLI
needs it) but exposing it through HTTP would let an attacker who got
read access to /webhook-deliveries forge requests against the
customer's webhook receiver.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.engine import Engine

from sanmar.api.app import get_engine
from sanmar.api.rate_limit import limiter
from sanmar.config import get_settings
from sanmar.db import session_scope
from sanmar.models import WebhookDelivery

router = APIRouter(prefix="/webhook-deliveries", tags=["admin"])

# Sentinel returned from the response-shaping helper when no signature
# is on file — keeps the column type consistent for storefront table
# rendering (always string).
_NO_SIG_PLACEHOLDER: str = ""

# Default test-fire event when the operator doesn't pick one. Status 80
# is the SanMar terminal "Complete / Shipped" code → fires an
# ``order.shipped`` webhook, the most common one customers wire up.
_DEFAULT_TEST_STATUS: int = 80
_DEFAULT_TEST_EVENT: str = "order.shipped"


def _admin_token() -> Optional[str]:
    """Resolve the configured admin token, env-first.

    Pulled out so tests can monkey-patch the env without reaching into
    :func:`sanmar.config.get_settings` (which is ``lru_cache``-d and
    would persist across tests otherwise).
    """
    raw = os.getenv("SANMAR_ADMIN_API_TOKEN", "").strip()
    return raw or None


def _check_admin_auth(authorization: Optional[str]) -> None:
    """Raise 401 when a token is configured and the caller's bearer
    doesn't match. No-op when no token is configured (open gate).

    The check is constant-time-ish via ``==`` over short tokens —
    slowapi rate-limits at 30/min on the read endpoint so a brute-force
    attempt is mathematically impractical regardless.
    """
    expected = _admin_token()
    if expected is None:
        return  # open gate — caller is the edge function, JWT-checked upstream

    if not authorization:
        raise HTTPException(status_code=401, detail="missing_authorization")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or token.strip() != expected:
        raise HTTPException(status_code=401, detail="invalid_admin_token")


def _shape_delivery(row: WebhookDelivery) -> dict[str, Any]:
    """Project a :class:`WebhookDelivery` row into the wire shape.

    Mirrors the Streamlit panel's columns + the spec's ``signature_hex
    last 8 chars only`` security rule. ``signed_at`` is normalised to
    ISO-8601 UTC; SQLite hands back naive datetimes so we coerce.
    """
    signed_at = row.signed_at
    if signed_at is not None and signed_at.tzinfo is None:
        signed_at = signed_at.replace(tzinfo=timezone.utc)

    sig = row.signature_hex or _NO_SIG_PLACEHOLDER
    sig_short = sig[-8:] if len(sig) >= 8 else sig

    return {
        "id": row.id,
        "po_number": row.po_number,
        "event": row.event,
        "status_code": row.status_code,
        "attempt_count": row.attempt_count,
        "outcome": row.outcome,
        "response_ms": row.response_ms,
        "signed_at": signed_at.isoformat() if signed_at else None,
        "signature_hex": sig_short,
        "event_id": row.event_id,
        # Useful diagnostic for failed rows; stays small per
        # WEBHOOK_RESPONSE_BODY_CAP_BYTES on the persistence side.
        "error": row.error,
    }


@router.get("/")
@limiter.limit("30/minute")
async def list_deliveries(
    request: Request,
    limit: int = Query(50, ge=1, le=500),
    outcome: Optional[str] = Query(None, max_length=32),
    po: Optional[str] = Query(None, max_length=64),
    event: Optional[str] = Query(None, max_length=64),
    authorization: Optional[str] = Header(None),
    engine: Engine = Depends(get_engine),
) -> dict[str, Any]:
    """Recent webhook deliveries, newest first.

    Filters compose with AND. ``has_more`` is a coarse "did we fill the
    limit?" signal — accurate enough for the storefront's "Voir plus"
    button without spending an extra COUNT query per request.
    """
    _check_admin_auth(authorization)

    with session_scope(engine) as session:
        stmt = select(WebhookDelivery)
        if outcome:
            stmt = stmt.where(WebhookDelivery.outcome == outcome)
        if po:
            stmt = stmt.where(WebhookDelivery.po_number == po)
        if event:
            stmt = stmt.where(WebhookDelivery.event == event)
        stmt = stmt.order_by(WebhookDelivery.signed_at.desc()).limit(limit + 1)

        rows = session.execute(stmt).scalars().all()

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        deliveries = [_shape_delivery(r) for r in rows]

        # Cheap total: count over the same filter set. Used by the UI's
        # "showing X of Y" subtitle. Skipped if we'd need a second
        # session round-trip on a hot path — but webhooks are low-
        # volume (10s of rows/day) so the count is microseconds.
        from sqlalchemy import func

        count_stmt = select(func.count()).select_from(WebhookDelivery)
        if outcome:
            count_stmt = count_stmt.where(WebhookDelivery.outcome == outcome)
        if po:
            count_stmt = count_stmt.where(WebhookDelivery.po_number == po)
        if event:
            count_stmt = count_stmt.where(WebhookDelivery.event == event)
        total_count = int(session.execute(count_stmt).scalar() or 0)

    return {
        "deliveries": deliveries,
        "total_count": total_count,
        "has_more": has_more,
    }


# ── POST /webhook-deliveries/test ─────────────────────────────────────


class _SyntheticOrder:
    """Duck-typed stand-in for :class:`~sanmar.models.OrderRow`.

    :meth:`OrderWebhookClient.fire` only reads attributes off ``order``
    (no ORM session work, no SQL), so a plain object with the right
    field names + types behaves identically to a persisted row. We
    avoid creating a real OrderRow here so the test fire never touches
    the orders table — operator-fired diagnostics shouldn't muddy the
    PO timeline.
    """

    def __init__(
        self,
        *,
        po_number: str,
        customer_email: Optional[str],
        status_id: int,
        tracking_numbers: list[str],
        expected_ship_date: Optional[datetime],
    ) -> None:
        self.po_number = po_number
        self.customer_email = customer_email
        self.status_id = status_id
        self.tracking_numbers = tracking_numbers
        self.expected_ship_date = expected_ship_date


@router.post("/test")
@limiter.limit("5/minute")
async def fire_test_event(
    request: Request,
    authorization: Optional[str] = Header(None),
    engine: Engine = Depends(get_engine),
) -> dict[str, Any]:
    """Fire a synthetic webhook to verify the customer endpoint is alive.

    Body shape (all fields optional)::

        {
          "po_number": "TEST-1714415000",   # default: TEST-<unix-ms>
          "event": "order.shipped",         # one of WEBHOOK_EVENTS values
          "customer_email": "ops@x.ca"      # default: test@visionaffichage.com
        }

    The synthetic payload includes ``is_test: true`` so receivers can
    short-circuit in production. The actual delivery row is returned
    so the caller can render "status 200, 142 ms" without a follow-up
    GET round-trip.
    """
    _check_admin_auth(authorization)

    # Body parse is lenient — the storefront sends a small JSON object;
    # everything else falls back to defaults so the operator can hit
    # "Fire test" with no input and still get a useful diagnostic.
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001 — empty body is fine
        body = {}

    if not isinstance(body, dict):
        body = {}

    # Late imports keep the module import graph cheap when the test-
    # fire endpoint is never hit (most cache instances).
    from sanmar.orchestrator import (
        WEBHOOK_EVENTS,
        OrderWebhookClient,
    )

    # Reverse-map event → status_id (so an operator who picks
    # "order.shipped" gets status 80 fired).
    event_to_status = {v: k for k, v in WEBHOOK_EVENTS.items()}

    requested_event = str(body.get("event") or _DEFAULT_TEST_EVENT)
    if requested_event not in event_to_status:
        raise HTTPException(
            status_code=400,
            detail=f"unknown_event:{requested_event}",
        )

    new_status = event_to_status[requested_event]
    po_number = str(body.get("po_number") or f"TEST-{int(datetime.now().timestamp())}")
    customer_email = str(body.get("customer_email") or "test@visionaffichage.com")

    settings = get_settings()
    client = OrderWebhookClient(
        url=settings.customer_webhook_url,
        secret=settings.customer_webhook_secret,
        log_skipped=True,  # always persist test-fires, even when URL unset
    )

    order = _SyntheticOrder(
        po_number=po_number,
        customer_email=customer_email,
        status_id=new_status,
        tracking_numbers=["TEST-TRACKING-0001"],
        expected_ship_date=datetime.now(tz=timezone.utc),
    )

    # Wrap the fire in a session so persistence happens. The previous
    # status of 0 is a sentinel — receivers reading ``previous_status_id``
    # will see "transitioned from 0" which is structurally distinct from
    # any real SanMar code.
    with session_scope(engine) as session:
        # Mark the synthetic payload — we want this to land *inside* the
        # signed body so receivers can verify HMAC and *still* see the
        # is_test flag. We patch via a thin subclass of OrderWebhookClient
        # that augments _build_payload.
        client = _TestFireClient(
            url=settings.customer_webhook_url,
            secret=settings.customer_webhook_secret,
            log_skipped=True,
        )

        ok = client.fire(
            event=requested_event,
            order=order,  # type: ignore[arg-type]
            prev_status=0,
            new_status=new_status,
            session=session,
        )

        # Pull the row we just wrote so we can return it. .order_by
        # signed_at desc + matching po_number narrows to the new row
        # without a separate id roundtrip.
        delivery = (
            session.execute(
                select(WebhookDelivery)
                .where(WebhookDelivery.po_number == po_number)
                .order_by(WebhookDelivery.signed_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )

        if delivery is None:
            # Shouldn't happen unless persistence silently failed —
            # surface it cleanly rather than returning a half-answer.
            return {
                "fired": ok,
                "delivery": None,
                "is_test": True,
                "warning": "delivery_row_not_persisted",
            }

        shaped = _shape_delivery(delivery)

    return {
        "fired": ok,
        "delivery": shaped,
        "is_test": True,
    }


class _TestFireClient:
    """Thin wrapper around :class:`OrderWebhookClient` that injects
    ``is_test: true`` into the signed payload.

    We don't subclass directly because :meth:`_build_payload` is a
    private method — its signature isn't part of the public contract.
    Instead we delegate :meth:`fire` to a fresh client and mutate the
    payload via a monkey-patch of ``_build_payload`` on this instance.
    """

    def __init__(
        self,
        *,
        url: Optional[str],
        secret: Optional[str],
        log_skipped: bool,
    ) -> None:
        from sanmar.orchestrator import OrderWebhookClient

        self._inner = OrderWebhookClient(
            url=url, secret=secret, log_skipped=log_skipped
        )
        original_build = self._inner._build_payload  # type: ignore[attr-defined]

        def _build_with_test_flag(
            event: str,
            order: Any,
            prev_status: int,
            new_status: int,
            *,
            event_id: Optional[str] = None,
        ) -> dict[str, Any]:
            payload = original_build(
                event, order, prev_status, new_status, event_id=event_id
            )
            payload["is_test"] = True
            return payload

        # Monkey-patch on the instance so the public ``fire`` flow uses
        # our augmented builder without us having to reimplement it.
        self._inner._build_payload = _build_with_test_flag  # type: ignore[assignment]

    def fire(self, **kwargs: Any) -> bool:
        return self._inner.fire(**kwargs)
