/**
 * Cache hit/miss instrumentation for the SanMar TS-layer router.
 *
 * Phase 12 wires every router dispatch through `recordCacheOutcome` so we
 * can observe cache performance without dropping into edge-function logs.
 * The shape is a small in-process counter map flushed on a 60 s cadence
 * to `public.sanmar_cache_metrics` (see migration 20260429210000) via
 * UPSERT keyed on (bucket_at, operation, outcome, reason).
 *
 * Why batched in-process instead of per-call inserts:
 *   - Edge functions are short-lived but can serve many requests per
 *     warm instance (think: a sync run iterating over 500 styles). A
 *     per-call INSERT would inflate write volume by an order of magnitude
 *     vs the actual signal we care about (per-minute counts).
 *   - The 60 s flush cadence aligns with the per-minute bucketing in the
 *     table — a single bucket is updated atomically via UPSERT instead
 *     of accumulating dozens of rows per minute.
 *   - We accept the trade-off: if the edge instance is killed mid-cycle
 *     we lose at most ~60 s of counter values. For a hit-ratio dashboard
 *     that's acceptable (the next minute's bucket fills in immediately).
 *
 * Failure mode: flush errors are swallowed (logged to console.warn).
 * Observability is best-effort — never block the actual SOAP/cache call
 * because telemetry is broken. Mirrors the same convention as
 * `logSyncRun` in sync.ts.
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** Operation label — matches the router's three cache-able routes plus
 * a fourth slot for the orders/submit path which doesn't go through the
 * cache yet but will be tracked the same way once it does. */
export type CacheOperation = 'products' | 'inventory' | 'pricing' | 'orders';

/** Cache outcome — cache served the request or we fell back to SOAP. */
export type CacheOutcome = 'hit' | 'miss';

/**
 * Why a miss happened (NULL on a hit). Constrained to a small enum so
 * the dashboard can group cleanly without string-cleanup logic.
 *
 *   disabled    — SANMAR_CACHE_API_URL unset entirely
 *   route_off   — cache configured but this route not in SANMAR_CACHE_ROUTES
 *   not_found   — cache returned 404 (style not in catalogue yet)
 *   5xx         — cache returned 500/502/503/504
 *   timeout     — cache request aborted past timeout_ms
 *   error       — anything else (network blip, JSON parse, 4xx other than 404)
 */
export type CacheMissReason =
  | 'disabled'
  | 'route_off'
  | 'not_found'
  | '5xx'
  | 'timeout'
  | 'error';

/** Composite counter key. Joined with '|' for Map<string, number>. */
type CounterKey = string;

/** Build a stable string key from the tuple — order matters for parsing. */
function makeKey(op: CacheOperation, outcome: CacheOutcome, reason: CacheMissReason | null): CounterKey {
  return `${op}|${outcome}|${reason ?? ''}`;
}

function parseKey(key: CounterKey): {
  operation: CacheOperation;
  outcome: CacheOutcome;
  reason: CacheMissReason | null;
} {
  const [op, outcome, reasonRaw] = key.split('|');
  return {
    operation: op as CacheOperation,
    outcome: outcome as CacheOutcome,
    reason: reasonRaw === '' ? null : (reasonRaw as CacheMissReason),
  };
}

/** Flush cadence — once per minute matches the bucket granularity. */
const FLUSH_INTERVAL_MS = 60_000;

/**
 * Module-level state. Single counter map shared across all router
 * dispatches in this isolate; flush timer started lazily on first record.
 *
 * In tests we can reset via `_resetCacheMetricsForTest` so the counter
 * doesn't leak across `it` blocks. Production callers don't touch this.
 */
const counters: Map<CounterKey, number> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
/** Override hook for tests — when set, replaces createClient. */
let supabaseClientOverride: SupabaseClient | null = null;

/** Round a date down to the start of its minute. UPSERT key alignment. */
function bucketOf(d: Date = new Date()): Date {
  const ms = d.getTime();
  return new Date(ms - (ms % 60_000));
}

/**
 * Lazy-create the supabase admin client. Reads SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from env — same pattern as the rest of the
 * sanmar edge functions. Returns null when env is unset (e.g. local dev
 * without supabase wired up) so the flush silently no-ops instead of
 * exploding.
 */
