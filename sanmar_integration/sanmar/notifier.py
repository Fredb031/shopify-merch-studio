"""Slack/webhook alerting for sync failures + order status transitions.

Mirrors the TS layer's ``notifySyncFailure`` (which itself was missing
dedup — the persistent firehose during a SanMar outage). Two surfaces:

* :meth:`SyncNotifier.notify_failure` — fired by the orchestrator after
  a sync row closes with ``error_count > 0``. Carries 30-minute dedup
  per ``sync_type`` so a flapping endpoint doesn't pin the channel.
* :meth:`SyncNotifier.notify_transition` — fired by reconciliation when
  an order flips into a terminal status (80 = Complete/Shipped, 99 =
  Cancelled). No dedup since transitions are themselves rare events.

All HTTP calls run with a 3-second timeout and swallow every exception
— alerting is best-effort observability, never load-bearing for the
sync itself. The webhook URL is *never* logged (any debug print would
embed a secret in CI output).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Optional

import requests

if TYPE_CHECKING:  # pragma: no cover - import-time only
    from sanmar.models import OrderRow, SyncState

logger = logging.getLogger(__name__)

# Re-alert the same sync_type at most once every 30 minutes. The TS
# layer learned this the hard way — a SanMar SOAP outage at 02:00 fired
# one alert per checkpoint write for the full 4-hour window.
DEDUP_WINDOW = timedelta(minutes=30)
HTTP_TIMEOUT_SECONDS = 3.0

# Slack-style colours per status. Anything terminal is "warning" (we
# want the operator to see it but not page); failures are "danger".
_TRANSITION_COLOR = "#36a64f"  # green — happy path
_FAILURE_COLOR = "#d50200"  # red


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class SyncNotifier:
    """Thin Slack/Zapier webhook poster with dedup + 3s timeout.

    Construct with a webhook URL (or ``None`` to disable entirely).
    All ``notify_*`` methods are no-ops when the URL is unset, so call
    sites don't need to branch on availability.
    """

    def __init__(self, webhook_url: Optional[str]) -> None:
        # Store but never log. We deliberately don't expose this as a
        # public attribute so accidental ``repr(notifier)`` won't leak it
        # into stack traces.
        self._webhook_url = webhook_url or None

    @property
    def enabled(self) -> bool:
        return self._webhook_url is not None

    # ── failures ──────────────────────────────────────────────────────

    def notify_failure(self, sync_state: "SyncState") -> bool:
        """Post a failure alert for a closed SyncState row.

        Returns ``True`` if the HTTP call was attempted (regardless of
        success), ``False`` if skipped (no webhook, or dedup window
        still open).

        Dedup state lives on ``sync_state.metadata_json['last_alert_at']``
        keyed implicitly by ``sync_type`` (each sync_type has its own
        latest-row chain — see ``ix_sync_state_type_started``). A second
        alert within ``DEDUP_WINDOW`` for the same ``sync_type`` is
        skipped, but we still update ``last_alert_at`` so the window
        starts fresh from the latest skipped-attempt.
        """
        if not self.enabled:
            return False
        if sync_state is None:
            return False

        # Dedup: peek at the metadata payload for a recent alert.
        meta: dict[str, Any] = dict(sync_state.metadata_json or {})
        last_iso = meta.get("last_alert_at")
        if last_iso:
            try:
                last_dt = datetime.fromisoformat(last_iso)
                # Tolerate naive timestamps (older rows) by assuming UTC.
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                if _utcnow() - last_dt < DEDUP_WINDOW:
                    logger.debug(
                        "skipping notify_failure for sync_type=%s — "
                        "within %s dedup window",
                        sync_state.sync_type,
                        DEDUP_WINDOW,
                    )
                    return False
            except (TypeError, ValueError):
                # Corrupt timestamp — proceed with the alert.
                pass

        payload = self._build_failure_payload(sync_state)
        self._post(payload)

        # Stamp metadata with the alert time so the next caller dedups.
        meta["last_alert_at"] = _utcnow().isoformat()
        sync_state.metadata_json = meta
        return True

    # ── transitions ───────────────────────────────────────────────────

    def notify_transition(
        self,
        order_row: "OrderRow",
        from_status: int,
        to_status: int,
    ) -> bool:
        """Post a transition alert when an order reaches a terminal
        status (80 = Complete/Shipped, 99 = Cancelled).

        No dedup — terminal transitions only fire once per order anyway.
        """
        if not self.enabled:
            return False
        if to_status not in (80, 99):
            return False

        payload = self._build_transition_payload(
            order_row, from_status, to_status
        )
        self._post(payload)
        return True

    # ── payload builders ──────────────────────────────────────────────

    @staticmethod
    def _build_failure_payload(sync_state: "SyncState") -> dict[str, Any]:
        title = f"SanMar sync failed: {sync_state.sync_type}"
        text_lines = [
            f"*sync_type:* `{sync_state.sync_type}`",
            f"*error_count:* {sync_state.error_count}",
            f"*success_count:* {sync_state.success_count}",
            f"*total_processed:* {sync_state.total_processed}",
        ]
        if sync_state.started_at is not None:
            text_lines.append(f"*started_at:* {sync_state.started_at.isoformat()}")
        if sync_state.finished_at is not None:
            text_lines.append(
                f"*finished_at:* {sync_state.finished_at.isoformat()}"
            )

        # Up to 3 sample errors, truncated, to keep the Slack message
        # readable. Full list lives in SQLite.
        errors = sync_state.errors or []
        if errors:
            text_lines.append("*sample errors:*")
            for err in errors[:3]:
                if isinstance(err, dict):
                    snippet = ", ".join(
                        f"{k}={v}" for k, v in list(err.items())[:4]
                    )
                else:
                    snippet = str(err)
                if len(snippet) > 200:
                    snippet = snippet[:200] + "…"
                text_lines.append(f"• {snippet}")

        return {
            "text": title,
            "attachments": [
                {
                    "color": _FAILURE_COLOR,
                    "title": title,
                    "text": "\n".join(text_lines),
                    "mrkdwn_in": ["text"],
                }
            ],
        }

    @staticmethod
    def _build_transition_payload(
        order_row: "OrderRow",
        from_status: int,
        to_status: int,
    ) -> dict[str, Any]:
        verb = "shipped" if to_status == 80 else "cancelled"
        title = f"SanMar order {verb}: {order_row.po_number}"
        text_lines = [
            f"*po_number:* `{order_row.po_number}`",
            f"*from_status:* {from_status}",
            f"*to_status:* {to_status}",
        ]
        if order_row.customer_po:
            text_lines.append(f"*customer_po:* `{order_row.customer_po}`")
        if order_row.vision_quote_id:
            text_lines.append(f"*quote_id:* `{order_row.vision_quote_id}`")
        if to_status == 80 and order_row.tracking_numbers:
            tracks = ", ".join(order_row.tracking_numbers[:5])
            text_lines.append(f"*tracking:* {tracks}")

        return {
            "text": title,
            "attachments": [
                {
                    "color": _TRANSITION_COLOR,
                    "title": title,
                    "text": "\n".join(text_lines),
                    "mrkdwn_in": ["text"],
                }
            ],
        }

    # ── transport ─────────────────────────────────────────────────────

    def _post(self, payload: dict[str, Any]) -> None:
        """Post to the webhook with a 3s timeout, swallowing all errors.

        The URL is intentionally referenced as ``self._webhook_url`` and
        never echoed into the log message even on failure.
        """
        if not self._webhook_url:
            return
        try:
            resp = requests.post(
                self._webhook_url,
                json=payload,
                timeout=HTTP_TIMEOUT_SECONDS,
            )
            if resp.status_code >= 400:
                logger.warning(
                    "alert webhook returned status=%s",
                    resp.status_code,
                )
        except requests.RequestException as e:
            # Best-effort: log a sanitized error (URL never appears).
            logger.warning(
                "alert webhook post failed: %s", type(e).__name__
            )
