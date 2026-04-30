-- SanMar operator internal notes — adds a freeform text column to
-- sanmar_orders so admins can attach contextual notes against a PO
-- ("customer called about timing", "logo replaced — verify", etc).
--
-- Surface area:
--   - Read/write only on /admin/sanmar (admin/president via is_admin()).
--   - NEVER exposed to customers via /suivi or any public surface — the
--     /track edge function builds its own response payload from the order
--     status fields and does not project this column.
--
-- Storage:
--   - One TEXT column on the existing public.sanmar_orders table. No new
--     table is needed — notes are 1:1 with PO rows and the column is
--     small enough that a side table would be ceremony for no benefit.
--   - Hard 500-char ceiling enforced both client-side (textarea maxLength
--     + counter) and at the DB layer via a CHECK constraint, so a
--     malicious / buggy client cannot bypass the limit by hitting the
--     REST API directly.
--
-- RLS:
--   - sanmar_orders already has RLS enabled (see migration
--     20260429132247_sanmar_catalog.sql) and an "Admins read all sanmar
--     orders" SELECT policy was added in 20260429161735_sanmar_rls_lockdown.sql.
--   - We add an admin-only UPDATE policy here so the AdminSanMar page can
--     write to internal_notes through the anon key. Non-admins still
--     have only the existing "users see own sanmar orders" SELECT — no
--     write surface — so the column is invisible to them on every read.
--   - Service role continues to bypass RLS for sync/reconcile flows.

ALTER TABLE public.sanmar_orders
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Idempotent CHECK: drop-then-add so re-runs against an already-migrated
-- database (e.g. local dev resets) don't error on duplicate constraint.
ALTER TABLE public.sanmar_orders
  DROP CONSTRAINT IF EXISTS sanmar_orders_internal_notes_length;
ALTER TABLE public.sanmar_orders
  ADD CONSTRAINT sanmar_orders_internal_notes_length
  CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 500);

-- Admin-only UPDATE policy so AdminSanMar (running under the anon key)
-- can mutate the notes column. We deliberately scope this to UPDATE only
-- — no INSERT/DELETE — because rows are created exclusively by the
-- service-role-backed `sanmar-submit-order` edge function, and deletes
-- are not a workflow we expose anywhere.
DROP POLICY IF EXISTS "Admins update sanmar orders" ON public.sanmar_orders;
CREATE POLICY "Admins update sanmar orders" ON public.sanmar_orders
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMENT ON COLUMN public.sanmar_orders.internal_notes IS
  'Operator-only freeform notes (≤500 chars). Admin-only via RLS. Never surfaced to customers.';
