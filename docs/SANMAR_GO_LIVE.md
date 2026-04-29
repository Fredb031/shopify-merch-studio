# SanMar PromoStandards — Go-Live Operator Runbook

**Audience:** Vision Affichage operator handling the SanMar Canada PromoStandards
integration cutover (UAT → PROD).

**Scope:** every step required to flip the site from snapshot-only ordering to
live SanMar product/inventory/pricing/media + order submission + tracking. The
TypeScript integration (`supabase/functions/_shared/sanmar/`, 9 edge functions,
3 pg_cron-driven sync jobs, AdminSanMar dashboard, `/suivi` SanMar block) is
already merged on `main` — this runbook only covers the SanMar-side enablement,
secret/env wiring, migration application, function deployment, smoke test, and
the gate flip.

**Estimated wall time:** 3–7 business days, gated on SanMar EDI response time
(steps 1–3) and Supabase support response time (step 2).

---

## Prerequisites

- Supabase project: production project (whatever currently serves
  `visionaffichage.com`)
- SanMar Canada customer ID (already issued — confirm with sales)
- An operator with Supabase project **Owner** role (needed to set secrets,
  apply migrations, deploy edge functions, set Postgres GUC vars)
- The Supabase CLI installed locally (`brew install supabase/tap/supabase`)
- Repo cloned + `supabase login` run + project linked
  (`supabase link --project-ref <ref>`)

---

## Ordered checklist

### 1. Email SanMar to enable PromoStandards services

Send to **edi@sanmarcanada.com** (CC the Vision Affichage owner). Subject:
`Vision Affichage — Enable PromoStandards services for customer ID <ID>`.

Request these six services be enabled on the customer account, listing the
exact service name + version we integrate against:

- **Product Data 2.0.0**
- **Inventory 2.0.0**
- **Pricing 1.0.0**
- **Media Content 1.1.0**
- **Purchase Order 1.0.0**
- **Order Status 2.0.0**

Ask SanMar to confirm both **UAT** and **PROD** endpoint availability and to
return the UAT credentials. Note that the production cutover cannot happen
until UAT smoke-tests green (step 10).

### 2. Submit Supabase egress IPs for SanMar IP whitelisting

SanMar requires inbound traffic from a whitelisted IP set. Pull the egress IPs
of the Supabase project's edge functions, then send them in the same email
thread as step 1.

How to fetch egress IPs: see Supabase docs —
<https://supabase.com/docs/guides/platform/network-restrictions>
(also surfaced in the Supabase project dashboard under **Settings → Database →
Network restrictions** and **Settings → Edge Functions**).

If Supabase has not yet exposed a stable egress IP for your project, file a
Supabase support ticket asking for one — SanMar will not enable PROD until the
IPs are static.

### 3. Sign EDI agreement

SanMar's EDI/PromoStandards usage requires a one-time signed agreement. They
will send a PDF in reply to the step-1 email. Sign it, return it, store a copy
in Google Drive under `Vision Affichage / SanMar / EDI agreement`.

### 4. Set Supabase secrets

Once SanMar returns UAT credentials, set them as Supabase secrets so the edge
functions can read them at runtime. From the project root:

```bash
supabase secrets set \
  SANMAR_CUSTOMER_ID='<id from SanMar>' \
  SANMAR_PASSWORD='<password from SanMar>' \
  SANMAR_MEDIA_PASSWORD='<media password from SanMar — may differ>' \
  SANMAR_ENV='uat'
```

`SANMAR_ENV` flips between `uat` and `prod`. Keep it on `uat` until step 12.
The `_shared/sanmar/` client reads it to decide which SanMar endpoint to call.

### 5. Apply migrations in order

Apply the three SanMar migrations in this exact order:

```bash
supabase db push
```

Or, if applying remotely one at a time (no local Supabase running):

