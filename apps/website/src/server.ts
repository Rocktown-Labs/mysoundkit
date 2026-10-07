import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

/**
 * Anonymous HTML edge cache. Public pages render the same HTML for every
 * signed-out visitor, but SSR re-renders them on each request (~0.5s TTFB of
 * origin work). Cacheable GET navigations without a session cookie are served
 * from the Workers Cache API instead, with a short TTL — logged-in users and
 * any request carrying a session cookie always render live.
 *
 * The Cloudflare runtime passes (request, env, ctx) to the module entry; the
 * TanStack server-entry type only declares the request, so the extra
 * arguments are typed structurally below.
 */

const SSR_CACHED_AT_HEADER = "x-soundkit-ssr-cached-at",
  SSR_CACHE_MAX_AGE_MS = 120_000,
  SSR_CACHE_STORE_CONTROL = "public, max-age=120",
  SSR_SESSION_COOKIE_PATTERN = /(?:^|;\s*)better-auth\.session_token=/u,
  isCacheableNavigation = (request: Request) =>
    request.method === "GET" &&
    (request.headers.get("accept") ?? "").includes("text/html") &&
    !request.headers.get("authorization") &&
    !SSR_SESSION_COOKIE_PATTERN.test(request.headers.get("cookie") ?? ""),

 edgeCache = (): Cache =>
  (caches as unknown as { default: Cache }).default,

 isCacheableHtmlResponse = (response: Response) =>
  response.status === 200 &&
  (response.headers.get("content-type") ?? "").includes("text/html"),

 buildStoredResponse = (response: Response) => {
  const stored = new Response(response.clone().body, {
    headers: new Headers(response.headers),
    status: response.status,
  });
  stored.headers.set("cache-control", SSR_CACHE_STORE_CONTROL);
  stored.headers.set(SSR_CACHED_AT_HEADER, String(Date.now()));
  return stored;
},

/** Cached copies keep the original header-less browser behavior for HTML. */
 buildServedResponse = (cached: Response) => {
  const cachedAt = Number(cached.headers.get(SSR_CACHED_AT_HEADER) || 0),
    served = new Response(cached.body, {
      headers: new Headers(cached.headers),
      status: cached.status,
    });
  served.headers.set("cache-control", "no-store");
  served.headers.set("age", String(Math.round((Date.now() - cachedAt) / 1000)));
  return served;
};

export default createServerEntry({
  fetch(request: Request, _environment?: unknown, executionContext?: unknown) {
    if (!isCacheableNavigation(request)) {
      return handler.fetch(request);
    }

    const cache = edgeCache(),
      // ctx.waitUntil lets the SSR response stream to the visitor while the
      // cached copy fills in the background. Harnesses without an execution
      // context simply skip caching (the promise would be cancelled anyway).
      waitUntil = (promise: Promise<unknown>) => {
        const context = executionContext as
          | { waitUntil?: (promise: Promise<unknown>) => void }
          | undefined;
        context?.waitUntil?.(promise);
      };

    return (async () => {
      const cached = await cache.match(request);
      if (cached) {
        const cachedAt = Number(cached.headers.get(SSR_CACHED_AT_HEADER) || 0);
        if (Date.now() - cachedAt < SSR_CACHE_MAX_AGE_MS) {
          return buildServedResponse(cached);
        }
      }

      const response = await handler.fetch(request);
      if (isCacheableHtmlResponse(response)) {
        waitUntil(
          (async () => {
            try {
              await cache.put(request, buildStoredResponse(response));
            } catch {
              // Responses carrying Set-Cookie (or otherwise uncacheable)
              // skip the cache — the visitor still gets the live render.
            }
          })()
        );
      }
      return response;
    })();
  },
});
