"""Long-running HTTP server that exposes the SanMar Prometheus metrics.

Runs the :class:`SanmarMetricsCollector` behind a minimal stdlib
``http.server`` so we don't pull in flask/uvicorn just to serve a
``/metrics`` endpoint. The server registers the collector on the
default Prometheus registry and binds where ``EXPORTER_HOST`` /
``EXPORTER_PORT`` say (defaults: ``0.0.0.0:9100``).

Lifecycle
---------
* On startup we log a single rich line so journalctl shows the bind.
* SIGTERM / SIGINT trigger graceful shutdown — :meth:`HTTPServer.shutdown`
  blocks the request handler thread for at most one in-flight scrape
  before returning, so systemd's stop-timeout never fires.
"""
from __future__ import annotations

import os
import signal
import threading
from http.server import HTTPServer
from typing import Optional

from prometheus_client import REGISTRY
from prometheus_client.exposition import MetricsHandler
from rich.console import Console

from sanmar.exporter import SanmarMetricsCollector

DEFAULT_HOST: str = "0.0.0.0"
DEFAULT_PORT: int = 9100

console = Console()


def _resolve_bind(
    host: Optional[str], port: Optional[int]
) -> tuple[str, int]:
    """Resolve the bind address from explicit args > env > defaults.

    Splitting this out makes the CLI test trivial — we can patch the
    env and assert the resolved bind without standing up a socket.
    """
    resolved_host = host or os.environ.get("EXPORTER_HOST") or DEFAULT_HOST
    if port is not None:
        resolved_port = port
    else:
        env_port = os.environ.get("EXPORTER_PORT")
        resolved_port = int(env_port) if env_port else DEFAULT_PORT
    return resolved_host, resolved_port


def build_server(
    host: Optional[str] = None, port: Optional[int] = None
) -> HTTPServer:
    """Construct an HTTPServer with the SanMar collector registered.

    The collector is registered on the *default* Prometheus
    :data:`REGISTRY` because :class:`MetricsHandler` reads from there;
    using a custom registry would mean we'd have to subclass the
    handler too. We unregister-then-register so calling
    :func:`build_server` twice in a test doesn't trip the
    "already registered" guard.
    """
    bind_host, bind_port = _resolve_bind(host, port)

    collector = SanmarMetricsCollector()
    try:
        REGISTRY.register(collector)
    except ValueError:
        # Already registered — unregister and retry once. Happens in
        # the test suite where multiple build_server() calls share
        # one process.
        REGISTRY.unregister(collector)
        REGISTRY.register(collector)

    server = HTTPServer((bind_host, bind_port), MetricsHandler)
    return server


def serve_forever(
    host: Optional[str] = None, port: Optional[int] = None
) -> None:
    """Run the exporter HTTP server until SIGTERM / SIGINT.

    Blocking call — designed to live under ``systemd Type=simple``
    or under ``python -m sanmar metrics`` in a tmux pane.
    """
    server = build_server(host, port)
    bind_host, bind_port = server.server_address[0], server.server_address[1]
    console.log(
        f"[bold green]sanmar-exporter[/bold green] listening on "
        f"http://{bind_host}:{bind_port}/metrics"
    )

    # Run the server in a worker thread so the main thread can wait
    # on a shutdown event triggered by signal handlers — the stdlib
    # HTTPServer.serve_forever has no built-in signal integration.
    shutdown_event = threading.Event()

    def _request_shutdown(signum, _frame):  # noqa: ANN001
        console.log(f"[yellow]signal {signum} received, shutting down…[/yellow]")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, _request_shutdown)
    signal.signal(signal.SIGINT, _request_shutdown)

    serve_thread = threading.Thread(
        target=server.serve_forever, name="sanmar-exporter", daemon=True
    )
    serve_thread.start()

    try:
        shutdown_event.wait()
    finally:
        server.shutdown()
        server.server_close()
        serve_thread.join(timeout=5.0)
        console.log("[bold]sanmar-exporter stopped.[/bold]")


if __name__ == "__main__":  # pragma: no cover
    serve_forever()