1. `20260429132247_sanmar_catalog.sql` — creates `sanmar_products`,
   `sanmar_inventory`, `sanmar_pricing`, `sanmar_media`, `sanmar_orders`,
   `sanmar_sync_log` tables + RLS.
2. `20260429174952_sanmar_pg_cron.sql` — schedules the three sync jobs
   (catalog, inventory, reconcile-orders).
3. `20260429175214_sanmar_sync_indexes.sql` — adds indexes on
   `sanmar_sync_log` for the dashboard's last-5-runs widget.

Verify with `select count(*) from sanmar_products;` (should return `0`,
not error).

### 6. Enable pg_cron + pg_net extensions

The pg_cron migration assumes both extensions are available. In the Supabase
dashboard: **Database → Extensions → search "pg_cron"** → enable. Repeat for
**pg_net**. Some Supabase plans require enabling these via support ticket — if
the toggle is greyed out, file a ticket.

### 7. Set Postgres GUC vars

The pg_cron jobs invoke the sync edge functions over `pg_net.http_post`. They
read the URL, service-role key, and a shared secret from Postgres GUC. Set
them via the Supabase SQL editor (or `psql`):

```sql
alter database postgres set "app.settings.supabase_url"     = 'https://<project-ref>.supabase.co';
alter database postgres set "app.settings.service_role_key" = '<service role key>';
alter database postgres set "app.settings.cron_secret"      = '<random 32+ char secret — store this>';
```

Generate the cron secret with `openssl rand -hex 32`. Store it in your secret
manager — step 9 needs the same value.

After running these, **reconnect** any open Postgres session so the new GUCs
are visible to pg_cron jobs.

### 8. Deploy the 9 edge functions

```bash
supabase functions deploy \
  sanmar-products \
  sanmar-inventory \
  sanmar-pricing \
  sanmar-media \
  sanmar-submit-order \
  sanmar-order-status \
  sanmar-sync-catalog \
  sanmar-sync-inventory \
  sanmar-reconcile-orders
```

Confirm each appears under **Edge Functions** in the dashboard with a green
"Active" status.

### 9. Set the CRON_SECRET edge-function secret

The sync functions verify the inbound `Authorization: Bearer <CRON_SECRET>`
header against an env var. Set it to the same value as
`app.settings.cron_secret` from step 7:

```bash
supabase secrets set CRON_SECRET='<same value as step 7>'
```

If the values drift, the pg_cron jobs will fire but the edge functions will
reject them with 401 and the dashboard's last-5-runs widget will show
nothing but failures.

**Optional:** set `SANMAR_ALERT_WEBHOOK_URL` to a Slack incoming webhook
or Zapier catch URL to get alerts on sync failures. When this env var is
configured, the three sync edge functions (`sanmar-sync-catalog`,
`sanmar-sync-inventory`, `sanmar-reconcile-orders`) POST a Slack-compatible
payload to the URL whenever a run finishes with one or more errors —
operators no longer have to remember to check the dashboard. Leave it
unset and alerting is a silent no-op (handy in dev / pre-go-live).

```bash
supabase secrets set SANMAR_ALERT_WEBHOOK_URL='https://hooks.slack.com/services/...'
# or a Zapier "Catch Hook" URL: https://hooks.zapier.com/hooks/catch/...
```

### 10. Smoke test (UAT)

1. Open `https://visionaffichage.com/admin/sanmar` (the dashboard route).
2. Confirm the "Last 5 sync runs" widget renders without a network error
   banner. It is OK for the list to be empty at this point.
3. Click **Run catalog sync now** (or hit the `sanmar-sync-catalog` function
   directly with the `CRON_SECRET` bearer).
4. Refresh the dashboard. Verify a row appears in the widget with
   `status = ok` and a non-zero row count.
5. SQL spot-check: `select count(*) from sanmar_products;` should return >0
   matching the SanMar UAT catalog size.
6. Hit `sanmar-products` directly (curl with the anon key) for a known
   UAT styleNumber — confirm it returns SanMar XML decoded into JSON.

