/**
 * Edge function: sanmar-submit-order
 *
 * Body: full SanmarOrderInput (mirror server-side `submitOrder` arg type
 *       from `_shared/sanmar/orders.ts`)
 *
 * Auth: REQUIRED. Reads `Authorization: Bearer <jwt>`, verifies via
 *       `supabase.auth.getUser(jwt)`. Returns 401 if missing/invalid.
 *
 * On success: also writes a row to `public.sanmar_orders` for our records
 * so we can reconcile + poll status later. Failure to insert the audit row
 * does NOT roll back the SanMar order (it's already submitted upstream) —
 * we log loudly so the operator can repair the audit log.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors } from '../_shared/cors.ts';
import { runSanmar, errorBody } from '../_shared/sanmar-http.ts';
import { submitOrder, type SanmarOrderInput } from '../_shared/sanmar/orders.ts';

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorBody(140, 'Method not allowed')), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Auth gate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response(
      JSON.stringify(errorBody(300, 'Missing or malformed Authorization header')),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const jwt = authHeader.slice('bearer '.length).trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('[sanmar-submit-order] Supabase env vars not configured');
    return new Response(
      JSON.stringify(errorBody(999, 'Internal error', 'Error')),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const callerClient = createClient(supabaseUrl, anonKey);
  let userId: string | null = null;
  try {
    const { data, error } = await callerClient.auth.getUser(jwt);
    if (error || !data.user) {
      return new Response(
        JSON.stringify(errorBody(300, 'Invalid or expired session')),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
    userId = data.user.id;
  } catch (e) {
    console.error('[sanmar-submit-order] auth.getUser failed:', e);
    return new Response(
      JSON.stringify(errorBody(300, 'Authentication check failed')),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Body parse ─────────────────────────────────────────────────────────
  let orderInput: SanmarOrderInput;
  try {
    orderInput = (await req.json()) as SanmarOrderInput;
  } catch {
    return new Response(JSON.stringify(errorBody(140, 'Invalid JSON body')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Submit + audit ─────────────────────────────────────────────────────
  return runSanmar(async () => {
    const result = await submitOrder(orderInput);

    // Persist for our records using the service-role client so we bypass
    // RLS for the insert (the SELECT policy still scopes reads to user_id).
    if (result.transactionId !== 0) {
      const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: insertErr } = await adminClient.from('sanmar_orders').insert({
        va_order_id: orderInput.orderNumber,
        sanmar_transaction_id: result.transactionId,
        user_id: userId,
        order_data: orderInput as unknown as Record<string, unknown>,
      });
      if (insertErr) {
        // Don't fail the request — the SanMar side already accepted. Log
        // loudly so an operator can backfill the audit row.
        console.error(
          '[sanmar-submit-order] sanmar_orders insert failed (order WAS submitted):',
          { transactionId: result.transactionId, orderNumber: orderInput.orderNumber, error: insertErr },
        );
      }
    }

    return result;
  });
});
