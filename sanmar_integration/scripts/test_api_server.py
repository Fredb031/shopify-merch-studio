"""Manual smoke CLI: spin up the API on port 8080 (or env-configurable),
hit ``/health`` + ``GET /products?page_size=5``, then tear down.

Useful for ops verification on a fresh deploy. Run with::

    python -m scripts.test_api_server

The script exits non-zero on any HTTP failure so it's safe to wire
into a deploy gate.
"""
from __future__ import annotations

import os
import sys
import threading
import time
from typing import Optional

import httpx
import uvicorn

from sanmar.api.app import app


def _start_server(host: str, port: int) -> tuple[uvicorn.Server, threading.Thread]:
    """Boot the FastAPI app under a uvicorn server in a daemon thread."""
    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(50):
        if server.started:
            return server, thread
        time.sleep(0.1)
    raise RuntimeError("API server failed to start within 5s")


def _smoke(base_url: str) -> int:
    """Hit /health and /products; return 0 when both are 2xx."""
    try:
        r = httpx.get(f"{base_url}/health", timeout=5.0)
        print(f"GET /health -> {r.status_code}: {r.text[:200]}")
        if r.status_code >= 400:
            return 1
        r = httpx.get(f"{base_url}/products?page_size=5", timeout=5.0)
        print(f"GET /products?page_size=5 -> {r.status_code}: {r.text[:200]}")
        if r.status_code >= 400:
            return 1
    except Exception as exc:  # noqa: BLE001
        print(f"smoke failed: {exc}")
        return 1
    return 0


def main(host: Optional[str] = None, port: Optional[int] = None) -> int:
    """Stand the server up, run the smoke, tear down. Returns exit code."""
    host = host or os.getenv("SANMAR_API_HOST", "127.0.0.1")
    port = port or int(os.getenv("SANMAR_API_PORT", "8080"))
    base_url = f"http://{host}:{port}"
    server, thread = _start_server(host, port)
    try:
        return _smoke(base_url)
    finally:
        server.should_exit = True
        thread.join(timeout=5.0)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
