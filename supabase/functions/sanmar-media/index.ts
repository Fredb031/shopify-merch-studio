/**
 * Edge function: sanmar-media
 *
 * Body: { productId: string; partId?: string }
 * Returns the parsed Media Content 1.1 response (image URLs + parsed
 * description fields).
 *
 * Note: this service authenticates with SANMAR_MEDIA_PASSWORD (a separate
 * credential from the main SOAP password) — that detail is handled inside
 * the shared module.
 */

import { handleCors } from '../_shared/cors.ts';
import { runSanmar, errorBody } from '../_shared/sanmar-http.ts';
import { getProductImages } from '../_shared/sanmar/media.ts';

interface RequestBody {
  productId: string;
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
    if (!body.productId) {
      throw new Error('productId is required');
    }
    return await getProductImages(body.productId, body.partId);
  });
});
