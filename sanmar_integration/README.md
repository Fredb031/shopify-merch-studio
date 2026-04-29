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

**Phase 2 (SOAP services — Inventory, Pricing, Product Data, Media Content,
Order Status) lands in a separate commit.**

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
