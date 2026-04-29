# Prometheus rules + Alertmanager wiring

Phase 9 ships the alerting layer on top of the Phase 8 exporter.

## Files

| File | Purpose |
|------|---------|
| `scrape.yml` | Drop-in `scrape_configs` snippet for `prometheus.yml` |
| `recording_rules.yml` | 5 pre-computed expressions used by alerts + dashboards |
| `alerts.yml` | 7 SLO alert rules over the recording rules + raw metrics |
| `alertmanager-receiver.yml` | Example Alertmanager config wiring to Slack via `SANMAR_ALERT_WEBHOOK_URL` |

## Install

1. **Scrape config** — append the contents of `scrape.yml` into your
   existing `prometheus.yml` under `scrape_configs:`.

2. **Rule files** — copy `recording_rules.yml` and `alerts.yml` to the
   directory referenced by `rule_files:` in `prometheus.yml`. Example:

   ```yaml
   rule_files:
     - /etc/prometheus/rules/sanmar/*.yml
   ```

   Then:

   ```bash
   sudo mkdir -p /etc/prometheus/rules/sanmar
   sudo cp deploy/prometheus/recording_rules.yml /etc/prometheus/rules/sanmar/
   sudo cp deploy/prometheus/alerts.yml /etc/prometheus/rules/sanmar/
   ```

3. **Alertmanager** — merge `alertmanager-receiver.yml` into
   `alertmanager.yml`. Set `SANMAR_ALERT_WEBHOOK_URL` in the
   Alertmanager environment (same webhook the Python `SyncNotifier`
   uses for Phase 7 alerts is fine — Slack will deduplicate).

4. **Reload Prometheus** without a restart:

   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

5. **Reload Alertmanager**:

   ```bash
   curl -X POST http://localhost:9093/-/reload
   ```

## Validate

```bash
# Static rule validation (requires promtool from the prometheus tarball)
promtool check rules deploy/prometheus/recording_rules.yml \
                     deploy/prometheus/alerts.yml

# Static config validation
promtool check config /etc/prometheus/prometheus.yml

# Dry-run alert routing through Alertmanager
amtool config routes test --config.file=/etc/alertmanager/alertmanager.yml \
    service=sanmar alertname=SanmarSyncStale severity=warning
```

The Python test suite includes a structural validator
(`tests/test_prometheus_rules.py`) that runs in CI without `promtool`
installed — it parses the YAML with PyYAML and asserts the rule counts,
required annotations, and severity labels.

## Test alerts manually

Push a fake metric to Prometheus via `node_exporter`'s textfile
collector or directly via `pushgateway` and confirm the alert fires:

```bash
# Force the catalog-delta freshness alert by ageing the metric
cat <<EOF | curl --data-binary @- http://localhost:9091/metrics/job/sanmar
sanmar_last_sync_timestamp_seconds{sync_type="catalog_delta"} $(($(date +%s) - 90000))
EOF
```

Wait for the alert's `for:` window (30m for `SanmarSyncStale`) and
verify a Slack message lands in `#ops-sanmar`.

## The 7 alerts

| Alert | Threshold | for | Severity |
|-------|-----------|-----|----------|
| `SanmarSyncStale` | catalog delta freshness > 24h | 30m | warning |
| `SanmarSyncStaleCritical` | catalog delta freshness > 48h | 30m | critical |
| `SanmarInventoryStale` | inventory freshness > 24h | 1h | warning |
| `SanmarSyncErrorBurst` | error rate > 5% over 5m | 10m | warning |
| `SanmarOpenOrdersHigh` | open orders > 500 | 1h | info |
| `SanmarOrderStuck` | > 50 orders in status 60 | 24h | warning |
| `SanmarExporterDown` | `up{job="sanmar"} == 0` | 5m | critical |

## The 5 recording rules

| Rule | Expression |
|------|------------|
| `sanmar:sync_freshness_seconds` | `time() - max by (sync_type) (sanmar_last_sync_timestamp_seconds)` |
| `sanmar:sync_error_rate_5m` | `rate(sanmar_sync_errors_total[5m])` |
| `sanmar:sync_success_rate_5m` | `rate(sanmar_sync_success_total[5m])` |
| `sanmar:sync_total_runs_24h` | `increase(sanmar_sync_success_total[24h]) + increase(sanmar_sync_errors_total[24h])` |
| `sanmar:open_orders_change_1h` | `deriv(sanmar_orders_open[1h])` |
