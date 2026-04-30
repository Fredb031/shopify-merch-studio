/**
 * Edge function: sanmar-webhook-deliveries
 *
 * Phase 19 — JWT-gated proxy that lets the AdminSanMar webhook panel
 * read the FastAPI cache layer's `GET /webhook-deliveries/` without
 * exposing the cache directly to the browser.
 *
 * Why a proxy: the SanMar audit data lives in SQLite on the Python
 * side (deliberately — Phase 18). The storefront has a Supabase JWT
 * for admin auth but no direct route to the FastAPI host. This edge
 * function bridges the two: caller-scoped Supabase client validates
 * the admin JWT, then we forward the request server-side with a
 * shared bearer token (SANMAR_ADMIN_API_TOKEN) injected from env so
 * the secret never reaches the browser.
 *
 * Mirrors the auth pattern in `sanmar-force-refresh-style`.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'GET or POST only' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const cacheApiUrl = (Deno.env.get('SANMAR_CACHE_API_URL') ?? '').trim();
  const adminToken = (Deno.env.get('SANMAR_ADMIN_API_TOKEN') ?? '').trim();

  if (!supabaseUrl || !anonKey) {
    console.error('[sanmar-webhook-deliveries] Supabase env vars not configured');
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

  // ── Auth gate (mirror sanmar-force-refresh-style) ──────────────────────────
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

  // ── Forward to FastAPI cache ──────────────────────────────────────────────
  // Pass through the supported filters; ignore everything else so a malformed
  // query string can't surprise the upstream.
  const url = new URL(req.url);
  const params = new URLSearchParams();
  for (const key of ['limit', 'outcome', 'po', 'event']) {
    const v = url.searchParams.get(key);
    if (v) params.set(key, v);
  }

  const trimmed = cacheApiUrl.endsWith('/') ? cacheApiUrl.slice(0, -1) : cacheApiUrl;
  const upstream = `${trimmed}/webhook-deliveries/?${params.toString()}`;

  const upstreamHeaders: Record<string, string> = {
    Accept: 'application/json',
  };
  if (adminToken) {
    upstreamHeaders['Authorization'] = `Bearer ${adminToken}`;
  }

  try {
    const res = await fetch(upstream, { method: 'GET', headers: upstreamHeaders });
    const bodyText = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = { error: 'upstream_invalid_json', raw: bodyText.slice(0, 500) };
    }
    return jsonResponse(body, res.status);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[sanmar-webhook-deliveries] fetch failed:', message);
    return jsonResponse({ error: 'upstream_unreachable', detail: message }, 502);
  }
});
