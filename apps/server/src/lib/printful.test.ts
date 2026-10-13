import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PrintfulNotConfiguredError,
  PrintfulRequestError,
  getPrintfulCatalogProduct,
  isPrintfulConfigured,
  printfulPriceToCents,
  printfulRequest,
  unwrapPrintfulList,
  unwrapPrintfulPayload,
} from "./printful";

const jsonResponse = (body: unknown, status = 200) =>
    Response.json(body, {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  rateLimitedResponse = (retryAfterSeconds: string) =>
    Response.json(
      {
        detail: "You've recently sent too many requests.",
        status: 429,
        title: "Too Many Requests",
      },
      {
        headers: {
          "Content-Type": "application/problem+json",
          "Retry-After": retryAfterSeconds,
        },
        status: 429,
      }
    );

describe("Printful v2 client", () => {
  const originalApiKey = process.env.PRINTFUL_API_KEY,
    originalFetch = globalThis.fetch,
    originalStoreId = process.env.PRINTFUL_STORE_ID;

  beforeEach(() => {
    process.env.PRINTFUL_API_KEY = "test-printful-token";
    process.env.PRINTFUL_STORE_ID = "42";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.PRINTFUL_API_KEY = originalApiKey;
    process.env.PRINTFUL_STORE_ID = originalStoreId;
  });

  it("reports configuration from the private token binding", () => {
    expect(isPrintfulConfigured()).toBe(true);

    process.env.PRINTFUL_API_KEY = "";
    expect(isPrintfulConfigured()).toBe(false);
  });

  it("refuses requests without a configured token", async () => {
    process.env.PRINTFUL_API_KEY = "";

    await expect(
      printfulRequest({ path: "/catalog-products/294" })
    ).rejects.toBeInstanceOf(PrintfulNotConfiguredError);
  });

  it("sends bearer auth and the store context header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 294, name: "Hoodie" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await printfulRequest({ path: "/catalog-products/294" });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://api.printful.com/v2/catalog-products/294"
    );
    expect((init.headers as Headers).get("Authorization")).toBe(
      "Bearer test-printful-token"
    );
    expect((init.headers as Headers).get("X-PF-Store-Id")).toBe("42");
  });

  it("omits the store header for store-level tokens", async () => {
    process.env.PRINTFUL_STORE_ID = "";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 294 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await printfulRequest({ path: "/catalog-products/294" });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Headers).get("X-PF-Store-Id")).toBeNull();
  });

  it("honors Retry-After and recovers from rate limits", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitedResponse("0"))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 9224 }] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await printfulRequest({
      path: "/catalog-products/294/catalog-variants",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(unwrapPrintfulList<typeof result>(result)).toEqual([{ id: 9224 }]);
  });

  it("fails fast on 404 with problem details", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          detail: "The resource that you tried to access does not exist.",
          instance: "abc-123",
          status: 404,
          title: "Not Found",
        },
        {
          headers: { "Content-Type": "application/problem+json" },
          status: 404,
        }
      )
    ) as unknown as typeof fetch;

    const error = await getPrintfulCatalogProduct(999_999).catch(
      (error: unknown) => error
    );

    expect(error).toBeInstanceOf(PrintfulRequestError);
    expect((error as PrintfulRequestError).status).toBe(404);
    expect((error as PrintfulRequestError).message).toContain("does not exist");
    expect((error as PrintfulRequestError).message).toContain("abc-123");
  });

  it("parses Printful price strings into integer cents", () => {
    expect(printfulPriceToCents("28.95")).toBe(2895);
    expect(printfulPriceToCents(9.99)).toBe(999);
    expect(() => printfulPriceToCents("not-a-price")).toThrow();
  });

  it("unwraps mixed direct and data-wrapped payload conventions", () => {
    expect(unwrapPrintfulPayload({ id: 294 })).toEqual({ id: 294 });
    expect(unwrapPrintfulPayload({ data: { id: 294 } })).toEqual({ id: 294 });
    expect(unwrapPrintfulList({ data: [1, 2] })).toEqual([1, 2]);
    expect(unwrapPrintfulList([3, 4])).toEqual([3, 4]);
  });
});
