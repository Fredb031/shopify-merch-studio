/**
 * Edge function: sanmar-order-status
 *
 * Body: { queryType: 1 | 2 | 4; referenceNumber?: string }
 *
 * queryType per PDF:
 *   1 = lookup by Purchase Order number (referenceNumber required)
 *   2 = lookup by Sales Order / Invoice (referenceNumber required)
 *   4 = list all open orders (referenceNumber MUST be empty)
 */

import { handleCors } from '../_shared/cors.ts';
import { runSanmar, errorBody } from '../_shared/sanmar-http.ts';
import { getOrderStatus, type SanmarOrderQueryType } from '../_shared/sanmar/orders.ts';

interface RequestBody {
  queryType: 1 | 2 | 4;
  referenceNumber?: string;
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
    const qt = body.queryType;
    if (qt !== 1 && qt !== 2 && qt !== 4) {
      throw new Error(`Invalid queryType ${String(qt)}; must be 1, 2, or 4`);
    }
    return await getOrderStatus(qt as SanmarOrderQueryType, body.referenceNumber);
  });
});
