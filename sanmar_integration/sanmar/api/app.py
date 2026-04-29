"""FastAPI application — read-only HTTP front door for the SQLite cache.

Wires up routers (``products``, ``inventory``, ``pricing``, ``health``),
permissive CORS for the Vision Affichage front-end + Vercel preview
domains, GZip compression, and a lifespan hook that resolves
:func:`sanmar.config.get_settings` once and opens a single SQLAlchemy
engine for the lifetime of the process.

The engine is exposed via the :func:`get_engine` dependency so route
handlers don't import :mod:`sanmar.db` directly — tests can override
the dependency to point at an in-memory SQLite via FastAPI's
``app.dependency_overrides``.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.engine import Engine

from sanmar.config import get_settings
from sanmar.db import init_schema, make_engine

# Static CORS allowlist for Vision Affichage front-end + local dev.
# Vercel preview deployments use ``*.vercel.app`` subdomains so we add
# a regex matcher for those alongside the explicit list.
ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "https://visionaffichage.com",
]
ALLOWED_ORIGIN_REGEX: str = r"https://.*\.vercel\.app"


def _build_engine() -> Engine:
    """Resolve settings + open the SQLite engine.

    Extracted so the lifespan hook + tests can call it identically.
    Schema is ensured (no-op on an already-initialised DB) so the API
    boots cleanly on a fresh box.
    """
    settings = get_settings()
    engine = make_engine(settings.db_path)
    init_schema(engine)
    return engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Open the engine on startup, dispose on shutdown.

    The engine lives on ``app.state.engine`` and is exposed to route
    handlers via the :func:`get_engine` dependency — see the docstring
    on that function for the test-override pattern.
    """
    engine = _build_engine()
    app.state.engine = engine
    try:
        yield
    finally:
        engine.dispose()


def get_engine(request: Request) -> Engine:
    """FastAPI dependency returning the per-app SQLAlchemy engine.

    Tests override this with ``app.dependency_overrides[get_engine] =
    lambda: test_engine`` so route handlers see the in-memory DB.
    """
    return request.app.state.engine


def create_app() -> FastAPI:
    """Build a fresh FastAPI app — exposed for tests + ``__main__``.

    Tests instantiate via ``create_app()`` then override
    :func:`get_engine`. Production goes through the module-level
    :data:`app` singleton.
    """
    application = FastAPI(
        title="SanMar Read-Only API",
        description=(
            "Read-only HTTP API serving product / inventory / pricing "
            "data from the local SanMar SQLite cache. Phase 10 of the "
            "SanMar Python integration."
        ),
        version="0.10.0",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_origin_regex=ALLOWED_ORIGIN_REGEX,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=500)

    # Routes are imported here (not at module top) so the linter can't
    # detect the import order via static analysis and rearrange.
    from sanmar.api.routes import health as health_routes
    from sanmar.api.routes import inventory as inventory_routes
    from sanmar.api.routes import pricing as pricing_routes
    from sanmar.api.routes import products as products_routes

    application.include_router(products_routes.router)
    application.include_router(inventory_routes.router)
    application.include_router(pricing_routes.router)
    application.include_router(health_routes.router)

    return application


# Module-level singleton used by ``python -m sanmar.api`` and uvicorn.
app: FastAPI = create_app()
