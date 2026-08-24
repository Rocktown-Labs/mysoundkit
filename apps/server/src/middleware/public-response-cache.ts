/* eslint-disable one-var, sort-vars, node/callback-return */
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "@/lib/types";

const PUBLIC_CACHE_STALE_SECONDS = 300,
  PUBLIC_CACHE_TTL_SECONDS = 60,
  publicListPaths = new Set([
    "/v1/artists",
    "/v1/discover/genres",
    "/v1/projects/public",
    "/v1/videos",
  ]),
  normalizePath = (pathname: string): string =>
    pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname;

export const isPublicCacheRequest = (request: Request): boolean => {
  if (request.method !== "GET" || request.headers.has("authorization")) {
    return false;
  }

  const url = new URL(request.url),
    pathname = normalizePath(url.pathname);

  if (pathname === "/v1/tracks") {
    return url.searchParams.get("scope") === "public";
  }

  if (!publicListPaths.has(pathname)) {
    return false;
  }

  return url.searchParams.get("scope") !== "dashboard";
};

export const publicCacheKey = (request: Request): Request => {
  const url = new URL(request.url),
    sortedParams = [...url.searchParams.entries()].toSorted(
      ([firstKey, firstValue], [secondKey, secondValue]) =>
        firstKey.localeCompare(secondKey) ||
        firstValue.localeCompare(secondValue)
    );
  url.search = "";
  for (const [key, value] of sortedParams) {
    url.searchParams.append(key, value);
  }

  return new Request(url, { method: "GET" });
};

const cacheControl = `public, max-age=0, s-maxage=${PUBLIC_CACHE_TTL_SECONDS}, stale-while-revalidate=${PUBLIC_CACHE_STALE_SECONDS}`;

export const publicResponseCache = createMiddleware<AppEnv>(async (c, next) => {
  if (!isPublicCacheRequest(c.req.raw) || !("caches" in globalThis)) {
    await next();
    return;
  }

  const key = publicCacheKey(c.req.raw),
    cache = caches.default,
    cached = await cache.match(key);

  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-SoundKit-Cache", "HIT");
    return new Response(cached.body, {
      headers,
      status: cached.status,
      statusText: cached.statusText,
    });
  }

  await next();

  const response = c.res,
    hasSetCookie = response.headers.has("set-cookie");
  if (response.status !== 200 || hasSetCookie) {
    response.headers.set("X-SoundKit-Cache", "BYPASS");
    return;
  }

  const browserHeaders = new Headers(response.headers),
    storedHeaders = new Headers(response.headers);
  browserHeaders.set("Cache-Control", cacheControl);
  browserHeaders.set("X-SoundKit-Cache", "MISS");
  storedHeaders.set("Cache-Control", cacheControl);
  storedHeaders.delete("Access-Control-Allow-Credentials");
  storedHeaders.delete("Access-Control-Allow-Origin");
  storedHeaders.delete("Vary");
  storedHeaders.set("X-SoundKit-Cache", "HIT");

  const responseForCache = new Response(response.clone().body, {
    headers: storedHeaders,
    status: response.status,
    statusText: response.statusText,
  });
  c.res = new Response(response.body, {
    headers: browserHeaders,
    status: response.status,
    statusText: response.statusText,
  });
  c.executionCtx.waitUntil(cache.put(key, responseForCache));
});
