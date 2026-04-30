"""Token-bucket rate limiting for the read-only HTTP API (Phase 13).

The /products, /inventory, /pricing routes are publicly reachable
through the Cloudflare Worker fronting Vision Affichage's storefront
and the SanMar back-end is happy to throttle us at the SOAP layer
when callers hammer endpoints. Rather than rely on the upstream to
push back, slowapi gives us a per-IP token-bucket gate at the FastAPI
layer so a misbehaving client can't burn through the LRU cache and
trigger a thundering herd of SOAP roundtrips.

The :class:`Limiter` keys on the remote address (``X-Forwarded-For``
honoured automatically by ``get_remote_address`` when proxied) and is
attached to the app via ``app.state.limiter`` per slowapi's contract;
the per-route ``@limiter.limit(...)`` decorators do the actual gating.

Limits chosen for Vision Affichage's traffic profile:

* ``60/minute`` on /products list — the 30s response cache absorbs
  bursts so this is generous.
* ``30/minute`` on /products/{style}, /inventory/{style},
  /pricing/{style} — detail views, one per product page render.
* ``10/minute`` on /metrics/freshness — debug/observability only.
* /health is intentionally unrate-limited — uptime monitors hammer it
  and we want the 503-on-DB-unreachable signal to remain reliable.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Module-level singleton — slowapi binds this to ``app.state.limiter``
# inside :func:`sanmar.api.app.create_app`. Tests that need to bypass
# the limiter override ``app.state.limiter.enabled = False`` rather
# than swapping the instance, since the per-route decorators capture
# this object at import time.
limiter: Limiter = Limiter(key_func=get_remote_address)
