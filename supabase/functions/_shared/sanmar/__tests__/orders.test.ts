/**
 * Unit tests for the Purchase Order + Order Status Service wrappers
 * (orders.ts).
 *
 * Coverage:
 *   - submitOrder() with a valid order returns transactionId 371 (per PDF
 *     SendPOResponse fixture).
 *   - Local validation fires BEFORE the network call when ship-to
 *     companyName contains an `@` — assert fetch was NOT invoked.
 *   - Invalid CA postal "123 ABC" rejected with code 210, no fetch.
 *   - Invalid US postal "123" rejected with code 210, no fetch.
 *   - getOrderStatus(3, ...) throws (queryType=3 unsupported).
 *   - getOrderStatus(1, 'SAMPLES') parses 4 OrderStatusDetail entries.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

beforeAll(() => {
  (globalThis as any).Deno = {
    env: {
      get: (k: string) => {
        const map: Record<string, string> = {
          SANMAR_CUSTOMER_ID: "test-customer",
          SANMAR_PASSWORD: "test-pw",
          SANMAR_ENV: "UAT",
        };
        return map[k];
      },
    },
  };
});

const FIXTURES = join(__dirname, "fixtures");
const readFixture = (name: string) => readFileSync(join(FIXTURES, name), "utf-8");

async function loadOrders() {
  return await import("../orders.ts");
}
async function loadClient() {
  return await import("../client.ts");
}

function validOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderType: "Sample" as const,
    orderNumber: "PO-12345",
    totalAmount: 100,
    currency: "CAD" as const,
    rush: false,
    orderContact: { attentionTo: "Receiving", email: "buyer@example.com" },
    shipContact: {
      companyName: "Vision Affichage",
      address1: "123 King St",
      city: "Toronto",
      region: "ON",
      postalCode: "M5H 1A1",
      country: "CA" as const,
    },
    shipment: { allowConsolidation: false, blindShip: false, packingListRequired: false, carrier: "Purolator" },
    lineItems: [
      { lineNumber: "1", quantity: 2, unitPrice: 14.99, productId: "ATC1000-BLK-M" },
    ],
    ...overrides,
  };
}

describe("orders.submitOrder", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns transactionId 371 from the SendPOResponse fixture", async () => {
    const { submitOrder } = await loadOrders();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(readFixture("submitOrder.success.xml"), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await submitOrder(validOrder() as any);
    expect(result.transactionId).toBe(371);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects ship-to companyName containing `@` BEFORE network", async () => {
    const { submitOrder } = await loadOrders();
    const { SanmarApiError } = await loadClient();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const order = validOrder({
      shipContact: {
        companyName: "Sketchy@Company",
        address1: "1 St",
        city: "Toronto",
        region: "ON",
        postalCode: "M5H 1A1",
        country: "CA",
      },
    }) as any;

    await expect(submitOrder(order)).rejects.toBeInstanceOf(SanmarApiError);
    await expect(submitOrder(order)).rejects.toMatchObject({ code: 210 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid CA postal `123 ABC` with code 210, no network", async () => {
    const { submitOrder } = await loadOrders();
    const { SanmarApiError } = await loadClient();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const order = validOrder({
      shipContact: {
        companyName: "OK Inc",
        address1: "1 St",
        city: "Toronto",
        region: "ON",
        postalCode: "123 ABC",
        country: "CA",
      },
    }) as any;

    await expect(submitOrder(order)).rejects.toBeInstanceOf(SanmarApiError);
    await expect(submitOrder(order)).rejects.toMatchObject({ code: 210 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects US postal `123` (too short) with code 210, no network", async () => {
    const { submitOrder } = await loadOrders();
    const { SanmarApiError } = await loadClient();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const order = validOrder({
      shipContact: {
        companyName: "OK Inc",
        address1: "1 St",
        city: "Buffalo",
        region: "NY",
        postalCode: "123",
        country: "US",
      },
    }) as any;

    await expect(submitOrder(order)).rejects.toBeInstanceOf(SanmarApiError);
    await expect(submitOrder(order)).rejects.toMatchObject({ code: 210 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("orders.getOrderStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws on queryType=3 (unsupported by SanMar Canada)", async () => {
    const { getOrderStatus } = await loadOrders();
    const { SanmarApiError } = await loadClient();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getOrderStatus(3 as any, "SAMPLES")).rejects.toBeInstanceOf(SanmarApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses 4 OrderStatusDetail entries from the SAMPLES fixture", async () => {
    const { getOrderStatus } = await loadOrders();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getOrderStatus.SAMPLES.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await getOrderStatus(1, "SAMPLES");
    expect(result).toHaveLength(1);
    const order = result[0];
    expect(order.purchaseOrderNumber).toBe("SAMPLES");
    expect(order.orderStatusDetails).toHaveLength(4);

    // Status name mapping survives through to the typed enum.
    const names = order.orderStatusDetails.map((d) => d.statusName);
    expect(names).toEqual(["received", "in-production", "partial", "complete"]);

    // responseRequired bool parsing.
    const partial = order.orderStatusDetails[2];
    expect(partial.responseRequired).toBe(true);
    const complete = order.orderStatusDetails[3];
    expect(complete.responseRequired).toBe(false);
  });
});
