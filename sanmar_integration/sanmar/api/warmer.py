"""Cache warmer — pre-populates the FastAPI LRU cache after a fresh sync.

After the nightly sync chain (sanmar-nightly.timer) finishes around
02:00 ET, the in-process response cache used by the read-only API is
cold. The first user request for any given style pays the full SOAP
+ DB roundtrip latency (200-500ms) before subsequent requests within
the 30s TTL benefit from the cache.

This module walks the local SQLite for the top-N styles and triggers
the same routes the storefront would hit, populating the cache so
the first real-user request lands warm.

Design notes
------------
* We hit route handlers directly via :class:`TestClient` rather than
  spinning up uvicorn — the warmer is invoked from the same systemd
  unit that ships the app, so we get to skip the network roundtrip.
* Errors on individual styles do NOT fail the whole pass: a 404 on
  pricing for one style shouldn't poison warming for the other 49.
  We tally success / error counts and return them so the caller (CLI
  or a future scheduler) can decide whether to alert.
* "Top-N most-requested" requires activity tracking we don't yet
  carry — :class:`sanmar.models.Product` has no access counter — so
  for Phase 13 we order alphabetically by ``style_number``. Phase 14
  candidate: instrument the API to record per-style request counts in
  a small SQLite table and read THAT here.
"""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine

from sanmar.db import session_scope
from sanmar.models import Product

# Routes to warm per style. Order matters only insofar as the LRU is
# evicted in insertion order — these three are the storefront's hot
# path so we want them all populated.
WARMING_ROUTES: tuple[str, ...] = (
    "/products/{style}",
    "/inventory/{style}",
    "/products/{style}/pricing",
)


def _top_styles(engine: Engine, top: int) -> list[str]:
    """Return up to ``top`` style numbers ordered alphabetically.

    Future: replace with a popularity ordering once we land per-style
    request-count tracking.
    """
    with session_scope(engine) as session:
        rows = (
            session.execute(
                select(Product.style_number)
                .where(Product.status == "active")
                .order_by(Product.style_number)
                .limit(top)
            )
            .scalars()
            .all()
        )
        return list(rows)


def warm_cache(
    app: FastAPI,
    engine: Engine,
    *,
    top: int = 20,
    progress_cb: Optional[callable] = None,
) -> dict[str, int]:
    """Pre-populate the response cache for the top-N styles.

    Parameters
    ----------
    app:
        The FastAPI application — the warmer drives it via TestClient
        so cached decorators see a real request flow.
    engine:
        SQLAlchemy engine pointing at the same SQLite the app reads.
    top:
        Number of styles to warm. Defaults to 20.
    progress_cb:
        Optional callable invoked after each style with ``(style,
        success, errors_in_routes)`` — used by the CLI to drive a
        rich progress bar without coupling this module to ``rich``.

    Returns
    -------
    dict
        ``{"styles_attempted": N, "styles_succeeded": N,
        "styles_failed": N, "routes_succeeded": N, "routes_failed": N}``.

    Notes
    -----
    A "successful" style means at least one route returned 2xx; this
    accommodates products with cached info but no pricing yet (a real
    state — pricing sync runs separately from catalog).
    """
    styles = _top_styles(engine, top)
    summary = {
        "styles_attempted": len(styles),
        "styles_succeeded": 0,
        "styles_failed": 0,
        "routes_succeeded": 0,
        "routes_failed": 0,
    }

    # The warmer should never be gated by its own rate limiter — the
    # 60/minute on /products list would trip after the 60th warm. Use
    # slowapi's per-limiter ``enabled`` flag for the duration.
    limiter = getattr(app.state, "limiter", None)
    prior_enabled = getattr(limiter, "enabled", None)
    if limiter is not None:
        limiter.enabled = False
    try:
        with TestClient(app) as client:
            for style in styles:
                routes_ok = 0
                routes_err = 0
                for template in WARMING_ROUTES:
                    path = template.format(style=style)
                    try:
                        resp = client.get(path)
                    except Exception:  # noqa: BLE001
                        routes_err += 1
                        continue
                    if 200 <= resp.status_code < 300:
                        routes_ok += 1
                    else:
                        routes_err += 1

                summary["routes_succeeded"] += routes_ok
                summary["routes_failed"] += routes_err
                if routes_ok > 0:
                    summary["styles_succeeded"] += 1
                else:
                    summary["styles_failed"] += 1

                if progress_cb is not None:
                    progress_cb(style, routes_ok > 0, routes_err)
    finally:
        if limiter is not None and prior_enabled is not None:
            limiter.enabled = prior_enabled

    return summary
