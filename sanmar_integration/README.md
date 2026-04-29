# sanmar-integration

Python wrapper around **SanMar Canada PromoStandards SOAP services** plus a local
SQLite cache of the master catalog. Side-track to the existing TypeScript SanMar
layer in `supabase/functions/_shared/sanmar/` — both stacks coexist while we
prototype here.

## Status

**Phase 1 only.** This commit ships:

- Project scaffolding (pyproject, env template, gitignore)
- SQLAlchemy ORM models for `Brand`, `Product`, `Variant`, `InventorySnapshot`
- A pandas-driven loader that reads the SanMar master catalog XLSX and
  upserts it into local SQLite
- A `rich`-powered CLI (`scripts/load_catalog.py`)
- Pytest suite using a synthetic DataFrame fixture (no real XLSX needed)

**Phase 2 lands SOAP base + Product Data v2.0.0**.
**Phase 3 lands Inventory v2.0.0 + Pricing & Configuration v1.0.0** (this commit).
Phases 4+ (Media Content, Order Status / Purchase Order) follow.

## Install

```bash
cd sanmar_integration
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Environment

```bash
cp .env.example .env
# edit .env with real customer_id / password / media_password
```

Drop the SanMar master catalog at `data/master_catalog.xlsx` (16,630 rows
expected). The loader will refuse to run without it and tell you where to put it.

## Run the catalog loader

```bash
python -m scripts.load_catalog
# or, after editable install:
sanmar-load-catalog
```

## Tests

```bash
pytest -q tests/
```

Tests use synthetic in-memory data and do **not** require the XLSX or any
network access.

## Phase 2 — Product Data

Phase 2 ships a thin zeep-based SOAP client plus a typed wrapper for the
**Product Data Service v2.0.0**.

- `sanmar/services/base.py` — abstract `SanmarServiceBase` with a 30s
  timeout, tenacity-driven retry on `ConnectionError`/`Timeout` (3
  attempts, 1s/2s/4s backoff), password-masked logging via loguru, and
  `zeep.Fault → SanmarApiError` mapping so callers branch on `code`.
- `sanmar/services/product_data.py` — `ProductDataService` with
  `get_product`, `get_product_sellable` (parses
  `PC54(Black,LT,Adult)` partIds via regex), and `get_all_active_parts`.
- `sanmar/dto.py` — Pydantic v2 response DTOs decoupled from the
  SQLAlchemy ORM in `sanmar/models.py`.

### Live smoke test

Set real credentials in `.env`, then:

```bash
python -m scripts.test_product_data
```

You'll see green ✓ / red ✗ for each of `get_product('NF0A529K')`,
`get_product_sellable('PC54')`, and `get_all_active_parts()`. The
script exits 0 with a yellow "Credentials not set, skipping live test"
when `.env` still holds the placeholder values from `.env.example`, so
it's safe to run in CI.

### Unit tests

```bash
pytest -q tests/test_product_data.py
```

The unit tests fully mock the zeep client — they pass even when zeep
isn't installed locally.

## Phase 3 — Inventory + Pricing

Phase 3 ships two more typed wrappers, both sharing the same
`SanmarServiceBase` plumbing.

### Inventory v2.0.0

`sanmar/services/inventory.py` — `InventoryService.get_inventory_levels(
style_number, color=None, size=None)` returns an `InventoryResponse`
DTO with:

- `locations: list[WarehouseLevel]` — one entry per SanMar Canada
  warehouse (`1`=Vancouver, `2`=Mississauga, `4`=Calgary). Names are
  computed from the well-known ID map so callers don't carry it.
- `total: int` — `computed_field` summing `locations[*].quantity`.
- Future-stock rows are surfaced under `WarehouseLevel.future_quantities`.

The parser drills through the `<inventoryLocationQuantity><Quantity>
<value>N</value></Quantity></inventoryLocationQuantity>` envelope
explicitly — the TS layer at `supabase/functions/_shared/sanmar/
inventory.ts` had a bug here where it read the outer container's
`.value` and got `undefined`. The Python tests guard against that
regression.

### Pricing & Configuration v1.0.0

`sanmar/services/pricing.py` — `PricingService.get_pricing(
style_number, color=None, size=None)` returns a `PricingResponse`
with `breaks: list[PriceBreak]` ordered ascending by `min_quantity`.
Standing parameter set per SanMar Canada:

- `currency = CAD`
- `fobId = CUSTOMER`
- `priceType = BLANK`
- `localizationCountry = CA` / `localizationLanguage = EN`

Prices are `Decimal` end-to-end — never `float`. Round-tripping
currency through `float` corrupts cents (the canonical
`0.1 + 0.2 != 0.3` problem). `PriceBreak.max_quantity` is `None` for
the open-ended top tier (e.g. "72+").

### Live smoke test

```bash
python -m scripts.test_inventory_pricing
```

Prints two `rich`-rendered tables: an inventory snapshot for style
`117023` and a price ladder for style `411092` size `31516-1`. Same
placeholder-credentials safety as the Phase 2 script.

### Unit tests

```bash
pytest -q tests/test_inventory.py tests/test_pricing.py
```

12 tests covering single + multi-warehouse parsing, the
`Quantity.value` drill, future-stock parsing, the `total`
computed_field, multi-tier price ladders, `Decimal` precision, and
`Fault → SanmarApiError` mapping.

## Phase 4 — Media Content + Purchase Order

Phase 4 ships two more service wrappers and extracts the typed error
hierarchy into its own module.

### Media Content v1.1.0

`sanmar/services/media.py` — `MediaContentService.get_product_images(
style_number, color=None)` returns a `MediaResponse` whose `items`
list carries one `MediaItem` per `MediaContent` node SanMar returned.

Three SanMar quirks the parser handles:

- **Separate password.** Media authenticates with
  `SANMAR_MEDIA_PASSWORD`, *not* the regular EDI login. The wrapper
  overrides `auth_dict()` so callers don't have to remember.
- **Multi-URL `<url>`.** SanMar collapses every CDN URL for a given
  node into one `<url>` separated by newlines. We split on `\n` and
  surface the full list as `MediaItem.all_urls`.
- **Bilingual descriptions.** SanMar Canada writes descriptions like
  `"FR: Logo brodé / EN: Embroidered logo"`. The bilingual regex
  extracts both halves; if it doesn't match (English-only assets)
  both `description_fr` and `description_en` fall back to the raw.

### Purchase Order v1.0.0

`sanmar/services/purchase_order.py` — `PurchaseOrderService` exposes
`submit_order(order)` and `get_order_status(po_number=..., query_type=1)`.

Pre-flight validation runs before any SOAP call. All raise
`SanmarApiError` subclasses so callers can branch on `code`:

- **Forbidden chars** (`< > & " '`) in any address line, name,
  company, etc. → `ForbiddenCharError(field, char)` with code `210`,
  matching SanMar's "Invalid Character" rejection code.
