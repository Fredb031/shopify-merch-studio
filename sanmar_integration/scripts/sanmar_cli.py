"""Legacy entry point for the Phase 6 CLI.

Earlier phases shipped one-shot test scripts under ``scripts/``; this
file keeps that pattern alive for operators with muscle memory or cron
entries pointing at ``scripts/``. Internally it just hands control to
:func:`sanmar.cli.app` — the canonical entry is now ``python -m sanmar``.
"""
from __future__ import annotations

from sanmar.cli import app


def main() -> None:
    """Run the Typer app — kept as a function so setuptools ``project.scripts``
    can wire it as a console_scripts entry."""
    app()


if __name__ == "__main__":
    main()
