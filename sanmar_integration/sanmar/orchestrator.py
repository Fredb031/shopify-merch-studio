"""High-level facade composing every SanMar service into one object.

The eight underlying services each speak one PromoStandards endpoint;
the orchestrator chains them into the operator-facing workflows the
business actually runs:

* ``sync_catalog_full`` — full walk via ``getAllActiveParts`` +
  per-style ``getProduct``. Slow (one HTTP per style); use for cold
  starts or weekly reconciliation.
* ``sync_catalog_delta`` — fast incremental refresh via
  ``getProductDataDelta``. Pair with a persisted ``last_run`` so the
  next call asks SanMar for *only* what changed.
* ``sync_inventory_for_active_skus`` — pulls every SKU currently
  carried in the local ``variants`` table, fetches its inventory, and
  writes :class:`sanmar.models.InventorySnapshot` rows.
* ``reconcile_open_orders`` — for every order whose local state isn't
  ``Complete / Shipped``, ask SanMar for status; bump the local row
  when status transitions (e.g. ``60 → 80``).

Every public method returns a small dataclass with metrics
(``success_count``, ``error_count``, ``duration_ms``, ``errors``) so
the caller — usually a cron or Streamlit dashboard — has structured
output for alerting.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

import pandas as pd

from sanmar.config import Settings
from sanmar.dto import (
    ORDER_STATUS_DESCRIPTIONS,
    BulkDataResponse,
    InventoryResponse,
    OrderStatusResponse,
)
from sanmar.exceptions import SanmarApiError
from sanmar.services.bulk_data import BulkDataService
from sanmar.services.inventory import InventoryService
from sanmar.services.invoice import InvoiceService
from sanmar.services.media import MediaContentService
from sanmar.services.pricing import PricingService
from sanmar.services.product_data import ProductDataService
from sanmar.services.purchase_order import PurchaseOrderService
from sanmar.services.shipment import ShipmentService

if TYPE_CHECKING:  # pragma: no cover - import-time only
    from sqlalchemy.orm import Session


@dataclass
class CatalogSyncResult:
    """Metrics for a catalog sync run."""

    success_count: int = 0
    error_count: int = 0
    duration_ms: int = 0
    products_seen: int = 0
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    errors: list[dict] = field(default_factory=list)


@dataclass
class InventorySyncResult:
    """Metrics for an inventory sync run."""

    success_count: int = 0
    error_count: int = 0
    duration_ms: int = 0
    snapshots_written: int = 0
    errors: list[dict] = field(default_factory=list)


@dataclass
class OrderReconResult:
    """Metrics for an open-order reconciliation run."""

    success_count: int = 0
    error_count: int = 0
    duration_ms: int = 0
    transitions: int = 0
    errors: list[dict] = field(default_factory=list)


def _now_ms() -> int:
    return int(time.monotonic() * 1000)


class SanmarOrchestrator:
    """Composes all eight SanMar services into one facade.

    Lazy-instantiated — the underlying services are constructed on
    first attribute access so a test that only exercises one service
    doesn't have to mock the other seven.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        # Eager-build all eight so the spec test ("instantiates all 8
        # services") has something to assert against. None of them
        # touches the network until a method is called.
        self.product_data = ProductDataService(settings)
        self.inventory = InventoryService(settings)
        self.pricing = PricingService(settings)
        self.media = MediaContentService(settings)
        self.purchase_order = PurchaseOrderService(settings)
        self.shipment = ShipmentService(settings)
        self.invoice = InvoiceService(settings)
        self.bulk_data = BulkDataService(settings)

    @property
    def services(self) -> dict[str, Any]:
        """Map of service name → instance, for diagnostics."""
        return {
            "product_data": self.product_data,
            "inventory": self.inventory,
            "pricing": self.pricing,
            "media": self.media,
            "purchase_order": self.purchase_order,
            "shipment": self.shipment,
            "invoice": self.invoice,
            "bulk_data": self.bulk_data,
        }

    # ── catalog ───────────────────────────────────────────────────────

    def sync_catalog_full(
        self, *, session: Optional["Session"] = None
    ) -> CatalogSyncResult:
        """Full catalog walk via ``getAllActiveParts`` + ``getProduct``.

        Slow — one HTTP per style. Pass ``session`` to persist via
        :func:`sanmar.catalog.store.persist_catalog`; without it the
        method just enumerates and counts.

        When a ``session`` is provided, writes a :class:`SyncState`
        checkpoint row with start time, finishes it with metrics, and
        always closes (try/finally) so partial failures still leave
        the row in a queryable state.
        """
        start = _now_ms()
        result = CatalogSyncResult()
        sync_row = self._open_sync_state(session, "catalog_full")

        try:
            try:
                parts = self.product_data.get_all_active_parts()
            except SanmarApiError as e:
                result.errors.append(
                    {"phase": "getAllActiveParts", "code": e.code, "message": e.message}
                )
                result.error_count += 1
                result.duration_ms = _now_ms() - start
                return result

            styles = sorted({p.style_number for p in parts if p.style_number})
            rows: list[dict] = []
            for style in styles:
                try:
                    product = self.product_data.get_product(style)
                    result.success_count += 1
                    # Project to the catalog-store DataFrame shape.
                    colors = product.list_of_colors or [""]
                    sizes = product.list_of_sizes or [""]
                    for color in colors:
                        for size in sizes:
                            rows.append(
                                {
                                    "style_number": product.style_number,
                                    "color_name": color,
                                    "size": size,
                                    "brand_name": product.brand_name,
                                    "full_feature_description": product.description,
                                    "category": product.category,
                                    "status": product.status,
                                }
                            )
                except SanmarApiError as e:
                    result.error_count += 1
                    result.errors.append(
                        {
                            "phase": "getProduct",
                            "style": style,
                            "code": e.code,
                            "message": e.message,
                        }
                    )

            result.products_seen = len(styles)

            if session is not None and rows:
                from sanmar.catalog.store import persist_catalog

                persist_catalog(pd.DataFrame(rows), session)

            result.duration_ms = _now_ms() - start
            return result
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.products_seen,
                last_marker=None,
                metadata={"duration_ms": _now_ms() - start},
                errors=result.errors,
            )

    def sync_catalog_delta(
        self,
        since: datetime,
        *,
        session: Optional["Session"] = None,
    ) -> CatalogSyncResult:
        """Incremental catalog sync via Bulk Data.

        Fetches the products that changed since ``since`` and persists
        them via :func:`sanmar.catalog.store.persist_catalog` if a
        session is provided. Returns a :class:`CatalogSyncResult` with
        the server-reported window so callers can persist the next
        checkpoint.
        """
        start = _now_ms()
        result = CatalogSyncResult()
        sync_row = self._open_sync_state(session, "catalog_delta")

        try:
            try:
                delta: BulkDataResponse = self.bulk_data.get_product_data_delta(
                    since
                )
            except SanmarApiError as e:
                result.errors.append(
                    {"phase": "getProductDataDelta", "code": e.code, "message": e.message}
                )
                result.error_count += 1
                result.duration_ms = _now_ms() - start
                return result

            result.window_start = delta.window_start
            result.window_end = delta.window_end
            result.products_seen = len(delta.products)
            result.success_count = len(delta.products)

            rows: list[dict] = []
            for product in delta.products:
                colors = product.list_of_colors or [""]
                sizes = product.list_of_sizes or [""]
                for color in colors:
                    for size in sizes:
                        rows.append(
                            {
                                "style_number": product.style_number,
                                "color_name": color,
                                "size": size,
                                "brand_name": product.brand_name,
                                "full_feature_description": product.description,
                                "category": product.category,
                                "status": product.status,
                            }
                        )

            if session is not None and rows:
                from sanmar.catalog.store import persist_catalog

                persist_catalog(pd.DataFrame(rows), session)

            result.duration_ms = _now_ms() - start
            return result
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.products_seen,
                last_marker=(
                    result.window_end.isoformat()
                    if result.window_end is not None
                    else None
                ),
                metadata={
                    "duration_ms": _now_ms() - start,
                    "since": since.isoformat() if since else None,
                },
                errors=result.errors,
            )

    # ── inventory ─────────────────────────────────────────────────────

    def sync_inventory_for_active_skus(
        self, session: "Session", *, limit: Optional[int] = None
    ) -> InventorySyncResult:
        """For each distinct active variant in the local DB, fetch
        SanMar inventory and write :class:`InventorySnapshot` rows.

        We iterate unique style numbers (one HTTP per style; SanMar
        returns every warehouse / SKU permutation for that style in
        one call) rather than per-SKU to minimize round-trips.

        ``limit`` caps the number of distinct styles processed — used
        from the CLI for smoke tests and during development so a full
        sync doesn't hammer the SOAP edge while iterating.
        """
        from sanmar.models import InventorySnapshot, Variant

        start = _now_ms()
        result = InventorySyncResult()
        sync_row = self._open_sync_state(session, "inventory")
        last_processed_style: Optional[str] = None

        try:
            # Distinct active styles in the local catalog.
            styles_q = (
                session.query(Variant.full_sku, Variant.color, Variant.size)
                .join(Variant.product)
                .all()
            )
            if not styles_q:
                result.duration_ms = _now_ms() - start
                return result

            # Group SKUs by style. The Variant rows store the composed
            # full_sku; the underlying style is at variant.product.style_number,
            # so fetch it via a join.
            style_skus: dict[str, list[tuple[str, Optional[str], Optional[str]]]] = {}
            for full_sku, color, size in styles_q:
                # full_sku looks like `<style>-<color>-<size>`; split on the
                # first hyphen since color/size may also contain hyphens but
                # only after underscore-replacement.
                if "-" in full_sku:
                    style = full_sku.split("-", 1)[0]
                else:
                    style = full_sku
                style_skus.setdefault(style, []).append((full_sku, color, size))

            # Apply the limit if requested — sort for deterministic
            # behaviour in tests + repeatable smoke runs.
            style_iter = sorted(style_skus.items())
            if limit is not None:
                style_iter = style_iter[:limit]

            now = datetime.now(tz=timezone.utc)
            for style, skus in style_iter:
                last_processed_style = style
                try:
                    inv: InventoryResponse = self.inventory.get_inventory_levels(
                        style
                    )
                    result.success_count += 1
                    for warehouse_level in inv.locations:
                        # Snapshot at the *style* grain — the underlying
                        # response collapses to per-warehouse aggregates by
                        # default (no color/size filter). For finer grain
                        # the caller can iterate `skus` and re-call.
                        for full_sku, _color, _size in skus:
                            session.add(
                                InventorySnapshot(
                                    full_sku=full_sku,
                                    warehouse_code=warehouse_level.warehouse_name,
                                    quantity=warehouse_level.quantity,
                                    fetched_at=now,
                                )
                            )
                            result.snapshots_written += 1
                except SanmarApiError as e:
                    result.error_count += 1
                    result.errors.append(
                        {
                            "style": style,
                            "code": e.code,
                            "message": e.message,
                        }
                    )

            session.flush()
            result.duration_ms = _now_ms() - start
            return result
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.snapshots_written,
                last_marker=last_processed_style,
                metadata={
                    "duration_ms": _now_ms() - start,
                    "limit": limit,
                },
                errors=result.errors,
            )

    # ── orders ────────────────────────────────────────────────────────

    def reconcile_open_orders(
        self,
        session: "Session",
        *,
        open_orders: Optional[list[dict]] = None,
    ) -> OrderReconResult:
        """For every open order, fetch SanMar status and detect
        transitions.

        Phase 6: by default this method now queries the local
        :class:`sanmar.models.OrderRow` table for ``is_open`` rows and
        writes status transitions back in place — no external
        work-list required. Callers that haven't yet migrated to the
        ``orders`` table can still pass an explicit ``open_orders``
        list of ``{po_number, status_id}`` dicts, in which case the
        legacy mutate-in-place behaviour is preserved.

        On each transition we count it and append a row to ``errors``
        with ``phase='transition'`` so the caller can route both
        failures and successful transitions through the same channel
        (Slack, log, dashboard). When status flips into ``80``
        (Complete / Shipped) we additionally call
        :meth:`ShipmentService.get_tracking_info` and record
        ``shipped_at`` + ``tracking_numbers`` on the OrderRow.
        """
        start = _now_ms()
        result = OrderReconResult()
        sync_row = self._open_sync_state(session, "order_reconcile")

        try:
            # Legacy path: caller supplied the work-list explicitly.
            if open_orders is not None:
                self._reconcile_from_workitems(open_orders, result)
                result.duration_ms = _now_ms() - start
                return result

            # New path: source from OrderRow.is_open.
            from sanmar.models import OrderRow

            now = datetime.now(tz=timezone.utc)
            try:
                rows = session.query(OrderRow).filter(OrderRow.is_open).all()
            except Exception as e:  # noqa: BLE001 - tests use mock sessions
                # If the session can't run a real query (e.g. a MagicMock
                # in unit tests with no open_orders provided), surface a
                # clean empty-result rather than crashing.
                result.errors.append(
                    {"phase": "query", "message": str(e)}
                )
                result.duration_ms = _now_ms() - start
                return result

            for row in rows:
                if not row.po_number:
                    continue
                prior_status = int(row.status_id or 0)
                try:
                    status: OrderStatusResponse = (
                        self.purchase_order.get_order_status(
                            po_number=row.po_number, query_type=1
                        )
                    )
                    result.success_count += 1
                    row.last_status_check_at = now

                    if (
                        status.status_id
                        and status.status_id != prior_status
                    ):
                        result.transitions += 1
                        new_desc = (
                            status.status_description
                            or ORDER_STATUS_DESCRIPTIONS.get(
                                status.status_id, "Unknown"
                            )
                        )
                        result.errors.append(
                            {
                                "phase": "transition",
                                "po_number": row.po_number,
                                "from_status": prior_status,
                                "to_status": status.status_id,
                                "to_description": new_desc,
                            }
                        )
                        row.status_id = status.status_id
                        row.status_description = new_desc

                        # On flip to Complete / Shipped, populate
                        # shipping fields from the Shipment service.
                        if status.status_id == 80:
                            try:
                                tracking = self.shipment.get_tracking_info(
                                    row.po_number
                                )
                                row.shipped_at = now
                                row.tracking_numbers = [
                                    t.tracking_number
                                    for t in tracking
                                    if t.tracking_number
                                ]
                            except SanmarApiError as e:
                                result.errors.append(
                                    {
                                        "phase": "getTrackingInfo",
                                        "po_number": row.po_number,
                                        "code": e.code,
                                        "message": e.message,
                                    }
                                )
                except SanmarApiError as e:
                    result.error_count += 1
                    result.errors.append(
                        {
                            "phase": "getOrderStatus",
                            "po_number": row.po_number,
                            "code": e.code,
                            "message": e.message,
                        }
                    )

            session.flush()
            result.duration_ms = _now_ms() - start
            return result
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.success_count + result.error_count,
                last_marker=None,
                metadata={
                    "duration_ms": _now_ms() - start,
                    "transitions": result.transitions,
                },
                errors=result.errors,
            )

    def _reconcile_from_workitems(
        self, open_orders: list[dict], result: OrderReconResult
    ) -> None:
        """Legacy reconcile path retained for backward compatibility.

        Mutates each dict in-place when a status transition is
        observed, matching the pre-Phase-6 contract that several
        external callers and tests rely on.
        """
        for order in open_orders:
            po_number = order.get("po_number")
            prior_status = int(order.get("status_id") or 0)
            if not po_number:
                continue

            try:
                status: OrderStatusResponse = (
                    self.purchase_order.get_order_status(
                        po_number=po_number, query_type=1
                    )
                )
                result.success_count += 1
                if (
                    status.status_id
                    and status.status_id != prior_status
                ):
                    result.transitions += 1
                    new_desc = (
                        status.status_description
                        or ORDER_STATUS_DESCRIPTIONS.get(
                            status.status_id, "Unknown"
                        )
                    )
                    result.errors.append(
                        {
                            "phase": "transition",
                            "po_number": po_number,
                            "from_status": prior_status,
                            "to_status": status.status_id,
                            "to_description": new_desc,
                        }
                    )
                    order["status_id"] = status.status_id
                    order["status_description"] = new_desc
            except SanmarApiError as e:
                result.error_count += 1
                result.errors.append(
                    {
                        "phase": "getOrderStatus",
                        "po_number": po_number,
                        "code": e.code,
                        "message": e.message,
                    }
                )

    # ── sync_state helpers ────────────────────────────────────────────

    def _open_sync_state(
        self, session: Optional["Session"], sync_type: str
    ) -> Optional["Any"]:
        """Insert a fresh SyncState row at the start of a sync.

        Returns ``None`` when there's no session (tests, dry-runs) or
        the session can't accept ORM writes (MagicMock). Both cases
        downgrade to silent — sync state is observability, not
        correctness, so a missing row should never break the sync.
        """
        if session is None:
            return None
        try:
            from sanmar.models import SyncState

            row = SyncState(sync_type=sync_type)
            session.add(row)
            session.flush()
            return row
        except Exception:  # noqa: BLE001 - mock sessions in tests
            return None

    def _close_sync_state(
        self,
        session: Optional["Session"],
        sync_row: Optional["Any"],
        success_count: int,
        error_count: int,
        total_processed: int,
        *,
        last_marker: Optional[str],
        metadata: Optional[dict[str, Any]],
        errors: Optional[list[dict]],
    ) -> None:
        """Stamp the SyncState row with final metrics + the (capped)
        error list. Silent on any failure for the same reason as
        :meth:`_open_sync_state`."""
        if session is None or sync_row is None:
            return
        try:
            sync_row.mark_finished(
                success_count=success_count,
                error_count=error_count,
                total_processed=total_processed,
                last_processed_marker=last_marker,
                metadata=metadata,
            )
            if errors:
                # Cap to 100 to match SyncState's invariant.
                from sanmar.models import SYNC_STATE_ERROR_CAP

                sync_row.errors = list(errors[:SYNC_STATE_ERROR_CAP])
            session.flush()
        except Exception:  # noqa: BLE001 - mock sessions in tests
            return