- **Postal codes** validated by country: Canadian `A1A 1A1` (with or
  without space) or US `12345` / `12345-6789`. Mismatch raises
  `InvalidPostalCodeError` (code `220`).
- **Carrier allowlist**: `UPS`, `PUR` (Purolator), `FDX` (FedEx),
  `CPC` (Canada Post). Lower-case input is normalized to upper.
  Anything else raises `InvalidCarrierError` (code `230`).

Response parsing handles SanMar's wrapper-name asymmetry: the
request element is named `SubmitPOOrderRequest` but the response
comes back wrapped in `<SendPOResponse>`. We read `SendPOResponse`
first and fall back to `SubmitPOOrderResponse` so future
PromoStandards alignment doesn't silently break us. `queryType=3` is
explicitly rejected on `get_order_status` — SanMar Canada does not
support it.

### exceptions.py

`sanmar/exceptions.py` extracts the error hierarchy from `base.py`:

- `SanmarApiError` (base, re-exported by `services.base` for
  backward compat)
- `ForbiddenCharError` (code 210)
- `InvalidPostalCodeError` (code 220)
- `InvalidCarrierError` (code 230)

### Live smoke test

```bash
python -m scripts.test_media_orders
```

Read-only by design — calls `get_product_images` and `get_order_status`
but **does not** submit a real order. Instead it builds a fake
`PurchaseOrderInput` and prints the SOAP envelope that *would* be sent
via `preview_envelope()`. Submitting a bogus order to UAT pollutes
SanMar's transaction log and triggers follow-up calls from EDI.

