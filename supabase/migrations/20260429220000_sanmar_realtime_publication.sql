-- ╭──────────────────────────────────────────────────────────────────────╮
-- │ Wave 16 — Real-time pub on sanmar_sync_log + sanmar_orders            │
-- │                                                                       │
-- │ Why: /admin/sanmar dashboard refreshed only on operator click. Sync   │
-- │ runs and order status transitions were invisible until manual reload.│
-- │ Adding both tables to the `supabase_realtime` publication lets the   │
-- │ AdminSanMar.tsx page subscribe via supabase.channel(...).on(         │
-- │ 'postgres_changes', ...) and react in milliseconds.                  │
-- │                                                                       │
-- │ Safety: idempotent — wrapped in DO blocks that swallow                │
-- │ duplicate_object on re-run. The publication itself ships with every  │
-- │ Supabase project; we only ALTER its membership.                      │
-- │                                                                       │
-- │ RLS still applies on the receiving end — clients without admin or    │
-- │ president role won't see rows from sanmar_orders, mirroring the      │
-- │ existing SELECT policy. sanmar_sync_log is admin-readable too        │
-- │ (lockdown migration 20260429161735), so no leak.                     │
-- ╰──────────────────────────────────────────────────────────────────────╯

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sanmar_sync_log;
EXCEPTION
  WHEN duplicate_object THEN
    -- Already part of the publication; nothing to do.
    NULL;
  WHEN undefined_object THEN
    -- Publication doesn't exist (non-Supabase Postgres). Skip silently
    -- so the migration is portable for self-hosted clones.
    NULL;
END
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sanmar_orders;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END
$$;
