"""``python -m sanmar.api`` — launches the FastAPI app under uvicorn."""
from __future__ import annotations

import os

import uvicorn

from sanmar.api.app import app


def main() -> None:
    """Bind on ``SANMAR_API_HOST`` / ``SANMAR_API_PORT`` and serve."""
    host = os.getenv("SANMAR_API_HOST", "0.0.0.0")
    port = int(os.getenv("SANMAR_API_PORT", "8080"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":  # pragma: no cover
    main()