### Unit tests

```bash
pytest -q tests/test_media.py tests/test_purchase_order.py
```

Phase 4 adds 28 tests: bilingual regex (both pattern and raw fallback),
multi-URL splitting, the media-password override, every forbidden-char
field, both postal-code formats, carrier normalization, the
`SendPOResponse` wrapper, the `SubmitPOOrderResponse` fallback,
`queryType=3` rejection, and `Fault → SanmarApiError` mapping.

## Phase 5 — Shipment + Invoice + Bulk Data + Orchestrator

Phase 5 closes out the SanMar SOAP surface area and ships a
high-level facade so cron jobs and the eventual Streamlit ops
dashboard don't have to wire eight services together themselves.

### Order Shipment Notification v2.0.0

`sanmar/services/shipment.py` —
`ShipmentService.get_shipment_notifications(po_number=..., customer_po=...,
since=...)` returns a `list[ShipmentNotification]`. Two query modes:

- `queryType=1` — by PO / customer PO (single-shipment lookup).
- `queryType=2` — by date range (catch-up after an outage).

`get_tracking_info(po_number)` is a convenience wrapper that filters
the same response down to tracking-only fields (`po_number`, `carrier`,
`tracking_number`, `ship_date`) — useful for shipping-confirmation
emails where you don't want to leak line-item details. Empty responses
yield an empty list, never a crash.

### Invoice Service v1.0.0

`sanmar/services/invoice.py` — `InvoiceService.get_invoice(
invoice_number)` and `.get_open_invoices(since=...)`. Status is
auto-derived (not trusting SanMar's `status` string, which is
occasionally absent or stale):

- `balance_due == 0`                              → `paid`
- `balance_due > 0` and `due_date < today`        → `overdue`
- `balance_due > 0` and `balance_due < total`     → `partial`
- otherwise                                        → `open`

Every monetary field is `Decimal` end-to-end. Tests assert
`line_total == unit_price * quantity` for receipt-style invoices to
catch any future float regression.

### Bulk Data Service v1.0

`sanmar/services/bulk_data.py` — for nightly catalog deltas. Walking
`getProduct()` per active style across the SanMar Canada catalog
(~16,630 styles) is wasteful when only a handful change per day; Bulk
Data ships a delta endpoint that returns just the products / inventory
snapshots that moved since the caller's checkpoint.

- `get_product_data_delta(since)` →  `BulkDataResponse` (window +
  `list[ProductResponse]`).
- `get_inventory_delta(since)` → `BulkInventoryResponse` (window +
  `list[InventoryResponse]`).

Persist `window_end` as the next checkpoint so subsequent runs only
ask SanMar for what changed since.

### SanmarOrchestrator

`sanmar/orchestrator.py` composes all eight SanMar services into one
object plus four operator-facing workflows:

- **`sync_catalog_full(session=None)`** — full walk via
  `getAllActiveParts` + per-style `getProduct`. Slow (one HTTP per
  style); use for cold starts or weekly reconciliation.
- **`sync_catalog_delta(since, session=None)`** — fast incremental
  refresh via `BulkDataService`. Returns the server-reported window
  so the cron can persist the next checkpoint.
