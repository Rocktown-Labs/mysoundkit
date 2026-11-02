/* eslint-disable require-await, one-var, sort-vars */
import { describe, expect, it, vi } from "vitest";

import { createAuthenticatedFetch } from "./authenticated-fetch-core";

const apiBaseUrl = "https://api.mysoundkit.test";
describe("native authenticated request transport", () => {
  it("preserves Request headers, body, method and abort signal", async () => {
    const request = new Request(`${apiBaseUrl}/v1/me/profile`, {
        body: JSON.stringify({ name: "fixture" }),
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "fixture",
        },
        method: "POST",
        signal: new AbortController().signal,
      }),
      transport = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const delivered = new Request(input, init);
          expect(delivered.method).toBe("POST");
          expect(delivered.headers.get("content-type")).toBe(
            "application/json"
          );
          expect(delivered.headers.get("x-request-id")).toBe("fixture");
          expect(delivered.headers.get("cookie")).toBe("session=fixture");
          expect(await delivered.json()).toEqual({ name: "fixture" });
          return new Response("ok");
        }
      ),
      authFetch = createAuthenticatedFetch({
        apiBaseUrl,
        fetchImpl: transport,
        getCookie: () => "session=fixture",
      });
    await authFetch(request);
    expect(transport).toHaveBeenCalledOnce();
  });
  it("forwards cancellation inherited from a Request", async () => {
    const abort = new AbortController(),
      request = new Request(`${apiBaseUrl}/v1/me`, { signal: abort.signal });
    abort.abort();
    const transport = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(new Request(input, init).signal.aborted).toBe(true);
        return new Response("ok");
      }
    );
    await createAuthenticatedFetch({
      apiBaseUrl,
      fetchImpl: transport,
      getCookie: () => null,
    })(request);
  });
  it("respects explicit header replacement while adding the API session", async () => {
    const transport = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("old")).toBeNull();
        expect(headers.get("new")).toBe("value");
        expect(headers.get("cookie")).toBe("session=fixture");
        return new Response("ok");
      }
    );
    await createAuthenticatedFetch({
      apiBaseUrl,
      fetchImpl: transport,
      getCookie: () => "session=fixture",
    })(new Request(`${apiBaseUrl}/v1/me`, { headers: { old: "value" } }), {
      headers: { new: "value" },
    });
  });
  it.each([
    "https://api.mysoundkit.test.attacker.test/v1/me",
    "https://cdn.example.test/audio",
    "http://api.mysoundkit.test/v1/me",
  ])("does not attach SoundKit credentials to %s", async (url) => {
    const cookie = vi.fn(() => "session=private"),
      transport = vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          expect(new Headers(init?.headers).has("cookie")).toBe(false);
          expect(init?.credentials).toBe("omit");
          return new Response("ok");
        }
      );
    await createAuthenticatedFetch({
      apiBaseUrl,
      fetchImpl: transport,
      getCookie: cookie,
    })(
      new Request(url, {
        credentials: "include",
        headers: { cookie: "session=private" },
      })
    );
    expect(cookie).not.toHaveBeenCalled();
  });
  it("lets the server return its normal response when credential storage fails", async () => {
    const transport = vi.fn(
        async () => new Response("unauthorized", { status: 401 })
      ),
      response = await createAuthenticatedFetch({
        apiBaseUrl,
        fetchImpl: transport,
        getCookie: () => {
          throw new Error("storage unavailable");
        },
      })(`${apiBaseUrl}/v1/me`);
    expect(response.status).toBe(401);
  });
});
