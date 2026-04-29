/**
 * Edge function: sanmar-daily-digest
 *
 * Posts a single Slack-format "all is well" summary to
 * `SANMAR_ALERT_WEBHOOK_URL` once per day. Operators today only hear
 * from the SanMar TS layer when something breaks (notify.ts) or just
 * recovered — there is no positive heartbeat. This function fills that
 * gap.
 *
 * Schedule: pg_cron `0 12 * * *` (12:00 UTC ≈ 08:00 ET, with a ±1 h DST
 * drift we accept). That lands well after the 02:00 ET nightly catalog
 * sync (`sanmar-sync-catalog`, Sunday only) and the 00:15 ET inventory
 * sync (`sanmar-sync-inventory`), so the digest can include their
 * results without racing them.
 *
 * Auth: cron-secret only. We deliberately do NOT require a Supabase JWT
 * — pg_cron + net.http_post don't pass user auth. Same posture as the
 * three other cron-driven edge functions (sanmar-sync-catalog,
 * sanmar-sync-inventory, sanmar-reconcile-orders). The constant-time
 * comparison lives in `requireCronSecret()`.
 *
 * Failure posture: the digest is "nice to have" — a transient receiver
 * outage must not page operators (the failure path of *the digest* is
 * literally just "no green message arrived this morning"). We:
 *   - swallow webhook errors / non-2xx responses (logged, not thrown)
 *   - record every attempt to sanmar_alert_log with alert_kind='digest'
 *     so operators can see retroactively what happened.
 *   - return 200 with `success: false` if the webhook POST failed but
 *     the payload was built — keeps cron's net.http_post from retrying
 *     us (which would just stack duplicates).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { errorBody } from '../_shared/sanmar-http.ts';
import { CronAuthError, requireCronSecret } from '../_shared/sanmar/sync.ts';
import { buildDigestPayload, type DigestPayload } from '../_shared/sanmar/digest.ts';

/** Bound how long we'll wait on the webhook — same value as notify.ts so
 * receivers see consistent timeouts across all alert kinds. */
const WEBHOOK_TIMEOUT_MS = 3000;

/** Cap on the response body persisted to sanmar_alert_log. Mirrors
 * notify.ts so a chatty 5xx HTML page doesn't bloat the audit table. */
const RESPONSE_BODY_MAX = 2000;

interface PostResult {
  status: number | null;
  body: string | null;
}

async function postDigestWebhook(
  webhookUrl: string,
  payload: DigestPayload,
): Promise<PostResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body: string | null = null;
    try {
      body = await res.text();
    } catch {
      body = null;
    }
    if (!res.ok) {
      // Deliberately do NOT log the webhook URL — it embeds an authz
      // token in the path on Slack and Zapier.
      console.error(
        `[sanmar-daily-digest] webhook returned non-2xx: ${res.status}`,
      );
    }
    return { status: res.status, body };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[sanmar-daily-digest] webhook POST failed: ${message}`);
    return { status: null, body: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorBody(140, 'Method not allowed')), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cron-secret gate — same constant-time check as the other sanmar
  // cron functions. Returns a structured 401 envelope on miss.
  try {
    requireCronSecret(req);
  } catch (e) {
    if (e instanceof CronAuthError) {
      return jsonResponse(errorBody(300, e.message, 'Error'), 401);
    }
    throw e;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('[sanmar-daily-digest] Supabase env vars not configured');
    return jsonResponse(errorBody(999, 'Internal error', 'Error'), 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sentAtIso = new Date().toISOString();

  // ── Build payload ──────────────────────────────────────────────────
  // buildDigestPayload is non-throwing by contract — query failures are
  // baked into the rendered text so operators always get *something*.
  const payload = await buildDigestPayload(supabase);

  // ── POST to webhook (if configured) ────────────────────────────────
  const webhookUrl = Deno.env.get('SANMAR_ALERT_WEBHOOK_URL') ?? '';
  let result: PostResult = { status: null, body: 'webhook not configured' };
  let success = false;
  if (!webhookUrl) {
    // Same no-op posture as notify.ts: skip silently in dev /
    // pre-go-live environments. We still record the attempt so
    // operators can verify the cron job is firing.
    console.log('[sanmar-daily-digest] SANMAR_ALERT_WEBHOOK_URL unset — skipping POST');
  } else {
    result = await postDigestWebhook(webhookUrl, payload);
    success = result.status !== null && result.status >= 200 && result.status < 300;
  }

  // ── Audit row — best effort, never fatal ───────────────────────────
  try {
    const { error } = await supabase.from('sanmar_alert_log').insert({
      // sync_type is NOT NULL on the table; "digest" isn't tied to a
      // single sync type so we tag with a sentinel that's distinct
      // from the existing 'catalog' / 'inventory' / 'order_status'
      // values. The TEXT column accepts it freely — only alert_kind
      // is constrained.
      sync_type: 'digest',
      alert_kind: 'digest',
      payload,
      webhook_status_code: result.status,
      webhook_response_body: result.body
        ? result.body.slice(0, RESPONSE_BODY_MAX)
        : null,
    });
    if (error) {
      console.error(
        `[sanmar-daily-digest] sanmar_alert_log insert failed: ${error.message}`,
      );
    }
  } catch (e) {
    console.error(
      `[sanmar-daily-digest] sanmar_alert_log insert threw: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  return jsonResponse({
    success,
    payload,
    sent_at: sentAtIso,
    webhook_status_code: result.status,
  });
});