- **`sync_inventory_for_active_skus(session)`** — pulls every distinct
  style from the local `variants` table, fetches inventory once per
  style (SanMar returns every warehouse / SKU permutation in one
  call), and writes `InventorySnapshot` rows.
- **`reconcile_open_orders(session, open_orders=[...])`** — for every
  caller-supplied `{po_number, status_id}` row, calls
  `getOrderStatus`; counts transitions and mutates the caller's dict
  in-place so they can write back without re-querying.

All four return small dataclasses with metrics (`success_count`,
`error_count`, `duration_ms`, `errors: list[dict]`) — structured
output for alerting and dashboards.

### Nightly sync — recommended wiring

```python
from datetime import datetime, timezone

from sanmar.config import get_settings
from sanmar.db import make_engine, session_scope
from sanmar.orchestrator import SanmarOrchestrator

settings = get_settings()
orch = SanmarOrchestrator(settings)
engine = make_engine(settings.db_path)

# Read last checkpoint; fall back to 24h ago.
since = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0)

with session_scope(engine) as session:
    catalog = orch.sync_catalog_delta(since, session=session)
    inventory = orch.sync_inventory_for_active_skus(session)
    open_orders = [...]  # SELECT po_number, status_id FROM orders WHERE status_id < 80
    recon = orch.reconcile_open_orders(session, open_orders=open_orders)

# Persist `catalog.window_end` as the next checkpoint, ship metrics.
```

### Live smoke test

```bash
python -m scripts.test_shipment_invoice_bulk
```

Read-only — pulls last 30 days of shipment notifications, last 30
days of open invoices, and yesterday's product delta (small window so
the response stays manageable). Same placeholder-credentials safety
as the earlier scripts.

### Unit tests

```bash
pytest -q tests/test_shipment.py tests/test_invoice.py \
        tests/test_bulk_data.py tests/test_orchestrator.py
```

Phase 5 adds 18 tests covering shipment parsing (single / multi /
empty / Fault), invoice status derivation (paid / open / overdue /
list), `Decimal` arithmetic preservation, bulk product + inventory
delta parsing, the eight-service composition contract, the
`sync_catalog_delta → persist_catalog` path, and order status
transition detection (60 → 80).

## Phase 6 — Operator surfaces

Phase 6 ships the CLI, sync checkpointing, and a Streamlit ops
dashboard so the integration is usable without writing Python.

### Install

```bash
pip install -e ".[dev]"
python -m sanmar --help
```

### CLI subcommands

```bash
# Catalog
python -m sanmar sync-catalog --delta --since 2026-04-28
python -m sanmar sync-catalog --full

# Inventory
python -m sanmar sync-inventory --limit 25         # smoke run
python -m sanmar sync-inventory                    # full run

# Orders
python -m sanmar reconcile-orders                  # uses OrderRow.is_open

# Lookups (single style / PO / invoice)
python -m sanmar product NF0A529K
python -m sanmar product NF0A529K --color Black --size L
python -m sanmar inventory NF0A529K
python -m sanmar pricing NF0A529K
python -m sanmar track PO-2026-100
python -m sanmar invoice INV-12345
python -m sanmar open-invoices --days 30

# Smoke / health (CI-safe — exits 0 with placeholder creds)
python -m sanmar health
```

### Streamlit dashboard

```bash
pip install -e ".[ops]"
streamlit run streamlit/ops.py
```

Three sections: last 10 sync runs (from `sync_state`), live counters
(open orders + AR balance, sourced from local SQLite), and three
manual trigger buttons (catalog delta / inventory / reconcile).

### Recommended cron entry

```
# Nightly delta + inventory + order reconcile at 02:00 server time.
0 2 * * * cd /opt/sanmar && python -m sanmar sync-catalog --delta && python -m sanmar sync-inventory && python -m sanmar reconcile-orders
```

