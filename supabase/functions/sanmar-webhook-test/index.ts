/**
 * Edge function: sanmar-webhook-test
 *
 * Phase 19 — JWT-gated proxy that lets an admin operator fire a
 * synthetic webhook from /admin/sanmar to verify the customer
 * endpoint is reachable. POSTs to FastAPI `/webhook-deliveries/test`
 * which builds a fake OrderRow (status 80 → order.shipped by default)
 * and returns the resulting WebhookDelivery row.
 *
 * Auth: same pattern as sanmar-force-refresh-style. The browser-side
 * JWT proves the caller is admin/president; the edge function adds a
 * server-side bearer token so the FastAPI gate sees a trusted caller
 * even though we never trust the browser's bearer.
 *
 * Body forwarded to upstream:
 *
 *   { po_number?: string, event?: string, customer_email?: string }
 *
 * Upstream rate-limits at 5/minute so a misclick can't pummel the
 * customer's receiver — clients should expect occasional 429s.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const cacheApiUrl = (Deno.env.get('SANMAR_CACHE_API_URL') ?? '').trim();
  const adminToken = (Deno.env.get('SANMAR_ADMIN_API_TOKEN') ?? '').trim();

  if (!supabaseUrl || !anonKey) {
    console.error('[sanmar-webhook-test] Supabase env vars not configured');
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }
  if (!cacheApiUrl) {
    return jsonResponse(
      {
        error: 'cache_api_not_configured',
        detail: 'SANMAR_CACHE_API_URL is unset on the edge runtime',
      },
      503,
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing auth' }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResult } = await callerClient.auth.getUser();
  const user = userResult?.user;
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { data: profile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'president')) {
    return jsonResponse({ error: 'Forbidden — admin role required' }, 403);
  }

  // Body parse — empty body OK, FastAPI fills defaults.
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const trimmed = cacheApiUrl.endsWith('/') ? cacheApiUrl.slice(0, -1) : cacheApiUrl;
  const upstream = `${trimmed}/webhook-deliveries/test`;

  const upstreamHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (adminToken) {
    upstreamHeaders['Authorization'] = `Bearer ${adminToken}`;
  }

  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });
    const bodyText = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = { error: 'upstream_invalid_json', raw: bodyText.slice(0, 500) };
    }
    return jsonResponse(parsed, res.status);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[sanmar-webhook-test] fetch failed:', message);
    return jsonResponse({ error: 'upstream_unreachable', detail: message }, 502);
  }
});
