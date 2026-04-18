/**
 * placement.ts — single source of truth for logo placement math.
 *
 * Every "center on garment", "center on chest", "zone preset", and
 * "first-upload auto-place" call goes through this helper so the math
 * is tuned in one place. Returns canvas-percent coordinates that feed
 * directly into LogoPlacement { x, y, width }.
 */
import type { PrintZone } from '@/data/products';

export type Bbox = {
  x: number; y: number; w: number; h: number;
  cx: number; cy: number;
};

type Params = {
  /** Detected garment bbox (percentages of canvas). When absent, we fall
   * back to the printZone's declared coordinates. */
  bbox?: Bbox | null;
  /** Zone to anchor within when bbox is unavailable. */
  zone?: PrintZone;
  /** Override the logo width percent. When omitted, we use a sensible
   * default relative to the bbox width. */
  widthPct?: number;
};

/** Logo width as a percent of the CANVAS. Defaults to ~35% of the garment
 * bbox width, capped at 32 (so a slim garment doesn't explode into a
 * massive logo and a wide garment doesn't yield something tiny). */
const defaultWidth = (bbox?: Bbox | null) =>
  bbox ? Math.min(bbox.w * 0.35, 32) : 26;

/** Center on the true garment bbox. Falls back to canvas 50/50 when
 * bbox wasn't detected. */
export function centerOnGarment(p: Params) {
  const { bbox } = p;
  return {
    x: bbox ? bbox.cx : 50,
    y: bbox ? bbox.cy : 50,
    width: p.widthPct ?? defaultWidth(bbox),
  };
}

/** Chest point = horizontally centered on the bbox, vertically at 25%
 * from the top of the bbox. This is where a real printer puts a chest
 * logo on a t-shirt. */
export function centerOnChest(p: Params) {
  const { bbox, zone } = p;
  if (bbox) {
    return {
      x: bbox.cx,
      y: bbox.y + bbox.h * 0.25,
      width: p.widthPct ?? Math.min(bbox.w * 0.32, 28),
    };
  }
  if (zone) {
    return {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
      width: p.widthPct ?? zone.width * 0.85,
    };
  }
  return { x: 50, y: 37, width: 24 };
}

/** Center on a specific print zone (used when user picks a zone preset). */
export function centerOnZone(zone: PrintZone) {
  return {
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
    width: zone.width * 0.85,
  };
}

/** Auto-placement on first upload: prefer the chest point if we have a
 * bbox, otherwise the declared default zone. */
export function autoPlaceOnUpload(p: Params) {
  return centerOnChest(p);
}
