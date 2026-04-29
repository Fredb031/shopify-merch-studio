"""Unit tests for sanmar.notifier.SyncNotifier."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
import requests

from sanmar.notifier import DEDUP_WINDOW, SyncNotifier


class _FakeSyncState:
    """Lightweight stand-in for the SQLAlchemy SyncState row.

    The notifier only touches a handful of attributes; using a plain
    dataclass-ish helper keeps the tests free of an in-memory DB.
    """

    def __init__(
        self,
        *,
        sync_type: str,
        success_count: int = 0,
        error_count: int = 0,
        total_processed: int = 0,
        errors: list | None = None,
        metadata_json: dict | None = None,
        started_at: datetime | None = None,
        finished_at: datetime | None = None,
    ) -> None:
        self.sync_type = sync_type
        self.success_count = success_count
        self.error_count = error_count
        self.total_processed = total_processed
        self.errors = errors
        self.metadata_json = metadata_json
        self.started_at = started_at or datetime.now(tz=timezone.utc)
        self.finished_at = finished_at or datetime.now(tz=timezone.utc)


class _FakeOrderRow:
    def __init__(
        self,
        *,
        po_number: str,
        customer_po: str | None = None,
        vision_quote_id: str | None = None,
        tracking_numbers: list[str] | None = None,
    ) -> None:
        self.po_number = po_number
        self.customer_po = customer_po
        self.vision_quote_id = vision_quote_id
        self.tracking_numbers = tracking_numbers or []


# ── 1. Unset webhook → silent no-op ──────────────────────────────────


def test_notify_failure_noop_when_webhook_url_is_none() -> None:
    """With no URL configured the notifier must not call requests.post."""
    notifier = SyncNotifier(None)
    assert notifier.enabled is False

    sync_row = _FakeSyncState(sync_type="catalog_delta", error_count=3)
    with patch("sanmar.notifier.requests.post") as post:
        result = notifier.notify_failure(sync_row)

    assert result is False
    post.assert_not_called()


# ── 2. Posts a Slack-shaped payload ──────────────────────────────────


def test_notify_failure_posts_slack_payload() -> None:
    """A configured notifier posts a Slack-shaped payload to the URL."""
    url = "https://hooks.slack.com/services/AAA/BBB/CCC"
    notifier = SyncNotifier(url)

    sync_row = _FakeSyncState(
        sync_type="inventory",
        success_count=10,
        error_count=2,
        total_processed=12,
        errors=[
            {"style": "PC54", "code": "TIMEOUT", "message": "slow"},
            {"style": "PC61", "code": "AUTH", "message": "nope"},
        ],
    )

    fake_response = MagicMock(status_code=200)
    with patch(
        "sanmar.notifier.requests.post", return_value=fake_response
    ) as post:
        attempted = notifier.notify_failure(sync_row)

    assert attempted is True
    post.assert_called_once()

    args, kwargs = post.call_args
    # URL is positional arg 0
    assert args[0] == url
    # Slack-style top-level fields
    payload = kwargs["json"]
    assert "text" in payload
    assert "inventory" in payload["text"]
    assert "attachments" in payload
    assert isinstance(payload["attachments"], list)
    assert payload["attachments"][0]["color"] == "#d50200"  # _FAILURE_COLOR
    body = payload["attachments"][0]["text"]
    assert "*sync_type:*" in body
    assert "error_count:" in body
    # 3s timeout requirement
    assert kwargs["timeout"] == pytest.approx(3.0)
    # last_alert_at written so the next call dedups
    assert sync_row.metadata_json is not None
    assert "last_alert_at" in sync_row.metadata_json


# ── 3. Swallows network errors of all stripes ────────────────────────


def test_notify_failure_swallows_network_errors() -> None:
    """200 OK, 500 server error, ConnectionError — none should raise."""
    url = "https://example.com/webhook"
    notifier = SyncNotifier(url)

    # 200 — happy path
    sync_row = _FakeSyncState(sync_type="catalog_delta", error_count=1)
    with patch(
        "sanmar.notifier.requests.post",
        return_value=MagicMock(status_code=200),
    ):
        notifier.notify_failure(sync_row)

    # 500 — should log a warning but not raise
    sync_row2 = _FakeSyncState(sync_type="catalog_full", error_count=1)
    with patch(
        "sanmar.notifier.requests.post",
        return_value=MagicMock(status_code=500),
    ):
        notifier.notify_failure(sync_row2)

    # ConnectionError — must be caught, not propagated
    sync_row3 = _FakeSyncState(sync_type="order_reconcile", error_count=1)
    with patch(
        "sanmar.notifier.requests.post",
        side_effect=requests.ConnectionError("DNS fail"),
    ):
        # Must not raise
        notifier.notify_failure(sync_row3)


# ── 4. Dedup: 2nd call within 30 min for same sync_type is skipped ───


def test_notify_failure_dedup_within_window() -> None:
    """Two failures in <30min for the same sync_type only fire one alert."""
    url = "https://example.com/webhook"
    notifier = SyncNotifier(url)

    # First row: brand new, no last_alert_at
    sync_row = _FakeSyncState(sync_type="inventory", error_count=5)

    with patch(
        "sanmar.notifier.requests.post",
        return_value=MagicMock(status_code=200),
    ) as post:
        first = notifier.notify_failure(sync_row)
        assert first is True
        assert post.call_count == 1
        # last_alert_at was written
        assert sync_row.metadata_json is not None
        first_ts = sync_row.metadata_json["last_alert_at"]
        assert first_ts is not None

        # Second call immediately after — should be skipped
        second = notifier.notify_failure(sync_row)
        assert second is False
        # Still only 1 POST
        assert post.call_count == 1

    # Now back-date the alert past the dedup window and try again
    far_past = datetime.now(tz=timezone.utc) - DEDUP_WINDOW - timedelta(minutes=1)
    sync_row.metadata_json = {"last_alert_at": far_past.isoformat()}
    with patch(
        "sanmar.notifier.requests.post",
        return_value=MagicMock(status_code=200),
    ) as post:
        third = notifier.notify_failure(sync_row)
        assert third is True
        assert post.call_count == 1


# ── 5. Transition payloads: 60→80 (shipped) and 60→99 (cancelled) ────


def test_notify_transition_shipped_payload() -> None:
    """60 → 80 transition formats as 'shipped' with green colour."""
    url = "https://example.com/webhook"
    notifier = SyncNotifier(url)

    row = _FakeOrderRow(
        po_number="PO-2026-100",
        customer_po="CUST-77",
        vision_quote_id="Q-ABC",
        tracking_numbers=["1Z999AA10123456784"],
    )

    with patch(
        "sanmar.notifier.requests.post",
        return_value=MagicMock(status_code=200),
    ) as post:
        result = notifier.notify_transition(row, 60, 80)

    assert result is True
    post.assert_called_once()
    payload = post.call_args.kwargs["json"]
    assert "shipped" in payload["text"]
    assert "PO-2026-100" in payload["text"]
    body = payload["attachments"][0]["text"]
    assert "from_status:* 60" in body
    assert "to_status:* 80" in body
    assert "1Z999AA10123456784" in body
    assert payload["attachments"][0]["color"] == "#36a64f"


def test_notify_transition_cancelled_payload() -> None:
    """60 → 99 transition formats as 'cancelled'."""
    url = "https://example.com/webhook"
    notifier = SyncNotifier(url)

    row = _FakeOrderRow(po_number="PO-2026-200")

    with patch(
        "sanmar.notifier.requests.post",
        return_value=MagicMock(status_code=200),
    ) as post:
        result = notifier.notify_transition(row, 60, 99)

    assert result is True
    payload = post.call_args.kwargs["json"]
    assert "cancelled" in payload["text"]
    assert "PO-2026-200" in payload["text"]


def test_notify_transition_skips_non_terminal_status() -> None:
    """Non-terminal transitions (e.g. 30→60) don't fire."""
    url = "https://example.com/webhook"
    notifier = SyncNotifier(url)
    row = _FakeOrderRow(po_number="PO-1")

    with patch("sanmar.notifier.requests.post") as post:
        result = notifier.notify_transition(row, 30, 60)

    assert result is False
    post.assert_not_called()


def test_notify_transition_noop_when_webhook_unset() -> None:
    """No URL → no call, even on a terminal transition."""
    notifier = SyncNotifier(None)
    row = _FakeOrderRow(po_number="PO-1")
    with patch("sanmar.notifier.requests.post") as post:
        result = notifier.notify_transition(row, 60, 80)

    assert result is False
    post.assert_not_called()
