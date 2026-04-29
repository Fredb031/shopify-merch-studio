/**
 * Shared CORS headers for Supabase edge functions.
 *
 * Every Vision Affichage edge function imports `corsHeaders` and `handleCors`
 * to keep the preflight + response shape consistent. We intentionally allow
 * `*` because edge functions live behind a Supabase JWT — the auth gate is
 * the JWT verification, not the origin check.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

/**
 * Returns a 204 preflight response for OPTIONS requests, or `null` if the
 * request is not a preflight. Pattern:
 *
 *   const pre = handleCors(req); if (pre) return pre;
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

/** JSON response helper with CORS headers + content-type already set. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
