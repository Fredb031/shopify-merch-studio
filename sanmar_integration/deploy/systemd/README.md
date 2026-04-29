# systemd deployment

Pin the SanMar nightly sync chain to a daily 02:00 run via a systemd timer.

## What it runs

`sanmar-nightly.service` is a `Type=oneshot` unit that chains three CLI
subcommands as separate `ExecStart=` lines:

1. `python -m sanmar sync-catalog --delta` — incremental catalog refresh
2. `python -m sanmar sync-inventory` — refresh stock for active SKUs
3. `python -m sanmar reconcile-orders` — chase status on every open PO

Each step writes a `SyncState` row, so failures show up in the Streamlit
ops dashboard and (if `SANMAR_ALERT_WEBHOOK_URL` is set) trip a Slack
alert via `SyncNotifier`.

## Prerequisites

- A system user `sanmar` owning `/opt/sanmar`
- `/opt/sanmar/.venv` with the package installed (`pip install -e .`)
- `/opt/sanmar/.env` populated from `.env.example`

## Install

```bash
cd deploy/systemd
sudo ./install.sh
```

The script copies the unit files to `/etc/systemd/system/`, reloads the
daemon, enables + starts the timer, and prints status.

## Verify

```bash
systemctl list-timers sanmar-nightly.timer
journalctl -u sanmar-nightly.service -n 200 --no-pager
```

## Manual trigger (for smoke tests)

```bash
sudo systemctl start sanmar-nightly.service
```

## Uninstall

```bash
sudo systemctl disable --now sanmar-nightly.timer
sudo rm /etc/systemd/system/sanmar-nightly.{service,timer}
sudo systemctl daemon-reload
```

## Why systemd over cron?

- `Persistent=true` re-runs missed jobs after a reboot
- `RandomizedDelaySec=300` jitters the start time so we don't hammer
  SanMar exactly at 02:00:00 along with everyone else
- `journalctl -u` gives structured per-run logs by default
- The oneshot chain stops at the first failed step instead of pressing on
