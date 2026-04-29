/**
 * Proactive failure alerts for the SanMar sync edge functions.
 *
 * The dashboard surfaces sync failures retrospectively (operators have to
 * remember to look). This helper pushes a Slack-compatible payload to a
 * webhook URL the moment a sync run finishes with errors, so an operator
 * gets pinged in real time.
 *
 * The payload shape is the standard Slack incoming-webhook
 * "text + attachments" envelope — Zapier "Catch Hook" triggers happily
 * accept the same JSON, so a single env var (SANMAR_ALERT_WEBHOOK_URL)
 * works for both routing options.
 *
 * Design rules:
 *   - Optional. If the env var is unset, this is a no-op (don't crash).
 *   - Non-blocking. The webhook POST is bounded by a short timeout so it
 *     can't hold the sync run open if the receiver is slow.
 *   - Non-cascading. Any failure (network, non-2xx, timeout) is caught
 *     and logged — never re-thrown. The sync result must not depend on
 *     a third-party webhook being healthy.
 *   - No secret leakage. Neither the webhook URL nor any other secret
 *     is echoed in the payload or the console logs we emit.
 */

import type { SyncType } from './sync.ts';

export interface NotifySyncFailureInput {
  sync_type: SyncType;
  error_count: number;
  errors: Array<{ item?: unknown; message: string }>;
  duration_ms: number;
}

/** Bound how long we'll wait on the webhook before giving up. The sync
 * caller is `await`ing us, so we can't hang forever. 3s is plenty for a
 * Slack/Zapier ingest endpoint; anything slower is a receiver problem
 * the sync job shouldn't be punished for. */
const WEBHOOK_TIMEOUT_MS = 3000;

/** Truncate a long error string for the Slack attachment "First error"
 * field — Slack will render the full string but ops only need the lede. */
function snippet(s: string, max = 300): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * POST a failure summary to `SANMAR_ALERT_WEBHOOK_URL` if configured.
 *
 * No-op when:
 *   - the env var is unset (intentionally optional in dev / pre-go-live)
 *   - `error_count` is 0 (callers are expected to gate on this anyway,
 *     but we double-check so accidental empty-error notifications never
 *     spam the channel)
 *
 * Slack-compatible JSON shape:
 * ```json
 * {
 *   "text": "🔴 SanMar sync FAILED: catalog",
 *   "attachments": [{
 *     "color": "danger",
 *     "fields": [
 *       {"title": "Errors",     "value": "3",      "short": true},
 *       {"title": "Duration",   "value": "1234ms", "short": true},
 *       {"title": "First error","value": "...",    "short": false}
 *     ]
 *   }]
 * }
 * ```
 */
export async function notifySyncFailure(input: NotifySyncFailureInput): Promise<void> {
  const { sync_type, error_count, errors, duration_ms } = input;

  // Skip silently — no env var configured.
  const webhookUrl = Deno.env.get('SANMAR_ALERT_WEBHOOK_URL') ?? '';
  if (!webhookUrl) return;

  // Defensive: caller is meant to gate on errors.length > 0 but if a
  // zero-error notification slips through we silently skip.
  if (error_count <= 0) return;

  const firstErrorMessage = errors[0]?.message ?? '(no error detail captured)';

  const payload = {
    text: `🔴 SanMar sync FAILED: ${sync_type}`,
    attachments: [
      {
        color: 'danger',
        fields: [
          { title: 'Errors', value: String(error_count), short: true },
          { title: 'Duration', value: `${duration_ms}ms`, short: true },
          { title: 'First error', value: snippet(firstErrorMessage), short: false },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Note: deliberately do NOT log webhookUrl — it is a secret-bearing
      // URL (Slack and Zapier both embed an authz token in the path).
      console.error(
        `[sanmar-notify] alert webhook returned non-2xx for ${sync_type}: ${res.status}`,
      );
    }
  } catch (e) {
    // Same caveat re: not logging the URL. We only log the error message.
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[sanmar-notify] alert webhook failed for ${sync_type}: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