async function getSupabaseAdmin(): Promise<SupabaseClient | null> {
  if (supabaseClientOverride) return supabaseClientOverride;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  // Dynamic import via an opaque specifier so vite's static
  // import-analysis (used by vitest) doesn't try to resolve `jsr:…` at
  // bundle time — the unit-test Node runtime never reaches here because
  // SUPABASE_URL is unset in fixtures. The string is reconstructed at
  // call time so it's untouchable by tree-shakers.
  const spec = ['jsr', '@supabase/supabase-js@2'].join(':');
  const mod = (await import(/* @vite-ignore */ spec)) as {
    createClient: (
      u: string,
      k: string,
      o: unknown,
    ) => SupabaseClient;
  };
  return mod.createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Flush the in-memory counter map to `sanmar_cache_metrics`. Each entry
 * becomes an UPSERT keyed on (bucket_at, operation, outcome, reason)
 * with `count = current + delta`.
 *
 * The supabase-js client doesn't expose a native "atomic increment" so
 * we read-modify-write per row inside a single fetch — for the volumes
 * we expect (≤ 24 keys per minute = 4 ops × 6 reasons) this is fine.
 *
 * Errors are logged but never thrown — telemetry must not break callers.
 */
export async function flushCacheMetrics(): Promise<void> {
  if (counters.size === 0) return;
  if (flushInFlight) return;
  flushInFlight = true;

  // Snapshot + clear so concurrent records during the flush land in a
  // fresh bucket rather than getting wiped on success.
  const snapshot = new Map(counters);
  counters.clear();
  const bucket = bucketOf().toISOString();

  try {
    const supabase = await getSupabaseAdmin();
    if (!supabase) return;

    for (const [key, delta] of snapshot.entries()) {
      const { operation, outcome, reason } = parseKey(key);
      // Read-modify-write: select the current row (if any) and upsert
      // with the summed count. Conflict target uses the unique index
      // (bucket_at, operation, outcome, COALESCE(reason, '')) defined
      // in the migration. supabase-js requires the conflict target as
      // a comma-joined column list.
      const { data: existing, error: selErr } = await supabase
        .from('sanmar_cache_metrics')
        .select('count')
        .eq('bucket_at', bucket)
        .eq('operation', operation)
        .eq('outcome', outcome)
        .is('reason', reason as string | null)
        .maybeSingle<{ count: number }>();
      if (selErr) {
        console.warn(`[sanmar/cache_metrics] select failed for ${key}: ${selErr.message}`);
        // Re-merge so the next flush retries.
        counters.set(key, (counters.get(key) ?? 0) + delta);
        continue;
      }
      const next = (existing?.count ?? 0) + delta;
      const { error: upErr } = await supabase
        .from('sanmar_cache_metrics')
        .upsert(
          {
            bucket_at: bucket,
            operation,
            outcome,
            reason,
            count: next,
          },
          { onConflict: 'bucket_at,operation,outcome,reason' },
        );
      if (upErr) {
        console.warn(`[sanmar/cache_metrics] upsert failed for ${key}: ${upErr.message}`);
        counters.set(key, (counters.get(key) ?? 0) + delta);
      }
    }
  } catch (e) {
    console.warn(`[sanmar/cache_metrics] flush threw: ${(e as Error).message}`);
    // Best-effort: re-merge the whole snapshot so the next tick retries.
    for (const [key, delta] of snapshot.entries()) {
      counters.set(key, (counters.get(key) ?? 0) + delta);
    }
  } finally {
    flushInFlight = false;
  }
}

/**
 * Record one cache outcome. Increments the in-memory counter and arms
 * the per-minute flush timer if it isn't already.
 *
 * Hits pass `reason = null`; misses pass one of the {@link CacheMissReason}
 * values.
 */
export function recordCacheOutcome(
  operation: CacheOperation,
  outcome: CacheOutcome,
  reason: CacheMissReason | null,
): void {
  const key = makeKey(operation, outcome, outcome === 'hit' ? null : reason);
  counters.set(key, (counters.get(key) ?? 0) + 1);

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      // Fire and forget — flushCacheMetrics swallows its own errors.
      void flushCacheMetrics();
    }, FLUSH_INTERVAL_MS);
    // Don't keep the Deno worker alive purely for the flush timer.
    // `unref` exists on Deno's setTimeout return as a method; guard for
    // node-style numeric returns by checking before calling.
    if (typeof (flushTimer as { unref?: () => void }).unref === 'function') {
      (flushTimer as { unref: () => void }).unref();
    }
  }
}

/**
 * Classify a cache_api error into one of the canonical miss reasons.
 *
 * Matches the error-message conventions in cache_api.ts:
 *   - "aborted after Nms"     → 'timeout'
 *   - "upstream 5xx"           → '5xx'
 *   - "network error" / other  → 'error'
 *
 * Used by router.ts so the catch site can record the right bucket
 * without re-implementing string parsing inline.
 */
export function classifyCacheError(err: unknown): CacheMissReason {
  const msg = err instanceof Error ? err.message : String(err);
  if (/abort/i.test(msg)) return 'timeout';
  if (/upstream\s+5\d{2}/i.test(msg)) return '5xx';
  return 'error';
}

// ── Test-only helpers ──────────────────────────────────────────────────────
// These are exported but underscore-prefixed by convention so the
// production call sites never reach for them. The router tests use
// `_resetCacheMetricsForTest` between cases so counter state doesn't
// leak across `it` blocks.

/** Wipe the counter map + cancel any pending flush. */
export function _resetCacheMetricsForTest(): void {
  counters.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushInFlight = false;
  supabaseClientOverride = null;
}

/** Return a readonly snapshot of the current counters for assertions. */
export function _peekCacheMetricsForTest(): ReadonlyMap<CounterKey, number> {
  return new Map(counters);
}

/** Inject a mocked SupabaseClient (vitest). */
export function _setSupabaseClientForTest(client: SupabaseClient | null): void {
  supabaseClientOverride = client;
}
