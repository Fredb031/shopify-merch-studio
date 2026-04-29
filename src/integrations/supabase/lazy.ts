// OP-8 (Phase 8 follow-up) — lazy-import wrapper around the supabase
// client so the ~196KB supabase chunk is NOT pulled into the eagerly
// loaded landing-page graph. Lighthouse Phase 8 audit flagged 92KB of
// unused JS (82% of the supabase chunk weight) on first paint because
// `authStore.ts` (which Navbar/AuthGuard/LoginModal all import) eagerly
// imported `@/integrations/supabase/client`, dragging the supabase
// chunk into Index's static import graph.
//
// This wrapper memoises a single dynamic import so callers that need
// the client (auth events, admin actions, profile sync) get the same
// instance via `await getSupabase()`. The first caller pays the
// network cost; subsequent callers re-use the resolved promise.
//
// Why a singleton Promise (not the client itself)? Because resolving
// the promise asynchronously is what lets Vite emit a DYNAMIC import
// edge for `./client`, which keeps the supabase chunk out of the
// eager graph. Returning the SupabaseClient directly would force the
// caller to await it too, but the Promise pattern matches existing
// `await supabase.X.Y` usage cleanly: `(await getSupabase()).auth.X`.
//
// Eager admin pages (`AdminDashboard`, `AdminUsers`, etc.) that ALREADY
// live behind a `lazy()` boundary in App.tsx can keep using the
// synchronous `supabase` re-export from `./client` — once those routes
// mount, the supabase chunk is loaded anyway, and rewriting every
// `supabase.from(...)` to `(await getSupabase()).from(...)` would be
// noisy. The pragmatic split: `lazy.ts` for code in the eager graph
// (authStore module init, etc.), `client.ts` for code already lazy.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let clientPromise: Promise<SupabaseClient<Database>> | null = null;

/**
 * Returns the memoised supabase client, dynamically importing the
 * client module (and its `@supabase/supabase-js` dependency) on first
 * call. Safe to invoke from module top-level — the dynamic import is
 * what triggers Vite to emit a separate chunk and keeps it out of the
 * landing-page eager graph.
 */
export function getSupabase(): Promise<SupabaseClient<Database>> {
  if (!clientPromise) {
    clientPromise = import('./client').then((m) => m.supabase);
  }
  return clientPromise;
}
