-- SanMar cache hit/miss observability table.
--
-- Phase 12 wires the TS-layer router (supabase/functions/_shared/sanmar/router.ts)
-- so every dispatch records a (operation, outcome, reason) tuple. The router
-- batches counters in-process and flushes per minute via UPSERT into this
-- table. The /admin/sanmar dashboard reads aggregated counts from here to
-- render the "Cache hit ratio (24h)" widget — four stat tiles, one per
-- operation, plus a small ratio bar.
--
-- Schema choices:
--   - bucket_at is the per-minute floor (date_trunc('minute', now())) so
--     the (op, outcome, reason, bucket_at) composite is the natural UPSERT
--     key — collisions inside a single minute fold into a single counter
--     update instead of inflating row count.
--   - count is INT (4-byte) — at the volumes we're tracking (every router
--     call, peak ~hundreds/min during a sync) we'd need 70+ years to
--     overflow a per-minute bucket. Cheaper than BIGINT for this shape.
--   - outcome is the boundary distinction (hit vs miss). reason narrows
--     misses (disabled, route_off, not_found, 5xx, timeout, error) so
--     dashboards can distinguish "cache is healthy and we just don't
--     have this style yet" (not_found) from "cache is broken" (5xx /
--     timeout / error). reason is NULL for hits.
--   - id is BIGSERIAL because we expect lots of rows over time (one per
--     (op, outcome, reason, minute) tuple — roughly 4 ops × 6 reasons =
--     24 possible rows per minute, ≈ 35k/day worst case, ≈ 12M/year).
--     A retention job can prune rows older than e.g. 30 days; that's a
--     follow-up if storage becomes a concern.
--
-- RLS: admin-only SELECT, mirroring sanmar_alert_log. Writes happen
-- exclusively from edge functions under the service role (which bypasses
-- RLS), so no INSERT/UPDATE/DELETE policy is defined — anything not
-- covered is denied.

CREATE TABLE IF NOT EXISTS public.sanmar_cache_metrics (
  id BIGSERIAL PRIMARY KEY,
  bucket_at TIMESTAMPTZ NOT NULL,
  operation TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('hit', 'miss')),
  reason TEXT,
  count INT NOT NULL DEFAULT 0
);

-- Composite uniqueness for the per-minute UPSERT key. Treats NULL reason
-- (hits) as identifiable: COALESCE is needed because a UNIQUE INDEX
-- treats two NULLs as distinct in Postgres < 15. We ship to PG 15+ so a
-- partial-NULL-friendly NULLS NOT DISTINCT would also work, but the
-- COALESCE form is portable and self-documenting.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sanmar_cache_metrics_bucket_unique
  ON public.sanmar_cache_metrics (
    bucket_at,
    operation,
    outcome,
    COALESCE(reason, '')
  );

-- Read-path index: dashboard queries the last 24h ordered by bucket DESC.
CREATE INDEX IF NOT EXISTS idx_sanmar_cache_metrics_bucket
  ON public.sanmar_cache_metrics (bucket_at DESC);

ALTER TABLE public.sanmar_cache_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads sanmar_cache_metrics" ON public.sanmar_cache_metrics;
CREATE POLICY "Admin reads sanmar_cache_metrics" ON public.sanmar_cache_metrics
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.sanmar_cache_metrics IS
  'Per-minute cache hit/miss counters from the SanMar TS router. Service-role writes (UPSERT on (bucket_at, operation, outcome, reason)); admin SELECT via RLS.';
