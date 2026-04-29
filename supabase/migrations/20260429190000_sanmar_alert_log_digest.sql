-- Extend sanmar_alert_log.alert_kind to include 'digest'.
--
-- Wave 9 ships a positive heartbeat: a once-per-day "all is well"
-- summary that complements the existing failure / recovery alerts.
-- The CHECK constraint added in 20260429180000_sanmar_alert_log.sql
-- only allowed 'failure', 'recovery', 'transition' — adding the new
-- value requires a constraint replacement (Postgres CHECK constraints
-- aren't directly extensible).
--
-- Drop + re-add with the same name keeps `pg_dump` output stable for
-- diff reviewers. IF EXISTS keeps the migration idempotent across
-- environments where the original migration may have been re-run.

ALTER TABLE public.sanmar_alert_log
  DROP CONSTRAINT IF EXISTS sanmar_alert_log_alert_kind_check;

ALTER TABLE public.sanmar_alert_log
  ADD CONSTRAINT sanmar_alert_log_alert_kind_check
  CHECK (alert_kind IN ('failure', 'recovery', 'transition', 'digest'));
