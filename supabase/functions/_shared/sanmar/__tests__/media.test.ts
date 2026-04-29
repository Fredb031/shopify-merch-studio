/**
 * Unit tests for the Media Content Service wrapper (media.ts).
 *
 * Coverage:
 *   - Single-image response: one URL, one description block, parsed end-to-end.
 *   - Multi-URL split: SanMar collapses N image URLs into a SINGLE
 *     newline-separated <url> tag. Wrapper splits on \r?\n.
 *   - Authenticates with SANMAR_MEDIA_PASSWORD (separate credential from
 *     SANMAR_PASSWORD). The fetch body must carry the media password.
 *   - Bilingual description regex parses the French
 *     ("Nom du produit = ..." / "Description du produit = ...") variant.
 *   - English-label fallback: the same regex parses the
 *     ("Product Name = ..." / "Product Description = ...") variant
 *     emitted on most styles.
 *   - SOAP Fault on a wrong-password response surfaces as SanmarApiError.
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
          // The media service uses a SEPARATE password — operators must
          // request it from SanMar EDI. Tests assert this value lands in
          // the request body (NOT the regular SANMAR_PASSWORD).
          SANMAR_MEDIA_PASSWORD: "test-media-pw",
          SANMAR_ENV: "UAT",
        };
        return map[k];
      },
    },
  };
});

const FIXTURES = join(__dirname, "fixtures");
const readFixture = (name: string) => readFileSync(join(FIXTURES, name), "utf-8");

async function loadMedia() {
  return await import("../media.ts");
}
async function loadClient() {
  return await import("../client.ts");
}

describe("media.getProductImages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a single-image MediaContent into one URL + structured fields", async () => {
    const { getProductImages } = await loadMedia();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("media-single-image.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const media = await getProductImages("PC54");

    expect(media.productId).toBe("PC54");
    expect(media.partId).toBe("PC54-NVY-M");
    expect(media.urls).toHaveLength(1);
    expect(media.urls[0]).toBe("https://cdn.sanmarcanada.com/images/PC54/primary.jpg");
    expect(media.changeTimeStamp).toBe("2026-02-10T12:00:00Z");
    // Description block parsed into structured fields.
    expect(media.productName).toBe("Port Authority Core Cotton Tee");
    expect(media.productDescription).toContain("100% cotton tee");
  });

  it("splits a newline-separated <url> field into multiple URLs", async () => {
    const { getProductImages } = await loadMedia();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("media-multi-url.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const media = await getProductImages("ATC1000");

    expect(media.urls).toHaveLength(4);
    expect(media.urls).toEqual([
      "https://cdn.sanmarcanada.com/images/ATC1000/primary.jpg",
      "https://cdn.sanmarcanada.com/images/ATC1000/back.jpg",
      "https://cdn.sanmarcanada.com/images/ATC1000/side.jpg",
      "https://cdn.sanmarcanada.com/images/ATC1000/detail.jpg",
    ]);
    // None of the split URLs should contain leftover newlines or whitespace.
    for (const u of media.urls) {
      expect(u).not.toMatch(/\s/);
      expect(u.startsWith("https://")).toBe(true);
    }
  });

  it("authenticates with SANMAR_MEDIA_PASSWORD, NOT SANMAR_PASSWORD", async () => {
    const { getProductImages } = await loadMedia();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(readFixture("media-single-image.xml"), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getProductImages("PC54");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(init.body);
    // Endpoint hits the v1.1 media service path.
    expect(String(url)).toContain("mediacontent1.1/MediaContentService.php");
    // The MEDIA password is what landed in the SOAP body...
    expect(body).toContain(">test-media-pw<");
    // ...and the regular password did NOT.
    expect(body).not.toContain(">test-pw<");
    // The SharedObjects-prefixed shape is preserved on the wire (the
    // upstream gateway validates the namespace prefix).
    expect(body).toContain("<shar:password>test-media-pw</shar:password>");
    expect(body).toContain("<shar:wsVersion>1.1.0</shar:wsVersion>");
    expect(body).toContain("<shar:mediaType>Image</shar:mediaType>");
    expect(body).toContain("<shar:classType>1006</shar:classType>");
  });

  it("parses the FRENCH bilingual description variant", async () => {
    // SanMar Canada emits a French label set on the bilingual feed:
    //   "Nom du produit = ..."          → productName
    //   "Description du produit = ..."  → productDescription
    const { getProductImages } = await loadMedia();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("media-multi-url.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const media = await getProductImages("ATC1000");

    expect(media.productName).toBe("T-shirt ATC EverydayCotton");
    expect(media.productDescription).toContain("coton de poids moyen");
    // Raw description still preserved for debugging.
    expect(media.description).toContain("Nom du produit");
    expect(media.description).toContain("Description du produit");
  });

  it("falls back to ENGLISH labels when no French labels are present", async () => {
    // Plain English-only payload: the same regex must populate productName
    // and productDescription. Description stays in the raw `description`
    // field too.
    const { getProductImages } = await loadMedia();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("media-single-image.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    const media = await getProductImages("PC54");

    // English labels populate the same structured fields as French.
    expect(media.productName).toBe("Port Authority Core Cotton Tee");
    expect(media.productDescription.length).toBeGreaterThan(0);
    expect(media.productDescription).toMatch(/cotton tee/i);
    // Raw description carries the English label tokens.
    expect(media.description).toContain("Product Name");
    expect(media.description).toContain("Product Description");
    // No French label tokens leaked through.
    expect(media.description).not.toContain("Nom du produit");
  });

  it("throws SanmarApiError on a SOAP Fault response", async () => {
    const { getProductImages } = await loadMedia();
    const { SanmarApiError } = await loadClient();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("media-error-fault.xml"), { status: 500 }),
    ) as unknown as typeof fetch;

    try {
      await getProductImages("BOGUS");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SanmarApiError);
      const err = e as InstanceType<typeof SanmarApiError>;
      expect(err.message).toMatch(/media password/i);
      expect(err.severity).toBe("Error");
    }
  });
});
