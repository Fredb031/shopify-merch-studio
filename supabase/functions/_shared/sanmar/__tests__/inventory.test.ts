/**
 * Unit tests for the Inventory Service wrapper (inventory.ts).
 *
 * Coverage:
 *   - getInventoryLevels('117023') returns 1 part (17977-1) with 3 locations
 *     summing to 524 (54 + 232 + 238). Future-dated availability is NOT
 *     summed into totalQty.
 *   - Per-location qty math: Vancouver 54, Mississauga 232, Calgary 238.
 *   - Future availability dates are parsed into structured entries.
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

async function loadInventory() {
  return await import("../inventory.ts");
}

describe("inventory.getInventoryLevels", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns one part with three locations summing to 524", async () => {
    const { getInventoryLevels } = await loadInventory();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getInventoryLevels.117023.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const parts = await getInventoryLevels("117023");

    expect(parts).toHaveLength(1);
    const part = parts[0];
    expect(part.partId).toBe("17977-1");
    expect(part.color).toBe("White");
    expect(part.size).toBe("M");

    expect(part.locations).toHaveLength(3);

    // Per-location math straight from the fixture.
    const byId = Object.fromEntries(part.locations.map((l) => [l.locationId, l]));
    expect(byId[1].qty).toBe(54);
    expect(byId[2].qty).toBe(232);
    expect(byId[4].qty).toBe(238);
    // Sum = 524 (and ONLY 524 — future availability is not added).
    expect(part.totalQty).toBe(524);
    expect(54 + 232 + 238).toBe(524);
  });

  it("totalQty does NOT include future availability quantities", async () => {
    const { getInventoryLevels } = await loadInventory();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getInventoryLevels.117023.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const [part] = await getInventoryLevels("117023");
    // Vancouver has +100 future, Calgary has +50 future. If futures were
    // (incorrectly) included, totalQty would be 524 + 150 = 674.
    expect(part.totalQty).not.toBe(674);
    expect(part.totalQty).toBe(524);

    // But the structured futureAvailability arrays are populated.
    const vancouver = part.locations.find((l) => l.locationId === 1)!;
    expect(vancouver.futureAvailability).toHaveLength(1);
    expect(vancouver.futureAvailability[0].qty).toBe(100);
  });

  it("parses futureAvailability dates", async () => {
    const { getInventoryLevels } = await loadInventory();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getInventoryLevels.117023.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const [part] = await getInventoryLevels("117023");
    const vancouver = part.locations.find((l) => l.locationId === 1)!;
    expect(vancouver.futureAvailability[0].availableOn).toBe("2026-06-15");

    const calgary = part.locations.find((l) => l.locationId === 4)!;
    expect(calgary.futureAvailability).toHaveLength(1);
    expect(calgary.futureAvailability[0].qty).toBe(50);
    expect(calgary.futureAvailability[0].availableOn).toBe("2026-07-22");

    // Mississauga has no future block in the fixture — should be empty array.
    const miss = part.locations.find((l) => l.locationId === 2)!;
    expect(miss.futureAvailability).toEqual([]);
  });

  it("decorates locations with the canonical Vancouver/Mississauga/Calgary names", async () => {
    const { getInventoryLevels } = await loadInventory();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("getInventoryLevels.117023.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const [part] = await getInventoryLevels("117023");
    const names = part.locations.map((l) => l.locationName).sort();
    expect(names).toEqual(["Calgary", "Mississauga", "Vancouver"]);
  });
});
