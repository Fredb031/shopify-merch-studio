/**
 * removeBg — Background removal with two strategies
 *
 *   1. If VITE_REMOVE_BG_API_KEY is set, hit remove.bg's API for pro-quality
 *      cutouts (handles complex backgrounds, photos of objects, etc.)
 *
 *   2. Otherwise, use a fully in-browser canvas fallback that erases white /
 *      near-white pixels with edge-aware feathering. This works great for the
 *      most common case (a logo on a white or off-white background) and means
 *      the customizer's "Remove background" button always does something
 *      visible — no more silent fail when the API key is missing.
 *
 * SVG files skip both paths and are returned as-is — they don't have a
 * background to remove.
 */

const API_URL = 'https://api.remove.bg/v1.0/removebg';
// Hard timeout on the remote BG-removal call. Without it a hung
// connection (mobile data dropout, captive portal swallowing the
// request, remove.bg degradation) leaves the customizer's
// "removing-bg" status spinning indefinitely — the user sees
// "Suppression du fond…" forever and can't proceed. 30s is well
// above the typical 1-3s response, short enough to fall back to
// the canvas strategy and unblock the user.
const REMOTE_BG_TIMEOUT_MS = 30_000;

/**
 * Stage labels emitted to the optional progress callback. Exported so callers
 * (e.g. LogoUploader) can narrow on specific stages if they want stage-aware
 * UI copy without pattern-matching on raw strings.
 */
export type RemoveBgStage =
  | 'start'
  | 'api-request'
  | 'api-success'
  | 'api-fallback'
  | 'canvas-start'
  | 'canvas-progress'
  | 'canvas-success'
  | 'canvas-failure';

export interface RemoveBgProgress {
  stage: RemoveBgStage;
  /** Milliseconds since removeBackground() was invoked — handy for spinners */
  elapsedMs: number;
  /** Optional human-readable detail (e.g. the HTTP status on api-fallback) */
  detail?: string;
  /**
   * Fraction complete in [0..1] for long-running stages.
   * Currently populated on `canvas-progress` ticks so UIs can render a real
   * progress bar instead of a blind spinner during the pixel pass (which
   * can take 1-2s on a 4000×4000 image on low-end mobile).
   */
  fraction?: number;
}

export type RemoveBgProgressCallback = (progress: RemoveBgProgress) => void;

/**
 * Return type of {@link removeBackground} — always a Blob (PNG for the canvas
 * path, whatever remove.bg returns for the API path). Exported so callers can
 * annotate helpers that forward the result without importing Blob directly.
 */
export type RemoveBgResult = Blob;

/**
 * Named error surfaced by {@link removeBackground} and its helpers. Carries
 * an optional HTTP `status` (for remote failures) and a stable `code` string
 * (`'no-canvas-context'`, `'canvas-to-blob-failed'`, `'aborted'`, `'timeout'`,
 * `'http-error'`) so callers can branch on shape instead of string-matching
 * error messages. Instances pass `instanceof RemoveBgError` checks across the
 * async boundary — they're plain Error subclasses, no Proxy trickery.
 */
export class RemoveBgError extends Error {
  readonly status?: number;
  readonly code?: string;
  constructor(message: string, opts: { status?: number; code?: string; cause?: unknown } = {}) {
    super(message);
    this.name = 'RemoveBgError';
    this.status = opts.status;
    this.code = opts.code;
    // Preserve cause when supported (ES2022); ignored on older targets.
    if (opts.cause !== undefined) {
      try { (this as { cause?: unknown }).cause = opts.cause; } catch { /* readonly in some runtimes */ }
    }
  }
}

const noop: RemoveBgProgressCallback = () => {};

/**
 * Remove the background from an image file, preferring the remove.bg API when
 * `VITE_REMOVE_BG_API_KEY` is configured and falling back to an in-browser
 * canvas luminance pass otherwise. SVGs pass through untouched. Accepts an
 * optional progress callback and an optional AbortSignal so React effects can
 * cancel the work on unmount; the remote call always has a 30s hard timeout
 * regardless of the external signal.
 */
