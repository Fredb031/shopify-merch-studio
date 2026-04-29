"""SanMar PromoStandards Pricing & Configuration Service v1.0.0 wrapper.

Reference: ``supabase/functions/_shared/sanmar/pricing.ts`` for the
envelope shape and the standing parameter set SanMar Canada expects
(``CAD`` / ``CUSTOMER`` price type / ``CA`` / ``EN`` / ``Blank``
configuration). This Python wrapper mirrors that contract so both
stacks return the same price ladder when pointed at the same env.

Currency hygiene
----------------
Prices are kept as :class:`decimal.Decimal` end-to-end. Round-tripping
currency through ``float`` corrupts cents (the canonical bug:
``0.1 + 0.2 != 0.3``). Pydantic v2 will coerce SOAP-emitted strings to
Decimal at validation, which is the right thing to do here.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, ClassVar, Optional

from sanmar.dto import PriceBreak, PricingResponse
from sanmar.services.base import SanmarServiceBase


def _to_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


def _to_int_or_none(value: Any) -> Optional[int]:
    """Return an int, or ``None`` if the source is missing/blank.

    Used for ``maxQuantity``, where a missing value means "no upper
    bound on this tier" rather than zero."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return int(float(s))
        except ValueError:
            return None


def _to_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(str(value))
    except (TypeError, ValueError):
        try:
            return int(float(str(value)))
        except (TypeError, ValueError):
            return default


def _to_decimal(value: Any, default: str = "0") -> Decimal:
    """Coerce a SOAP-emitted price (str | int | float | Decimal) to Decimal.

    We never go through ``float`` for currency. If pydantic later
    re-validates this Decimal, it will pass through unchanged."""
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(default)


def _to_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _get(obj: Any, *keys: str) -> Any:
    for k in keys:
        if obj is None:
            return None
        if isinstance(obj, dict):
            obj = obj.get(k)
            continue
        obj = getattr(obj, k, None)
    return obj


class PricingService(SanmarServiceBase):
    """Wrapper around the Pricing & Configuration Service v1.0.0."""

    # WSDL discovery path. Like the inventory service the TS layer
    # points at the PHP gateway directly; the canonical PromoStandards
    # path is ``pricing/v1/?wsdl``. Both resolve.
    wsdl_path: ClassVar[str] = "pricing/v1/?wsdl"

    def get_pricing(
        self,
        style_number: str,
        color: Optional[str] = None,
        size: Optional[str] = None,
    ) -> PricingResponse:
        """Fetch the CAD price ladder for a style (or single SKU).

        Standing parameters per SanMar Canada::

            currency             = CAD
            fobId                = CUSTOMER
            priceType            = BLANK
            localizationCountry  = CA
            localizationLanguage = EN

        These match the TS layer character-for-character (see
        ``pricing.ts``)."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.0.0",
            "productId": style_number,
            "currency": "CAD",
            "fobId": "CUSTOMER",
            "priceType": "BLANK",
            "localizationCountry": "CA",
            "localizationLanguage": "EN",
        }
        if color is not None:
            params["partColor"] = color
        if size is not None:
            params["labelSize"] = size

        raw = self._call("getConfigurationAndPricing", **params)
        return self._parse_pricing(raw, style_number, color, size)

    @staticmethod
    def _parse_pricing(
        raw: Any,
        fallback_style: str,
        color: Optional[str],
        size: Optional[str],
    ) -> PricingResponse:
        """Project a zeep response into :class:`PricingResponse`.

        The price tiers live at
        ``Configuration.PartArray.Part.PartPriceArray.PartPrice`` per
        the WSDL, but we accept lower-cased aliases for resilience."""
        config = (
            _get(raw, "Configuration")
            or _get(raw, "configuration")
            or raw
        )

        product_id = (
            _to_str(_get(config, "productId"))
            or _to_str(_get(raw, "productId"))
            or fallback_style
        )

        # The tier array can hang off either a top-level
        # `partPriceArray` (single-part responses) or the more deeply
        # nested `PartArray.Part.PartPriceArray` (multi-part). Try both.
        breaks: list[PriceBreak] = []

        part_array = _get(config, "PartArray") or _get(config, "partArray")
        part_nodes = _to_list(
            _get(part_array, "Part") or _get(part_array, "part")
        )

        if not part_nodes:
            # Maybe `Configuration` *is* the single part — try its own
            # `partPriceArray` as if it were a Part node.
            part_nodes = [config]

        for p in part_nodes:
            price_array = _get(p, "PartPriceArray") or _get(p, "partPriceArray")
            price_nodes = _to_list(
                _get(price_array, "PartPrice")
                or _get(price_array, "partPrice")
            )
            for pp in price_nodes:
                breaks.append(
                    PriceBreak(
                        min_quantity=_to_int(_get(pp, "minQuantity"), default=1),
                        max_quantity=_to_int_or_none(_get(pp, "maxQuantity")),
                        price_cad=_to_decimal(_get(pp, "price")),
                    )
                )

        # Normalize tier order by min_quantity ascending so callers can
        # walk the ladder without sorting.
        breaks.sort(key=lambda b: b.min_quantity)

        return PricingResponse(
            style_number=product_id,
            color=color,
            size=size,
            currency=_to_str(_get(config, "currency"), default="CAD") or "CAD",
            fob_id=_to_str(_get(config, "fobId"), default="CUSTOMER")
            or "CUSTOMER",
            breaks=breaks,
        )
