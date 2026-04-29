-- SanMar pg_cron health surface
--
-- Wave 6 follow-up: the operator console at /admin/sanmar shows recent
-- sync runs from `sanmar_sync_log`, but that table only records what
-- the edge functions wrote — if pg_cron itself failed (DNS, GUC missing,
-- net.http_post timeout) the log is silent. This migration exposes the
-- live state of the three sanmar-* scheduled jobs so the dashboard can
-- surface "last run / status / duration" for each.
--
-- Postgres restricts `cron.*` to the `postgres` superuser by default.
-- Granting USAGE on the cron schema to `authenticated` would let any
-- logged-in user enumerate every scheduled job in the database — too
-- broad. Instead we wrap the join in a SECURITY DEFINER function that
-- (a) only returns rows where jobname LIKE 'sanmar-%' and (b) checks
-- `public.is_admin()` before returning anything.

CREATE OR REPLACE FUNCTION public.get_sanmar_cron_health()
RETURNS TABLE (
  jobname           text,
  schedule          text,
  active            boolean,
  last_run_at       timestamptz,
  last_status       text,
  last_duration_s   double precision,
  last_message      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  -- Auth guard — mirror RLS policies on sanmar_* tables. Anonymous or
  -- non-admin callers get an empty result rather than an exception so
  -- the dashboard's soft-empty-state pattern still works in mis-auth
  -- conditions, and we never leak that cron jobs exist at all.
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    (
      SELECT MAX(d.start_time)
      FROM cron.job_run_details d
      WHERE d.jobid = j.jobid
    ) AS last_run_at,
    (
      SELECT d.status::text
      FROM cron.job_run_details d
      WHERE d.jobid = j.jobid
      ORDER BY d.start_time DESC
      LIMIT 1
    ) AS last_status,
    (
      SELECT EXTRACT(EPOCH FROM (d.end_time - d.start_time))::double precision
      FROM cron.job_run_details d
      WHERE d.jobid = j.jobid
      ORDER BY d.start_time DESC
      LIMIT 1
    ) AS last_duration_s,
    (
      SELECT d.return_message::text
      FROM cron.job_run_details d
      WHERE d.jobid = j.jobid
      ORDER BY d.start_time DESC
      LIMIT 1
    ) AS last_message
  FROM cron.job j
  WHERE j.jobname LIKE 'sanmar-%'
  ORDER BY j.jobname;
END;
$$;

-- Lock the function down: revoke the implicit PUBLIC EXECUTE grant
-- and only re-grant to authenticated. The is_admin() check inside
-- the function body keeps non-admin authenticated callers from seeing
-- anything, but revoking PUBLIC stops anonymous callers from even
-- entering the function and burning a row-lookup against profiles.
REVOKE ALL ON FUNCTION public.get_sanmar_cron_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sanmar_cron_health() TO authenticated;

COMMENT ON FUNCTION public.get_sanmar_cron_health() IS
  'Returns live health of sanmar-* pg_cron jobs (jobname, schedule, active, last run/status/duration/message). SECURITY DEFINER, gated by public.is_admin().';