If any of the above fail, **do not proceed**. Common failure modes:

- 401 from edge function → CRON_SECRET / GUC mismatch (steps 7, 9).
- Empty rows after a successful sync → SanMar has not enabled the service
  yet (chase step 1).
- Network error in the admin widget → IPs not whitelisted (step 2).

### 11. Flip the front-end gate

After a green smoke test, flip the Vite gate so `/suivi` and the order
checkout start using SanMar live data:

```
VITE_SANMAR_NEXT_GEN=true
```

Set it in the Vercel/Lovable project's environment, then redeploy. The
`SANMAR_GATE_ENABLED` constant in `src/pages/TrackOrder.tsx` reads it at
module load — without a redeploy the change is invisible.

### 12. Production cutover

Once UAT has been green for ≥48 hours and at least one real test order has
been submitted + tracked end-to-end, schedule the PROD cutover:

1. Email SanMar (same thread) requesting PROD enablement of the same six
   services.
2. Receive PROD credentials.
3. Run `supabase secrets set SANMAR_CUSTOMER_ID=… SANMAR_PASSWORD=…
   SANMAR_MEDIA_PASSWORD=… SANMAR_ENV='prod'` — note the
   **`SANMAR_ENV` flip from `uat` to `prod`** is what tells the
   `_shared/sanmar/` client to hit the production endpoint.
4. Re-run step 10's smoke test against PROD. Same pass criteria.
5. Announce cutover to the team. Watch the AdminSanMar dashboard for the
   first 24 hours — failed sync rows surface there before they show up in
   customer complaints.

---

## Rollback

Set `SANMAR_ENV=uat` again (and/or `VITE_SANMAR_NEXT_GEN=false`) and
redeploy. The site silently falls back to the Shopify-snapshot path
because `TrackOrder.tsx` and the order flow are written defensively
around the gate. The `sanmar_*` tables stay in place — they're additive,
nothing else reads from them.

---

## Reference

- Integration code: `supabase/functions/_shared/sanmar/` (1844 lines)
- Edge functions: `supabase/functions/sanmar-*/`
- Migrations: `supabase/migrations/2026042913224*_sanmar_*.sql`
- Admin dashboard: `src/pages/admin/AdminSanMar.tsx`
- Customer-facing tracking: `src/pages/TrackOrder.tsx` (`/suivi/:orderNumber`)
- Tests: `supabase/functions/_shared/sanmar/__tests__/`

---

## Optional but recommended: daily digest

The SanMar TS layer ships proactive failure alerts (red) and recovery
alerts (green) via `notify.ts`. Those tell operators when something
breaks or just healed — but on a quiet day, silence is ambiguous: did
the syncs run cleanly, or has cron stopped firing entirely?

The `sanmar-daily-digest` edge function fills that gap with a
once-per-day "all is well" heartbeat at **08:00 ET** (12:00 UTC, with
±1 h DST drift we accept). The Slack-format message contains:

- **Sync stats (last 24 h)**: total runs, successes vs failures, broken
  down per sync type (catalog / inventory / order_status). Plus
  aggregate totals: products synced and inventory snapshots taken.
- **Open orders** grouped by status name.
- **Open AR balance** in CAD — sum of `total_amount_cad` across rows
  with `status_id < 80` (or NULL).

**No additional config**: the digest reuses the same
`SANMAR_ALERT_WEBHOOK_URL` env var as the failure / recovery alerts.
Once the digest migrations (`20260429190000_sanmar_alert_log_digest.sql`
and `20260429191000_sanmar_digest_cron.sql`) are applied and the
function is deployed, it runs automatically. Each run records an audit
row in `sanmar_alert_log` with `alert_kind='digest'`.

To disable: `SELECT cron.unschedule('sanmar-daily-digest');` — the
edge function and audit table stay in place, just no longer triggered.
