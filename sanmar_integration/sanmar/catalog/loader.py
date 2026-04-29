"""Load the SanMar master catalog XLSX into a normalized pandas DataFrame.

The source file ships with ~16,630 rows and idiosyncratic headers (e.g.
`STYLE#`, `COLOR_NAME`, `FULL_FEATURE_DESCRIPTION`). We normalize them to
snake_case canonical names so downstream code doesn't have to know the
upstream spellings.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Final

import pandas as pd
from loguru import logger

# Canonical name -> set of accepted upstream variants (case/whitespace-insensitive).
_COLUMN_ALIASES: Final[dict[str, tuple[str, ...]]] = {
    "style_number": ("style#", "style_number", "style", "style_no", "style_num"),
    "color_name": ("color_name", "color", "colour", "colour_name"),
    "size": ("size", "size_name"),
    "full_feature_description": (
        "full_feature_description",
        "description",
        "feature_description",
        "long_description",
    ),
    "brand_name": ("brand_name", "brand", "mill_name", "manufacturer"),
    "category": ("category", "product_category", "category_name"),
    "parent_sku": ("parent_sku", "parent_style", "master_sku"),
    "full_sku": ("full_sku", "sku", "unique_key", "product_sku"),
    "price_cad": ("price_cad", "price", "list_price", "cad_price"),
    "weight_g": ("weight_g", "weight", "weight_grams"),
    "status": ("status", "product_status", "lifecycle_status"),
}


def normalize_column_names(name: str) -> str:
    """Map an arbitrary upstream header to its canonical snake_case form.

    Returns the canonical name when a known alias matches, otherwise a
    best-effort snake_case version of the input.
    """
    cleaned = name.strip().lower()
    cleaned = re.sub(r"[^\w]+", "_", cleaned)  # `STYLE#` -> `style_`
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")

    for canonical, aliases in _COLUMN_ALIASES.items():
        normalized_aliases = {re.sub(r"[^\w]+", "_", a.lower()).strip("_") for a in aliases}
        if cleaned in normalized_aliases or cleaned == canonical:
            return canonical
    return cleaned


def load_catalog(xlsx_path: Path) -> pd.DataFrame:
    """Read the SanMar master catalog XLSX into a cleaned DataFrame.

    Args:
        xlsx_path: Path to the master catalog `.xlsx` file.

    Returns:
        A DataFrame with canonical snake_case column names and trimmed string
        cells.

    Raises:
        FileNotFoundError: with a helpful message when the file is absent.
    """
    xlsx_path = Path(xlsx_path)
    if not xlsx_path.exists():
        raise FileNotFoundError(
            f"SanMar master catalog not found at {xlsx_path}. "
            f"Place the SanMar master catalog XLSX at {xlsx_path}. "
            "Phase 1 cannot proceed without it."
        )

    logger.info(f"Reading master catalog from {xlsx_path}")
    df = pd.read_excel(xlsx_path, engine="openpyxl")
    logger.info(f"Loaded {len(df):,} rows, {len(df.columns)} columns from XLSX")

    df = df.rename(columns={c: normalize_column_names(c) for c in df.columns})

    # Strip whitespace from object/string columns.
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].astype(str).str.strip().replace({"nan": pd.NA, "": pd.NA})

    return df
