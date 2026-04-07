"""
sync_images.py — GitHub Action script
Downloads all product images from Google Drive → uploads to Supabase → updates products.ts
"""
import os
import re
import json
import sys
import time
import mimetypes
import subprocess
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_KEY     = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET           = "product-images"
PRODUCTS_TS_PATH = Path("src/data/products.ts")
TMP_DIR          = Path("/tmp/drive_images")

# ── All 20 product folder IDs (Google Drive) ──────────────────────────────────
PRODUCT_FOLDERS = {
    "atcf2500":  "1ug9KoBm1g7Qp3Bnd_M_N4zRxuA9v6ubB",   # Low-Res subfolder
    "atcf2600":  "1jmFEtlcRVC150Obn8r--UfcDUwYJmjdT",
    "atcf2400":  "1R4-FbfD14uR183s1pmy3DPv8T2PbG-xo",
    "atcy2500":  "1PaJPHsNtVtLFtycqw0wk2jhs64fddIVj",
    "atc1000":   "1F-SJonFdlNOpJhUYTQwh7IsTgnkxFWYN",
    "atc1000l":  "1T66Vj6T5pkWBIODlUeGSEcgFOmkeIOtl",
    "atc1000y":  "1BDFkbuG6Gkekq1X7zXn8eSogKPoeYnoJ",
    "atc1015":   "1nR18fqIK_UKcjnAGLXXcz2H8wZNQVPts",
    "werk250":   "1H5OzaLv5vtz5NauuzMCuKJheAgaGbWdv",
    "s445":      "1Jov-de_OCnewGWTGQ2OG-f0BC9OyZfCI",
    "l445":      "11xHvIC0Yb7uBmsNvxOfaefuyFQeUskvv",
    "s445ls":    "13O98yPR4H0WPhN_idBgcIEQbhnPnzVWq",
    "s350":      "1JVPzWj7W9cgbUWTgEIlnr1SxIprMUxYK",
    "l350":      "1mGCBVFodq1X6AAJk20Tb2lI_4xoCCGQB",
    "y350":      "1E9d5s06mGeWBAFbbmZqsVDrndjdjc3v2",
    "atc6606":   "1TK15w47LhRwJivHH7smGF5sBT5NiHgle",
    "6245cm":    "1BBH-wTBosry8_DP627MF-A3ylQYDz-nJ",
    "atc6277":   "1MoaY_HMKQLU6VTs2IHqSjhk7EGQULHBo",
    "c100":      "13rOMQ2KSG7P9p1iMM9ufX3LQdwrnh-Nm",
    "c105":      "1MiQiq0k5epzTK9pIev6ug6xXQ7X7zV3u",
}

# ── Colour name normalisation ─────────────────────────────────────────────────
COLOR_MAP = {
    "black": "black", "noir": "black",
    "white": "white", "blanc": "white",
    "navy": "navy", "marine": "navy",
    "steel grey": "steel-grey", "steel-grey": "steel-grey", "gris acier": "steel-grey",
    "dark heather": "dark-heather", "dark heather grey": "dark-heather",
    "light heather": "light-heather",
    "athletic heather": "athletic-heather", "ath hthr": "athletic-heather",
    "red": "red", "rouge": "red",
    "true red": "true-red",
    "true royal": "true-royal", "royal": "true-royal", "bleu royal": "true-royal",
    "forest green": "forest-green", "vert foret": "forest-green", "vert forêt": "forest-green",
    "burgundy": "burgundy", "bourgogne": "burgundy",
    "purple": "purple", "mauve": "purple",
    "gold": "gold", "or": "gold",
    "charcoal": "charcoal", "charbon": "charcoal",
    "military green": "military-green", "vert militaire": "military-green",
    "cardinal": "cardinal",
    "orange": "orange",
    "maroon": "maroon", "bordeaux": "maroon",
    "khaki": "khaki", "kaki": "khaki",
    "natural": "natural", "naturel": "natural",
    "grey": "grey", "gray": "grey", "gris": "grey",
    "lime shock": "lime-shock", "vert lime": "lime-shock",
    "light blue": "light-blue", "bleu pale": "light-blue",
    "black heather": "black-heather",
    "heather grey": "heather-grey", "hthr grey": "heather-grey",
    "carbon": "charcoal",
    "dark red": "dark-red",
    "forest": "forest-green",
}

FRONT_KW = ["front", "devant", "avant", "_f_", "-f-", "f.jpg", "f.png"]
BACK_KW  = ["back",  "dos",    "arriere", "_b_", "-b-", "b.jpg", "b.png"]

