-- pg_cron schedule for the daily SanMar digest edge function.
--
-- Fires at 12:00 UTC = 08:00 EDT / 07:00 EST. We tolerate the ±1 h DST
-- drift rather than splitting into two schedules — the digest is a
-- morning heartbeat, not a real-time signal, and operators care about
-- "did I get it before lunch" not the exact minute.
--
-- Lands well after:
--   - sanmar-sync-catalog       (Sun 03:00 UTC, weekly)
--   - sanmar-sync-inventory     (daily 05:15 UTC)
-- so the digest reflects today's runs without racing them.
--
-- Same auth posture as the other sanmar cron jobs: x-cron-secret
-- header read from the GUC `app.settings.cron_secret`. The edge
-- function does NOT require a Supabase JWT (cron + net.http_post
-- can't carry one), and the constant-time check in
-- _shared/sanmar/sync.ts gates the rest of the handler.
--
-- pg_cron + pg_net extensions are already enabled by the earlier
-- 20260429174952_sanmar_pg_cron.sql migration; we don't recreate them.

DO $$
BEGIN
  PERFORM cron.unschedule('sanmar-daily-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sanmar-daily-digest',
  '0 12 * * *',  -- 12:00 UTC ≈ 08:00 ET (DST drift ±1h, acceptable)
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sanmar-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret')
    )
  );
  $$
);
