-- SanMar RLS lockdown — close anon-key write access on catalog & sync_log,
-- and add admin/president read on orders so AdminSanMar can show all rows.
--
-- Background:
--   The original migration (20260429132247_sanmar_catalog.sql) left RLS OFF
--   on `sanmar_catalog` and `sanmar_sync_log` with a comment "operator-only
--   / public-read; we leave RLS off until a consumer needs row-level
--   scoping". That intent is wrong for the deployment model — the frontend
--   uses the public anon key (visible in any browser). With RLS disabled,
--   PostgREST honours table-level GRANTs, which Supabase grants broadly to
--   `anon` by default. Net effect: anyone with the anon key could DELETE
--   the entire SanMar catalog or wipe sync logs via a single REST call.
--
--   `sanmar_orders` has RLS on, but the only read policy is "users see own
--   rows". AdminSanMar (rendered behind the `sanmar:read` permission for
--   admin/president) cannot SELECT other users' orders without a service
--   key, which the frontend deliberately doesn't ship.
--
-- Service-role context:
--   The `service role full access` policy on sanmar_orders is redundant
--   (service_role bypasses RLS by default) but harmless. We mirror the
--   pattern on the other two tables for explicitness — sync edge functions
--   use the service role and will continue to write freely.
--
-- Defensive `drop policy if exists` so the migration is idempotent if a
-- previous partial apply left fragments behind.

-- ── sanmar_catalog ────────────────────────────────────────────────────────
-- Read: any authenticated user (storefront listing). Catalog rows are
-- product data, no PII. We do not allow `anon` to read because the catalog
-- powers logged-in workflows (quote builder, AdminSanMar). Frontend
-- anonymous browsing of the SanMar catalog goes through the
-- `sanmar-products` edge function, not direct table access.
-- Write: admin/president only. Sync edge functions use service role.

alter table public.sanmar_catalog enable row level security;

drop policy if exists "Authenticated read sanmar catalog" on public.sanmar_catalog;
create policy "Authenticated read sanmar catalog" on public.sanmar_catalog
  for select to authenticated using (true);

drop policy if exists "Admins manage sanmar catalog" on public.sanmar_catalog;
create policy "Admins manage sanmar catalog" on public.sanmar_catalog
  for all using (public.is_admin()) with check (public.is_admin());

-- ── sanmar_sync_log ──────────────────────────────────────────────────────
-- Read: admin/president only (operator dashboard). Writes happen exclusively
-- from sync edge functions running under the service role, so no client
-- write policy is intentionally defined — anything not covered by a policy
-- is denied for non-bypass roles.

alter table public.sanmar_sync_log enable row level security;

drop policy if exists "Admins read sanmar sync log" on public.sanmar_sync_log;
create policy "Admins read sanmar sync log" on public.sanmar_sync_log
  for select using (public.is_admin());

-- ── sanmar_orders ────────────────────────────────────────────────────────
-- Existing policies (own-row SELECT, service-role ALL) stay in place.
-- We add an admin/president SELECT so AdminSanMar can show every order
-- without needing the service key client-side. Writes still go through
-- sanmar-submit-order (service role), so no admin write policy is added.

drop policy if exists "Admins read all sanmar orders" on public.sanmar_orders;
create policy "Admins read all sanmar orders" on public.sanmar_orders
  for select using (public.is_admin());