def parse_filename(name: str):
    stem = Path(name).stem.lower()
    # Remove SKU prefix
    for sku in sorted(PRODUCT_FOLDERS.keys(), key=len, reverse=True):
        stem = re.sub(rf"\b{re.escape(sku)}\b[_\-]?", "", stem)
    stem = re.sub(r"[_\-]+", " ", stem).strip()

    view = None
    for kw in FRONT_KW:
        if kw in stem or kw in name.lower():
            view = "front"; stem = stem.replace(kw.strip("._-"), "").strip(); break
    if not view:
        for kw in BACK_KW:
            if kw in stem or kw in name.lower():
                view = "back"; stem = stem.replace(kw.strip("._-"), "").strip(); break

    stem = re.sub(r"\s+", " ", stem).strip()
    color_id = COLOR_MAP.get(stem, stem.replace(" ", "-") or "unknown")
    return color_id, view

def download_folder(folder_id: str, dest: Path) -> list:
    dest.mkdir(parents=True, exist_ok=True)
    try:
        import gdown
        url = f"https://drive.google.com/drive/folders/{folder_id}"
        gdown.download_folder(url, output=str(dest), quiet=True, use_cookies=False)
    except Exception as e:
        print(f"    ⚠️ gdown error: {e}")
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    return [f for f in dest.rglob("*") if f.suffix.lower() in exts]

def upload_file(client, local: Path, storage_path: str) -> str:
    mime = mimetypes.guess_type(str(local))[0] or "image/jpeg"
    with open(local, "rb") as f:
        data = f.read()
    client.storage.from_(BUCKET).upload(
        storage_path, data,
        file_options={"content-type": mime, "upsert": "true"}
    )
    return client.storage.from_(BUCKET).get_public_url(storage_path)

def patch_products_ts(url_map: dict):
    """
    Patch src/data/products.ts to inject real imageDevant/imageDos per color.
    Adds/updates imageDevant and imageDos fields in each ProductColor entry.
    """
    content = PRODUCTS_TS_PATH.read_text(encoding="utf-8")

    # For each product × color that has images, inject URLs
    for product_id, colors in url_map.items():
        for color_id, views in colors.items():
            front = views.get("front", "")
            back  = views.get("back", "")
            if not front:
                continue

            # Find the color entry:  { id: 'color_id', ...
            # and add/replace imageDevant + imageDos
            pattern = rf"(\{{\s*id:\s*['\"]){re.escape(color_id)}(['\"])"
            
            def replacer(m):
                block_start = m.group(0)
                # We'll inject after the id field
                inject = ""
                if front:
                    inject += f"\n    imageDevant: '{front}',"
                if back:
                    inject += f"\n    imageDos: '{back}',"
                return block_start + inject
            
            # Only patch within the right product block (simple approach: patch all matching color IDs)
            content = re.sub(pattern, replacer, content, count=1)

    PRODUCTS_TS_PATH.write_text(content, encoding="utf-8")
    print("✅ products.ts patched with real image URLs")

def main():
    from supabase import create_client

    print(f"🔗 Connecting to Supabase: {SUPABASE_URL[:30]}...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Create bucket if needed
    try:
        client.storage.create_bucket(BUCKET, options={"public": True})
        print(f"✅ Bucket '{BUCKET}' created")
    except Exception:
        print(f"ℹ️  Bucket '{BUCKET}' exists")

    url_map = {}
    total_ok = 0
    total_err = 0

    for product_id, folder_id in PRODUCT_FOLDERS.items():
        print(f"\n📦 {product_id.upper()}")
        dest = TMP_DIR / product_id
        images = download_folder(folder_id, dest)

        if not images:
            print(f"  ⚠️ No images found")
            continue

        print(f"  📸 {len(images)} images found")
        url_map[product_id] = {}

        for img in sorted(images):
            color_id, view = parse_filename(img.name)
            if color_id not in url_map[product_id]:
                url_map[product_id][color_id] = {}

            storage_path = f"{product_id}/{color_id}-{view or 'unknown'}{img.suffix.lower()}"
            try:
                url = upload_file(client, img, storage_path)
                url_map[product_id][color_id][view or "unknown"] = url
                print(f"  ✅ {img.name} → {color_id}/{view}")
                total_ok += 1
            except Exception as e:
                print(f"  ❌ {img.name}: {e}")
                total_err += 1

    # Save JSON for reference
    with open("products_images.json", "w") as f:
        json.dump(url_map, f, indent=2)

    print(f"\n{'='*50}")
    print(f"✅ {total_ok} uploaded, {total_err} errors")

    # Patch products.ts with real URLs
    patch_products_ts(url_map)

if __name__ == "__main__":
    main()
