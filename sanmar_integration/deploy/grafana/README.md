# Grafana — SanMar Ops dashboard

`sanmar-ops.json` is the 6-panel ops dashboard fed by the
SanMar Prometheus exporter (`/metrics` on port 9100).

## Import

1. Grafana → **Dashboards** → **New** → **Import**.
2. Upload `sanmar-ops.json` (or paste the contents).
3. When prompted, set the `DS_PROMETHEUS` data source variable to your
   Prometheus instance — the UID is usually `prometheus`.
4. Save.

## Prometheus scrape config

Add this job to your Prometheus `scrape_configs`:

```yaml
scrape_configs:
  - job_name: sanmar
    scrape_interval: 30s
    static_configs:
      - targets: ['sanmar-host:9100']
```

The scrape interval is intentionally generous — the SanMar
exporter recomputes every metric from SQLite on each scrape, so 30s
gives the dashboard fresh data without hammering the cache file.

## Panels

| # | Panel                              | Source metric                                |
|---|------------------------------------|----------------------------------------------|
| 1 | Sync runs (24h)                    | `sanmar_sync_success_total`, `sanmar_sync_errors_total` |
| 2 | Sync duration (p50/p95)            | `sanmar_sync_duration_seconds_bucket`        |
| 3 | Open orders by status              | `sanmar_orders_by_status`                    |
| 4 | Inventory snapshots written / hour | `sanmar_inventory_snapshots_24h`             |
| 5 | Time since last sync               | `sanmar_last_sync_timestamp_seconds`         |
| 6 | Recent errors (1h rate)            | `sanmar_sync_errors_total`                   |

A vertical annotation marks each completed sync run, drawn from
changes in `sanmar_last_sync_timestamp_seconds`.

## Variables

* `$sync_type` — multi-select, populated from
  `label_values(sanmar_sync_errors_total, sync_type)`. Filters every
  panel except panel 3 (which is per-status, not per-type).
* `$DS_PROMETHEUS` — your Prometheus data source.
