"""Pytest suite for the XLSX -> SQLite catalog pipeline (synthetic data)."""
from __future__ import annotations

import pandas as pd
import pytest
from sqlalchemy.orm import Session

from sanmar.catalog.loader import normalize_column_names
from sanmar.catalog.store import persist_catalog
from sanmar.db import init_schema, make_engine, make_session_factory


@pytest.fixture
def synthetic_df() -> pd.DataFrame:
    """5-row synthetic catalog DataFrame using already-canonical columns."""
    return pd.DataFrame(
        [
            {
                "style_number": "PC54",
                "color_name": "Black",
                "size": "M",
                "full_feature_description": "Port & Company Core Cotton Tee",
                "brand_name": "Port & Company",
                "category": "T-Shirts",
                "price_cad": 7.49,
                "weight_g": 180.0,
            },
            {
                "style_number": "PC54",
                "color_name": "Black",
                "size": "L",
                "full_feature_description": "Port & Company Core Cotton Tee",
                "brand_name": "Port & Company",
                "category": "T-Shirts",
                "price_cad": 7.49,
                "weight_g": 190.0,
            },
            {
                "style_number": "PC54",
                "color_name": "Navy",
                "size": "M",
                "full_feature_description": "Port & Company Core Cotton Tee",
                "brand_name": "Port & Company",
                "category": "T-Shirts",
                "price_cad": 7.49,
                "weight_g": 180.0,
            },
            {
                "style_number": "ST350",
                "color_name": "Red",
                "size": "L",
                "full_feature_description": "Sport-Tek PosiCharge Tee",
                "brand_name": "Sport-Tek",
                "category": "Performance",
                "price_cad": 12.99,
                "weight_g": 165.0,
            },
            {
                "style_number": "ST350",
                "color_name": "Red",
                "size": "XL",
                "full_feature_description": "Sport-Tek PosiCharge Tee",
                "brand_name": "Sport-Tek",
                "category": "Performance",
                "price_cad": 12.99,
                "weight_g": 175.0,
            },
        ]
    )


@pytest.fixture
def session(tmp_path) -> Session:
    db_path = tmp_path / "test_sanmar.db"
    engine = make_engine(db_path)
    init_schema(engine)
    factory = make_session_factory(engine)
    sess = factory()
    try:
        yield sess
    finally:
        sess.close()


def test_normalize_column_names_canonicalizes_known_aliases() -> None:
    assert normalize_column_names("STYLE#") == "style_number"
    assert normalize_column_names("style_number") == "style_number"
    assert normalize_column_names("Style") == "style_number"
    assert normalize_column_names("COLOR_NAME") == "color_name"
    assert normalize_column_names("Colour") == "color_name"
    assert normalize_column_names("FULL_FEATURE_DESCRIPTION") == "full_feature_description"
    assert normalize_column_names("BRAND_NAME") == "brand_name"
    assert normalize_column_names("Random Header X") == "random_header_x"


def test_persist_catalog_upserts_cleanly(synthetic_df: pd.DataFrame, session: Session) -> None:
    counts = persist_catalog(synthetic_df, session)
    session.commit()

    assert counts["rows_processed"] == 5
    assert counts["brands"] == 2  # Port & Company, Sport-Tek
    assert counts["products"] == 2  # PC54, ST350
    assert counts["variants"] == 5  # PC54-Black-M, PC54-Black-L, PC54-Navy-M, ST350-Red-L, ST350-Red-XL


def test_persist_catalog_is_idempotent(synthetic_df: pd.DataFrame, session: Session) -> None:
    first = persist_catalog(synthetic_df, session)
    session.commit()
    second = persist_catalog(synthetic_df, session)
    session.commit()

    assert first["brands"] == second["brands"]
    assert first["products"] == second["products"]
    assert first["variants"] == second["variants"]