### What Phase 6 added

- `sanmar/cli.py` — Typer CLI with 10 subcommands (rich tables / progress)
- `sanmar/__main__.py` — makes `python -m sanmar` work
- `sanmar/models.py` — `SyncState` and `OrderRow` ORM models
- `sanmar/orchestrator.py` — `reconcile_open_orders` now self-sources
  from `OrderRow.is_open`, all four sync methods write `SyncState`
  rows at start + finish in a `try/finally`
- `streamlit/ops.py` — minimal operator dashboard (optional dep)
- 11 new tests (71 → 82): `test_cli.py` (5 tests) +
  `test_models_sync_state.py` (6 tests)

## Phase 7 — operations spine

Operating model: a systemd timer fires the orchestrator nightly; each
sync writes a `SyncState` row; failures and terminal order transitions
get pushed to a Slack/Zapier webhook.

```
systemd timer (02:00 + 5min jitter)
    └─► oneshot service unit
            ├─► python -m sanmar sync-catalog --delta
            ├─► python -m sanmar sync-inventory
            └─► python -m sanmar reconcile-orders
                    └─► SyncState rows + SyncNotifier alerts
```

### systemd install

```bash
cd deploy/systemd
sudo ./install.sh
# verify
systemctl list-timers sanmar-nightly.timer
journalctl -u sanmar-nightly.service -n 200 --no-pager
```

See `deploy/systemd/README.md` for prerequisites and uninstall steps.

### GitHub Actions

`.github/workflows/sanmar-python-ci.yml` runs on every PR touching
`sanmar_integration/**`:

1. `lint-and-test` — `pip install -e ".[dev]"` + `pytest -q tests/` +
   a CLI sanity check (`from sanmar.cli import app; ...`).
2. `health-check` — runs `python -m sanmar health` against UAT *if*
   the secrets are set, otherwise logs a skip and exits clean.

Repo secrets to configure (Settings → Secrets and variables → Actions):

- `SANMAR_CUSTOMER_ID_UAT`
- `SANMAR_PASSWORD_UAT`
- `SANMAR_MEDIA_PASSWORD_UAT`

### Slack/Zapier alerting

Create an incoming webhook (Slack: *Apps → Incoming Webhooks*; Zapier:
*Webhooks by Zapier → Catch Hook*) and set the URL in `.env`:

```bash
SANMAR_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/AAA/BBB/CCC
```

`SyncNotifier` posts:

- **Failure alerts** — when a sync row closes with `error_count > 0`.
  Deduped per `sync_type` for 30 minutes via
  `metadata_json['last_alert_at']` so an outage doesn't flood the channel.
- **Transition alerts** — when an order flips into status 80
  (Complete / Shipped) or 99 (Cancelled), with PO number, customer
  reference, quote id, and any tracking numbers.

Both call paths use a 3-second timeout and swallow every exception —
alerting is best-effort observability, never load-bearing for the
sync. The webhook URL is never logged.

### What Phase 7 added

- `deploy/systemd/{sanmar-nightly.service,sanmar-nightly.timer,install.sh,README.md}`
  — nightly sync chain at 02:00 + 5min jitter, journald logs
- `.github/workflows/sanmar-python-ci.yml` — pytest + CLI gate on every
  PR plus an optional UAT health check
- `sanmar/notifier.py` — `SyncNotifier` with failure + transition
  alerts, 30-min dedup, 3s timeout, never logs the URL
- `sanmar/orchestrator.py` — accepts an optional `notifier=`, fires
  `notify_failure` from `_close_sync_state` and `notify_transition`
  from `reconcile_open_orders`
- `sanmar/config.py` — new `alert_webhook_url` field on `Settings`
  (`SANMAR_ALERT_WEBHOOK_URL`)
- 13 new tests (82 → 95): `test_notifier.py` (8 tests) +
  `test_orchestrator_alerts.py` (5 tests)
