/**
 * Unit tests for the Pricing & Configuration Service wrapper (pricing.ts).
 *
 * Coverage:
 *   - Single-break response: one PartPrice row parsed end-to-end (price,
 *     UoM, currency, FOB locations, effective/expiry dates).
 *   - Multi-break ladder: 4-tier price ladder (qty 1, 12, 24, 72) parsed
 *     into 4 SanmarPricingRow entries with correct breakpoints.
 *   - Request payload assertions: SanMar Canada always quotes CAD with
 *     priceType=Customer and configurationType=Blank — verified by
 *     inspecting the body fed to fetch.
 *   - Open-ended top tier: the highest-quantity tier in the response sets
 *     the bottom of an "and up" range (callers infer no upper bound from
 *     the absence of a higher row).
 *   - SOAP Fault response: surfaces as SanmarApiError carrying the
 *     faultstring as message.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

beforeAll(() => {
  (globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
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

async function loadPricing() {
  return await import("../pricing.ts");
}
async function loadClient() {
  return await import("../client.ts");
}

describe("pricing.getPricing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a single-break PartPrice response into one SanmarPricingRow", async () => {
    const { getPricing } = await loadPricing();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("pricing-single-break.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const rows = await getPricing("PC54");

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.partId).toBe("PC54-NVY-M");
    expect(row.minQuantity).toBe(1);
    expect(row.price).toBeCloseTo(9.75, 2);
    expect(row.priceUom).toBe("EA");
    expect(row.currency).toBe("CAD");
    expect(row.priceEffectiveDate).toBe("2026-01-01T00:00:00Z");
    expect(row.priceExpiryDate).toBe("2026-12-31T23:59:59Z");
    expect(row.fobLocations.sort()).toEqual([1, 2]);
  });

  it("parses a 4-tier multi-break ladder (qty 1 / 12 / 24 / 72)", async () => {
    const { getPricing } = await loadPricing();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("pricing-multi-break.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const rows = await getPricing("ATC1000");

    expect(rows).toHaveLength(4);

    // Sort defensively in case the parser reorders.
    const byMin = [...rows].sort((a, b) => a.minQuantity - b.minQuantity);
    expect(byMin.map((r) => r.minQuantity)).toEqual([1, 12, 24, 72]);
    expect(byMin.map((r) => r.price)).toEqual([18.99, 16.49, 14.25, 11.99]);

    // All tiers belong to the same partId and priced in CAD.
    expect(byMin.every((r) => r.partId === "ATC1000-RED-L")).toBe(true);
    expect(byMin.every((r) => r.currency === "CAD")).toBe(true);
    // Price decreases monotonically with volume.
    for (let i = 1; i < byMin.length; i++) {
      expect(byMin[i].price).toBeLessThan(byMin[i - 1].price);
    }
  });

  it("sends a CAD / Customer / Blank request payload", async () => {
    const { getPricing } = await loadPricing();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(readFixture("pricing-single-break.xml"), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getPricing("PC54");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(init.body);
    expect(body).toContain("<currency>CAD</currency>");
    expect(body).toContain("<priceType>Customer</priceType>");
    expect(body).toContain("<configurationType>Blank</configurationType>");
    // Localization should be Canadian English to match the SanMar Canada
    // gateway's expected locale.
    expect(body).toContain("<localizationCountry>CA</localizationCountry>");
    expect(body).toContain("<localizationLanguage>EN</localizationLanguage>");
    // wsVersion 1.0.0 is the contract version this client targets.
    expect(body).toContain("<wsVersion>1.0.0</wsVersion>");
    // Credentials from the Deno shim are escaped into the body.
    expect(body).toContain("<id>test-customer</id>");
    expect(body).toContain("<password>test-pw</password>");
  });

  it("treats the highest-quantity tier as the open-ended 'and up' range", async () => {
    // Per the type contract, callers infer "no upper bound" from the
    // absence of a higher-minQuantity row — there is no maxQuantity field.
    // The 72+ row in the multi-break fixture must therefore be the last
    // tier with no row above it.
    const { getPricing } = await loadPricing();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("pricing-multi-break.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const rows = await getPricing("ATC1000");
    const maxMin = Math.max(...rows.map((r) => r.minQuantity));
    expect(maxMin).toBe(72);

    const topTier = rows.find((r) => r.minQuantity === 72)!;
    // No row sits above it — qty 100, 500, 10_000 all fall into this tier.
    const above = rows.filter((r) => r.minQuantity > topTier.minQuantity);
    expect(above).toHaveLength(0);
    // Ensure no maxQuantity field accidentally appears on the row shape.
    expect((topTier as unknown as Record<string, unknown>).maxQuantity).toBeUndefined();
    // Top tier ships from all three Canadian warehouses.
    expect(topTier.fobLocations.sort()).toEqual([1, 2, 4]);
  });

  it("throws SanmarApiError on a SOAP Fault response", async () => {
    const { getPricing } = await loadPricing();
    const { SanmarApiError } = await loadClient();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("pricing-error-fault.xml"), { status: 500 }),
    ) as unknown as typeof fetch;

    try {
      await getPricing("BOGUS");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SanmarApiError);
      const err = e as InstanceType<typeof SanmarApiError>;
      // Fault carries the faultstring through as the error description.
      expect(err.message).toMatch(/Authentication failed/i);
      expect(err.severity).toBe("Error");
    }
  });
});
