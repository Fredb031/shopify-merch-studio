"""Integration tests: orchestrator wires notifier into sync + reconcile."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from sanmar.config import Settings
from sanmar.db import Base
from sanmar.dto import (
    BulkDataResponse,
    OrderStatusResponse,
    ProductResponse,
)
from sanmar.models import OrderRow
from sanmar.notifier import SyncNotifier
from sanmar.orchestrator import SanmarOrchestrator
from sanmar.services.bulk_data import BulkDataService
from sanmar.services.purchase_order import PurchaseOrderService
from sanmar.services.shipment import ShipmentService


@pytest.fixture
def settings() -> Settings:
    return Settings(
        customer_id="cust-123",
        password="secret-pw",
        media_password="media-pw",
        env="uat",
    )


@pytest.fixture
def db_session() -> Session:
    """Real in-memory SQLite session so SyncState writes don't get
    silently swallowed by the MagicMock-tolerance in _open_sync_state."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture
def mock_notifier() -> MagicMock:
    return MagicMock(spec=SyncNotifier)


# ── 1. Failure path fires notify_failure ─────────────────────────────


def test_notifier_called_on_sync_failure(
    settings: Settings,
    db_session: Session,
    mock_notifier: MagicMock,
) -> None:
    """When a sync ends with error_count > 0, notify_failure runs."""
    orch = SanmarOrchestrator(settings, notifier=mock_notifier)

    # Force the bulk data call to raise so error_count goes to 1.
    orch.bulk_data = MagicMock(spec=BulkDataService)
    from sanmar.exceptions import SanmarApiError

    orch.bulk_data.get_product_data_delta.side_effect = SanmarApiError(
        code="500", message="upstream broken"
    )

    since = datetime(2026, 4, 28, tzinfo=timezone.utc)
    result = orch.sync_catalog_delta(since, session=db_session)

    assert result.error_count == 1
    mock_notifier.notify_failure.assert_called_once()
    # The row passed in is the closed SyncState — sanity check shape.
    closed_row = mock_notifier.notify_failure.call_args.args[0]
    assert closed_row.sync_type == "catalog_delta"
    assert closed_row.error_count == 1


# ── 2. Clean run does NOT alert ──────────────────────────────────────


def test_notifier_not_called_on_clean_sync(
    settings: Settings,
    db_session: Session,
    mock_notifier: MagicMock,
) -> None:
    """error_count == 0 → no alert."""
    orch = SanmarOrchestrator(settings, notifier=mock_notifier)

    end = datetime(2026, 4, 29, tzinfo=timezone.utc)
    since = datetime(2026, 4, 28, tzinfo=timezone.utc)
    fake_delta = BulkDataResponse(
        window_start=since,
        window_end=end,
        total_changes=1,
        products=[
            ProductResponse(
                style_number="PC54",
                brand_name="Port & Company",
                product_name="Core Tee",
                description="cotton",
                category="Tees",
                status="active",
                list_of_colors=["Black"],
                list_of_sizes=["L"],
            )
        ],
    )
    orch.bulk_data = MagicMock(spec=BulkDataService)
    orch.bulk_data.get_product_data_delta.return_value = fake_delta

    # Stub persist_catalog so we don't need brand seed data.
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "sanmar.catalog.store.persist_catalog",
            lambda df, session: {"rows_processed": len(df)},
        )
        result = orch.sync_catalog_delta(since, session=db_session)

    assert result.error_count == 0
    mock_notifier.notify_failure.assert_not_called()


# ── 3. Reconcile fires notify_transition for 60→80 ───────────────────


def test_reconcile_fires_transition_alert_on_shipped(
    settings: Settings,
    db_session: Session,
    mock_notifier: MagicMock,
) -> None:
    """OrderRow flips 60 → 80; notify_transition called once with right args."""
    orch = SanmarOrchestrator(settings, notifier=mock_notifier)

    # Seed an open order at status 60.
    row = OrderRow(
        po_number="PO-2026-100",
        customer_po="CUST-77",
        status_id=60,
        status_description="In Production",
    )
    db_session.add(row)
    db_session.commit()

    # SanMar reports it shipped.
    orch.purchase_order = MagicMock(spec=PurchaseOrderService)
    orch.purchase_order.get_order_status.return_value = OrderStatusResponse(
        order_number="PO-2026-100",
        status_id=80,
        status_description="Complete / Shipped",
    )
    # Tracking call returns empty (no need to test that branch here).
    orch.shipment = MagicMock(spec=ShipmentService)
    orch.shipment.get_tracking_info.return_value = []

    result = orch.reconcile_open_orders(db_session)

    assert result.transitions == 1
    mock_notifier.notify_transition.assert_called_once()
    args = mock_notifier.notify_transition.call_args.args
    # (order_row, from_status, to_status)
    assert args[0].po_number == "PO-2026-100"
    assert args[1] == 60
    assert args[2] == 80


def test_orchestrator_default_notifier_disabled_when_url_unset(
    settings: Settings,
) -> None:
    """No webhook URL → orchestrator builds a disabled SyncNotifier."""
    orch = SanmarOrchestrator(settings)
    assert isinstance(orch.notifier, SyncNotifier)
    assert orch.notifier.enabled is False


def test_orchestrator_default_notifier_enabled_when_url_set() -> None:
    """Settings with alert_webhook_url → notifier reports enabled."""
    s = Settings(
        customer_id="x",
        password="x",
        media_password="x",
        env="uat",
        alert_webhook_url="https://example.com/wh",
    )
    orch = SanmarOrchestrator(s)
    assert orch.notifier.enabled is True