export async function removeBackground(
  file: File,
  onProgress: RemoveBgProgressCallback = noop,
  signal?: AbortSignal,
): Promise<RemoveBgResult> {
  const startedAt = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();
  const elapsed = () => {
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    return Math.round(now - startedAt);
  };
  // Wrap the callback so a buggy caller can never break the BG-removal
  // pipeline — progress reporting is strictly advisory.
  const report = (stage: RemoveBgStage, detail?: string, fraction?: number) => {
    try {
      onProgress({ stage, elapsedMs: elapsed(), detail, fraction });
    } catch {
      /* swallow — progress is advisory */
    }
  };

  report('start');

  // Honour an already-aborted external signal up-front. Throwing here matches
  // the DOM fetch contract: callers that pass an aborted signal expect to
  // observe the abort, not silently get a processed Blob back.
  if (signal?.aborted) {
    throw new RemoveBgError('removeBackground aborted before start', { code: 'aborted' });
  }

  // SVGs are already transparent
  if (file.type === 'image/svg+xml') return file;

  const apiKey = import.meta.env.VITE_REMOVE_BG_API_KEY;

  // ── Strategy 1: remove.bg API (best quality) ─────────────────────────────
  if (apiKey && apiKey !== '') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REMOTE_BG_TIMEOUT_MS);
    // Link the caller's AbortSignal to our internal controller so unmount /
    // user-cancel can short-circuit the fetch. We don't expose the internal
    // controller's signal to the caller — the combined effect is observable
    // on the returned promise (it rejects / falls back when either fires).
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onExternalAbort, { once: true });
    }
    report('api-request');
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('size', 'auto');

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
      if (res.ok) {
        report('api-success');
        return await res.blob();
      }
      report('api-fallback', `http-${res.status}`);
    } catch (err) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
      if ((err as Error)?.name === 'AbortError') {
        // If the CALLER aborted (not just our internal timeout), propagate as
        // RemoveBgError so the effect's cleanup can treat it as a real cancel
        // rather than a silent fallback into the canvas pass.
        if (signal?.aborted) {
          throw new RemoveBgError('removeBackground aborted by caller', { code: 'aborted', cause: err });
        }
        report('api-fallback', 'timeout');
      } else {
        report('api-fallback', 'network');
      }
    }
  }

  // Check again before kicking off the (potentially expensive) canvas pass.
  if (signal?.aborted) {
    throw new RemoveBgError('removeBackground aborted before canvas fallback', { code: 'aborted' });
  }

  // ── Strategy 2: in-browser canvas fallback ───────────────────────────────
  report('canvas-start');
  try {
    const blob = await removeWhiteBackground(file, (fraction) => {
      report('canvas-progress', undefined, fraction);
    }, signal);
    report('canvas-success');
    return blob;
  } catch (err) {
    // Propagate caller-initiated cancels (effect cleanup on unmount, user
    // hitting "cancel") instead of silently returning the original file —
    // a swallowed abort would let the now-stale result race back into the
    // customizer state after the user has moved on.
    if (err instanceof RemoveBgError && err.code === 'aborted') throw err;
    // silent — caller falls back to original
    report('canvas-failure');
    return file;
  }
}

/**
 * Erase near-white pixels using a luminance threshold + edge feathering.
 * Works well for logos on white/light backgrounds (the 90% case).
 *
 * Algorithm:
 *   1. Decode the file to a canvas
 *   2. For each pixel: compute luminance (Y = 0.299R + 0.587G + 0.114B)
 *   3. Pixels above HARD threshold → fully transparent
 *   4. Pixels in SOFT range       → linearly feathered alpha (avoids halos)
 *   5. Pixels below SOFT          → kept opaque (the logo content)
 */
async function removeWhiteBackground(
  file: File,
  onFraction?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await processBitmap(bitmap, onFraction, signal);
  } finally {
    // createImageBitmap allocates a GPU-backed buffer that only gets
    // freed when .close() is called (or on GC, which is unpredictable
    // and has caused visible memory creep during multi-upload sessions).
    // The polyfill path's try/catch ensures we close even if the main
    // pipeline throws.
    if (typeof bitmap.close === 'function') bitmap.close();
  }
}

async function processBitmap(
  bitmap: ImageBitmap,
  onFraction?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (signal?.aborted) {
    throw new RemoveBgError('canvas pass aborted before start', { code: 'aborted' });
  }
  // Cap canvas dimensions so an 8k+ logo upload doesn't OOM lower-end
  // mobile browsers on the getImageData call. A cap of 4000px on the
  // longest edge is well above the print DPI we need for a 40cm logo
  // and keeps peak memory around 64 MB even in the worst case.
  const MAX_DIM = 4000;
  const nw = bitmap.width;
  const nh = bitmap.height;
  const scale = Math.min(1, MAX_DIM / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new RemoveBgError('No 2D context available', { code: 'no-canvas-context' });

  ctx.drawImage(bitmap, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imageData.data;

  // Tunable thresholds — these work well on flat-coloured logos
  const HARD = 245; // luminance ≥ 245 → fully transparent
  const SOFT = 215; // luminance in [215..244] → fading

  // Emit progress at 25 / 50 / 75% so a caller can render a real bar
  // instead of a blind spinner. We pre-compute the pixel-index boundaries
  // (every i is a 4-byte stride) so the hot loop just does a cheap
  // integer compare against a single `nextTick` variable — avoids any
  // modulo math per pixel on 16M-pixel images.
  const total = px.length;
  const tickStride = Math.max(1, Math.floor(total / 4 / 4) * 4);
  let nextTick = tickStride;
  for (let i = 0; i < total; i += 4) {
    if (i >= nextTick) {
      // Piggy-back on the existing progress boundary to honour an external
      // abort. Checking `signal?.aborted` per pixel would tank the hot loop;
      // doing it 4 times across the whole pass keeps the worst-case wait
      // under ~500ms even on a 16M-pixel image on a low-end phone.
      if (signal?.aborted) {
        throw new RemoveBgError('canvas pass aborted by caller', { code: 'aborted' });
      }
      onFraction?.(i / total);
      nextTick += tickStride;
    }
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;

    // Saturation check — skip removal for vivid colours even if they're bright
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.18) continue; // saturated → it's logo content, leave it alone

    if (y >= HARD) {
      px[i + 3] = 0;
    } else if (y >= SOFT) {
      // Linear feather between SOFT and HARD
      const t = (y - SOFT) / (HARD - SOFT);
      px[i + 3] = Math.round(px[i + 3] * (1 - t));
    }
  }
  onFraction?.(1);

  ctx.putImageData(imageData, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob
        ? resolve(blob)
        : reject(new RemoveBgError('canvas.toBlob failed', { code: 'canvas-to-blob-failed' }))),
      'image/png',
    );
  });
}
