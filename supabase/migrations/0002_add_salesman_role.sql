-- 0002_add_salesman_role.sql
--
-- Adds 'salesman' to the profiles.role CHECK constraint.
--
-- IMPORTANT: This migration is NOT applied automatically by the site
-- build/deploy. Apply it manually in Supabase Studio → SQL editor (or
-- via `supabase db push` from a machine with DB creds) BEFORE granting
-- any profile row role='salesman' — otherwise the UPDATE will be
-- rejected by the constraint.
--
-- Safe to re-run: the drop + add pair is idempotent under
-- `if exists` / `if not exists` guards where Postgres supports them.
--
-- Rollback: re-apply 0001_auth_quotes_invites.sql's original
-- constraint. Any profile rows set to 'salesman' before rollback must
-- be migrated to a different role first or the rollback will fail.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('president','admin','salesman','vendor','client'));
