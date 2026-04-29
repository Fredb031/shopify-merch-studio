"""Phase 10 — read-only HTTP API serving the local SQLite cache.

The website's product browse pages will eventually replace per-request
SOAP calls with calls to this service. The API is intentionally
stateless beyond an in-process LRU cache so it can scale horizontally
behind a load balancer.
"""
