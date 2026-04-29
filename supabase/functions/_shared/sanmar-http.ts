/**
 * Shared HTTP helpers for SanMar edge functions.
 *
 * Centralizes the SanmarApiError → HTTP status mapping so every function
 * has identical error semantics: PromoStandards 100-series + 200-series
 * codes return 4xx (caller error), 600/620/630/999/network/parse return
 * 5xx (transient — caller may retry).
 */

import { SanmarApiError } from './sanmar/client.ts';
import { jsonResponse } from './cors.ts';

/**
 * Map a SanmarApiError to an HTTP status code.
 * - 100/104/105/110/115/120/125/130/135/140/145/150 → 400 (bad request,
 *   missing required fields, invalid IDs, etc.)
 * - 210 → 400 (validation we did locally — forbidden chars / postal)
 * - 300/301/302 → 401 (auth)
 * - 600/610/620/630 → 502 (SanMar service error)
 * - 999 → 500 (unhandled)
 * - 'network' / 'parse' / 'configuration' / 'http-*' → 502
 */
function statusForSanmarError(err: SanmarApiError): number {
  const code = err.code;
  const num = typeof code === 'string' ? parseInt(code, 10) : code;
  if (typeof num === 'number' && !Number.isNaN(num)) {
    if (num >= 100 && num < 300) return 400;
    if (num >= 300 && num < 400) return 401;
    if (num >= 600 && num < 700) return 502;
    if (num === 999) return 500;
  }
  if (typeof code === 'string') {
    if (code === 'network' || code === 'parse' || code.startsWith('http-')) return 502;
    if (code === 'configuration') return 500;
  }
  return 500;
}

/** Standard error body shape required by Step 3 spec. */
export function errorBody(
  code: string | number,
  message: string,
  severity = 'Error',
): { error: { code: string | number; message: string; severity: string } } {
  return { error: { code, message, severity } };
}

/**
 * Wrap a handler so any thrown error becomes the standard error response.
 * Use when the success path returns a JSON-serializable value.
 */
export async function runSanmar<T>(
  fn: () => Promise<T>,
  successStatus = 200,
): Promise<Response> {
  try {
    const result = await fn();
    return jsonResponse(result, successStatus);
  } catch (e) {
    if (e instanceof SanmarApiError) {
      return jsonResponse(
        errorBody(e.code, e.message, e.severity),
        statusForSanmarError(e),
      );
    }
    console.error('[sanmar edge] unhandled error:', e);
    return jsonResponse(errorBody(999, 'Internal error', 'Error'), 500);
  }
}
