/**
 * Edge function: sanmar-products
 *
 * Dispatches across the three Product Data 2.0 actions:
 *   - getProduct           Body: { action, productId, partId? }
 *   - getProductSellable   Body: { action, productId } (productId can be 'ACTIVE' / 'ALL' / a real style)
 *   - getAllActiveParts    Body: { action } (no other args; returns active SKUs)
 *
 * Calls the matching shared module function and returns its shaped JSON.
 */

import { handleCors } from '../_shared/cors.ts';
import { runSanmar, errorBody } from '../_shared/sanmar-http.ts';
import {
  getProduct,
  getProductSellable,
  getAllActiveParts,
} from '../_shared/sanmar/products.ts';

interface RequestBody {
  action: 'getProduct' | 'getProductSellable' | 'getAllActiveParts';
  productId?: string;
  partId?: string;
}

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorBody(140, 'Method not allowed')), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify(errorBody(140, 'Invalid JSON body')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return runSanmar(async () => {
    switch (body.action) {
      case 'getProduct': {
        if (!body.productId) {
          throw new Error('productId is required for getProduct');
        }
        return await getProduct(body.productId, body.partId ? { partId: body.partId } : {});
      }
      case 'getProductSellable': {
        if (!body.productId) {
          throw new Error('productId is required for getProductSellable');
        }
        return await getProductSellable(body.productId);
      }
      case 'getAllActiveParts': {
        return await getAllActiveParts();
      }
      default:
        throw new Error(`Unknown action: ${(body as { action?: string }).action ?? 'undefined'}`);
    }
  });
});
