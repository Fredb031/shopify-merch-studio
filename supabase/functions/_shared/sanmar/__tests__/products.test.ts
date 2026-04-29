/**
 * Unit tests for the Product Data Service wrappers (products.ts).
 *
 * Coverage:
 *   - getProduct('NF0A529K') parses the full nested response into the
 *     SanmarProduct shape (productId / productName / brand / category /
 *     parts[6] with correct partIds + sizes).
 *   - getProductSellable('ACTIVE') decodes the
 *     "STYLE(COLOR,SIZE,DISCONTINUED)" microsyntax — including the `,C`
 *     suffix that flips `discontinued` true.
 *   - Error code 130 (Product Id not found) propagates as SanmarApiError
 *     with code 130 so callers can branch on it.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

async function loadProducts() {
  return await import("../products.ts");
}
async function loadClient() {
  return await import("../client.ts");
}

describe("products.getProduct", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses GetProductResponse for NF0A529K into SanmarProduct shape", async () => {
    const { getProduct } = await loadProducts();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getProduct.NF0A529K.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const product = await getProduct("NF0A529K");

    expect(product.productId).toBe("NF0A529K");
    expect(product.productName).toBe("The North Face Chest Logo Trail Crew");
    expect(product.brand).toBe("The North Face");
    expect(product.category).toBe("Sweatshirts/Fleece");
    expect(product.parts).toHaveLength(6);

    const partIds = product.parts.map((p) => p.partId);
    expect(partIds).toEqual([
      "NF0A529K-BLK-S",
      "NF0A529K-BLK-M",
      "NF0A529K-BLK-L",
      "NF0A529K-NVY-S",
      "NF0A529K-NVY-M",
      "NF0A529K-NVY-L",
    ]);

    const sizes = product.parts.map((p) => p.size);
    expect(sizes).toEqual(["S", "M", "L", "S", "M", "L"]);

    // Color comes from the nested ColorArray > Color > standardColorName tag.
    expect(product.parts[0].colorName).toBe("TNF Black");
    expect(product.parts[3].colorName).toBe("Urban Navy");
    // Country of origin survives the round-trip.
    expect(product.parts[0].countryOfOrigin).toBe("VN");
  });

  it("propagates error code 130 (Product Id not found) as SanmarApiError", async () => {
    const { getProduct } = await loadProducts();
    const { SanmarApiError } = await loadClient();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("error.code130.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    try {
      await getProduct("BOGUS");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SanmarApiError);
      // SOAP returns "130" as text; client coerces consistently.
      const err = e as InstanceType<typeof SanmarApiError>;
      expect(String(err.code)).toBe("130");
      expect(err.message).toMatch(/Product Id not found/i);
    }
  });
});

describe("products.getProductSellable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses ATC1000(Black,M,) microsyntax — active row", async () => {
    const { getProductSellable } = await loadProducts();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getProductSellable.ACTIVE.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const list = await getProductSellable("ACTIVE");

    expect(list).toHaveLength(5);

    const blkM = list.find((e) => e.styleId === "ATC1000" && e.color === "Black" && e.size === "M");
    expect(blkM).toBeDefined();
    expect(blkM!.discontinued).toBe(false);
    expect(blkM!.raw).toBe("ATC1000(Black,M,)");
  });

  it("flips discontinued=true when 4th field is `C`", async () => {
    const { getProductSellable } = await loadProducts();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getProductSellable.ACTIVE.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const list = await getProductSellable("ACTIVE");
    const redXL = list.find((e) => e.color === "Red" && e.size === "XL");
    expect(redXL).toBeDefined();
    expect(redXL!.discontinued).toBe(true);
    expect(redXL!.raw).toBe("ATC1000(Red,XL,C)");
  });

  it("getAllActiveParts() filters out discontinued entries", async () => {
    const { getAllActiveParts } = await loadProducts();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getProductSellable.ACTIVE.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const active = await getAllActiveParts();
    // 5 entries in fixture, 1 discontinued — should yield 4.
    expect(active).toHaveLength(4);
    expect(active.find((p) => p.color === "Red")).toBeUndefined();
    // Returned shape is the slim {styleId, color, size}.
    expect(Object.keys(active[0]).sort()).toEqual(["color", "size", "styleId"]);
  });
});
