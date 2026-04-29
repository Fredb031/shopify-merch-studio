/**
 * Unit tests for the SanMar sync-failure alert helper (notify.ts).
 *
 * Coverage:
 *   1. SANMAR_ALERT_WEBHOOK_URL unset → no fetch, no throw (no-op)
 *   2. Webhook returns 200 → success path, fetch called once with the
 *      Slack-compatible payload shape
 *   3. Webhook returns 500 → caught, no throw, error logged via console
 *
 * Vitest runs in Node; Deno.env is shimmed so the imported module's
 * Deno.env.get() lookups resolve to our test fixtures.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Per-test override for SANMAR_ALERT_WEBHOOK_URL — beforeAll wires the
// shim, individual tests mutate `envOverrides` to flip the value.
const envOverrides: Record<string, string | undefined> = {};

beforeAll(() => {
  (globalThis as any).Deno = {
    env: {
      get: (k: string) => envOverrides[k],
    },
  };
});

beforeEach(() => {
  // Default: webhook URL is unset. Each test opts in.
  for (const k of Object.keys(envOverrides)) delete envOverrides[k];
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadNotify() {
  return await import("../notify.ts");
}

const baseInput = {
  sync_type: "catalog" as const,
  error_count: 2,
  errors: [
    { item: { phase: "getProduct", styleId: "PC61" }, message: "SanMar 999: timeout" },
    { item: { phase: "upsert", chunkStart: 0, chunkSize: 500 }, message: "duplicate key" },
  ],
  duration_ms: 4321,
};

describe("notifySyncFailure", () => {
  it("is a no-op when SANMAR_ALERT_WEBHOOK_URL is unset", async () => {
    // env override deliberately not set → Deno.env.get returns undefined
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { notifySyncFailure } = await loadNotify();

    await expect(notifySyncFailure(baseInput)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a Slack-compatible payload when the webhook returns 200", async () => {
    envOverrides.SANMAR_ALERT_WEBHOOK_URL = "https://hooks.slack.test/services/AAA/BBB/CCC";

    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { notifySyncFailure } = await loadNotify();

    await notifySyncFailure(baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.test/services/AAA/BBB/CCC");
    expect((init as RequestInit).method).toBe("POST");
    expect(((init as RequestInit).headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.text).toBe("🔴 SanMar sync FAILED: catalog");
    expect(Array.isArray(body.attachments)).toBe(true);
    expect(body.attachments[0].color).toBe("danger");
    const fields = body.attachments[0].fields as Array<{ title: string; value: string }>;
    const byTitle = Object.fromEntries(fields.map((f) => [f.title, f.value]));
    expect(byTitle.Errors).toBe("2");
    expect(byTitle.Duration).toBe("4321ms");
    expect(byTitle["First error"]).toContain("SanMar 999: timeout");
  });

  it("does not throw when the webhook returns 500", async () => {
    envOverrides.SANMAR_ALERT_WEBHOOK_URL = "https://hooks.slack.test/services/AAA/BBB/CCC";

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream exploded", { status: 500 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { notifySyncFailure } = await loadNotify();

    // The whole point: the sync run keeps going even when the receiver
    // is on fire. So this must resolve, not reject.
    await expect(notifySyncFailure(baseInput)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    // And critically the console.error must not contain the webhook URL
    // (it embeds an authz token in the path on Slack and Zapier).
    for (const call of errorSpy.mock.calls) {
      const joined = call.map((a) => String(a)).join(" ");
      expect(joined).not.toContain("hooks.slack.test");
      expect(joined).not.toContain("AAA/BBB/CCC");
    }
  });
});
