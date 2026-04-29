"""Tests for the Phase 6 SyncState + OrderRow ORM models."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from sanmar.db import init_schema, make_engine, make_session_factory
from sanmar.models import (
    SYNC_STATE_ERROR_CAP,
    OrderRow,
    SyncState,
)


@pytest.fixture
def session(tmp_path: Path) -> Session:
    """Build a fresh in-memory-style SQLite session for one test."""
    engine = make_engine(tmp_path / "test.db")
    init_schema(engine)
    factory = make_session_factory(engine)
    return factory()


def test_sync_state_counters_default_to_zero(session: Session) -> None:
    """A fresh SyncState row must have zero success/error counts and
    a populated `started_at`. Phase 6 contract."""
    row = SyncState(sync_type="catalog_delta")
    session.add(row)
    session.flush()
    session.refresh(row)

    assert row.success_count == 0
    assert row.error_count == 0
    assert row.total_processed == 0
    assert row.started_at is not None
    assert row.finished_at is None


def test_sync_state_append_error_caps_at_100(session: Session) -> None:
    """append_error must respect SYNC_STATE_ERROR_CAP — anything
    beyond the cap is silently dropped, not appended."""
    row = SyncState(sync_type="inventory")
    session.add(row)
    session.flush()

    for i in range(SYNC_STATE_ERROR_CAP + 25):
        row.append_error(step="getInventoryLevels", error_str=f"err {i}")

    assert len(row.errors) == SYNC_STATE_ERROR_CAP


def test_sync_state_metadata_json_roundtrips(session: Session) -> None:
    """JSON columns must accept and return the same shape — proof
    that we wired the SQLAlchemy JSON type correctly."""
    payload = {
        "duration_ms": 1234,
        "since": "2026-04-28T00:00:00+00:00",
        "warehouses": [1, 2, 4],
    }
    row = SyncState(sync_type="catalog_full", metadata_json=payload)
    session.add(row)
    session.commit()

    fetched = session.query(SyncState).filter_by(id=row.id).one()
    assert fetched.metadata_json == payload
    # And the list inside the dict must come back as a list, not a
    # tuple/string — JSON dialect sanity.
    assert isinstance(fetched.metadata_json["warehouses"], list)


def test_order_row_is_open_status_60(session: Session) -> None:
    """status_id 60 (In Production) is open in Python and SQL."""
    row = OrderRow(
        po_number="PO-OPEN-1",
        status_id=60,
        submitted_at=datetime(2026, 4, 28, tzinfo=timezone.utc),
    )
    session.add(row)
    session.commit()

    # Python-side hybrid_property.
    assert row.is_open is True

    # SQL-expression side via filter().
    open_count = session.query(OrderRow).filter(OrderRow.is_open).count()
    assert open_count == 1


def test_order_row_is_closed_for_status_80_and_99(
    session: Session,
) -> None:
    """status_id 80 (Complete / Shipped) and 99 (Cancelled) must be
    treated as closed — both sides of the hybrid."""
    shipped = OrderRow(po_number="PO-SHIPPED", status_id=80)
    cancelled = OrderRow(po_number="PO-CANX", status_id=99)
    open_row = OrderRow(po_number="PO-WIP", status_id=10)
    session.add_all([shipped, cancelled, open_row])
    session.commit()

    assert shipped.is_open is False
    assert cancelled.is_open is False
    assert open_row.is_open is True

    # SQL filter mirrors Python — only the open row should match.
    open_pos = (
        session.query(OrderRow.po_number)
        .filter(OrderRow.is_open)
        .all()
    )
    assert {row[0] for row in open_pos} == {"PO-WIP"}


def test_order_row_tracking_numbers_json_roundtrips(
    session: Session,
) -> None:
    """The tracking_numbers JSON list column must roundtrip — write
    a list, fetch a list with the same contents."""
    tracking = ["1Z999AA10123456784", "1Z999AA10123456785"]
    row = OrderRow(po_number="PO-TRACK-1", tracking_numbers=tracking)
    session.add(row)
    session.commit()

    fetched = (
        session.query(OrderRow).filter_by(po_number="PO-TRACK-1").one()
    )
    assert fetched.tracking_numbers == tracking
    assert isinstance(fetched.tracking_numbers, list)
