"""Minimal Streamlit operator dashboard for the SanMar integration.

Run it with::

    streamlit run streamlit/ops.py

Streamlit is an *optional* dependency — the rest of the package
doesn't import this module, so callers can safely deploy without
installing it. ``pip install -e ".[ops]"`` adds it.

Sections
--------
1. **Recent syncs** — last 10 SyncState rows in a dataframe.
2. **Operational counters** — open orders + AR balance, both read
   from the SQLite cache (no SOAP call here — refresh-on-click only).
3. **Manual triggers** — buttons for catalog delta sync, inventory
   sync, order reconciliation. Each kicks the orchestrator on click
   with a progress spinner.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

# Streamlit imports are gated so a plain `python streamlit/ops.py`
# from the CLI still produces a clear "install streamlit" error rather
# than a bare ImportError.
try:
    import streamlit as st
except ImportError as exc:  # pragma: no cover - import guard
    raise SystemExit(
        "streamlit is not installed. Run: pip install streamlit "
        "(or pip install -e \".[ops]\" from the project root)."
    ) from exc

import pandas as pd
from sqlalchemy import desc, select

from sanmar.config import get_settings
from sanmar.db import init_schema, make_engine, session_scope
from sanmar.models import OrderRow, SyncState
from sanmar.orchestrator import SanmarOrchestrator


def _fmt_dt(dt) -> str:
    if dt is None:
        return "—"
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M")
    return str(dt)


def main() -> None:  # pragma: no cover - UI entry
    st.set_page_config(
        page_title="SanMar Ops", page_icon="📦", layout="wide"
    )
    st.title("SanMar Ops Dashboard")

    with st.sidebar:
        st.markdown("## Links")
        st.markdown(
            "[GitHub repo](https://github.com/Fredb031/visionaffichage)"
        )
        st.caption("Phase 6 — operator surfaces.")

    settings = get_settings()
    engine = make_engine(settings.db_path)
    init_schema(engine)

    # ── Section 1: recent syncs ───────────────────────────────────
    st.subheader("Recent syncs")
    with session_scope(engine) as session:
        rows = (
            session.execute(
                select(SyncState)
                .order_by(desc(SyncState.started_at))
                .limit(10)
            )
            .scalars()
            .all()
        )
        sync_df = pd.DataFrame(
            [
                {
                    "id": r.id,
                    "type": r.sync_type,
                    "started": _fmt_dt(r.started_at),
                    "finished": _fmt_dt(r.finished_at),
                    "success": r.success_count,
                    "errors": r.error_count,
                    "processed": r.total_processed,
                    "marker": r.last_processed_marker or "",
                }
                for r in rows
            ]
        )
    if sync_df.empty:
        st.info("No sync runs yet — kick one off below.")
    else:
        st.dataframe(sync_df, use_container_width=True, hide_index=True)

    # ── Section 2: operational counters ───────────────────────────
    st.subheader("Operational counters")
    col_a, col_b, col_c = st.columns(3)
    with session_scope(engine) as session:
        open_orders = (
            session.query(OrderRow).filter(OrderRow.is_open).count()
        )
        # AR balance is sourced from local OrderRow totals on
        # *non-shipped* orders — keep this read-only / SOAP-free; a
        # separate "refresh AR" button could trigger an SOAP pull.
        ar_balance_q = (
            session.query(OrderRow)
            .filter(OrderRow.shipped_at.is_(None))
            .all()
        )
        ar_balance = sum(
            float(o.total_amount_cad or 0) for o in ar_balance_q
        )
        last_sync = (
            session.execute(
                select(SyncState)
                .order_by(desc(SyncState.started_at))
                .limit(1)
            )
            .scalar_one_or_none()
        )

    col_a.metric("Open orders", open_orders)
    col_b.metric("AR balance (CAD)", f"${ar_balance:,.2f}")
    col_c.metric(
        "Last sync",
        _fmt_dt(last_sync.started_at) if last_sync else "never",
    )

    if st.button("Refresh counters"):
        st.rerun()

    # ── Section 3: manual triggers ────────────────────────────────
    st.subheader("Manual sync triggers")
    orch = SanmarOrchestrator(settings)

    btn_a, btn_b, btn_c = st.columns(3)

    if btn_a.button("Run catalog delta sync"):
        since = datetime.now(tz=timezone.utc) - timedelta(days=1)
        with st.spinner("Pulling delta…"):
            with session_scope(engine) as session:
                result = orch.sync_catalog_delta(since, session=session)
        st.success(
            f"Catalog delta done — success {result.success_count}, "
            f"errors {result.error_count}, products {result.products_seen}"
        )

    if btn_b.button("Run inventory sync"):
        with st.spinner("Refreshing inventory…"):
            with session_scope(engine) as session:
                result = orch.sync_inventory_for_active_skus(session)
        st.success(
            f"Inventory done — snapshots {result.snapshots_written}, "
            f"errors {result.error_count}"
        )

    if btn_c.button("Reconcile open orders"):
        with st.spinner("Reconciling…"):
            with session_scope(engine) as session:
                result = orch.reconcile_open_orders(session)
        st.success(
            f"Reconcile done — transitions {result.transitions}, "
            f"errors {result.error_count}"
        )


if __name__ == "__main__":  # pragma: no cover
    main()
