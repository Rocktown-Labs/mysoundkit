/* eslint-disable one-var, sort-vars */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { API_V1_URL } from "./api";
import type { BioCurrentUser } from "./api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null,
  stringValue = (value: unknown): string | null =>
    typeof value === "string" && value ? value : null;

/**
 * Resolves the signed-in user during SSR by forwarding the incoming
 * request's cookie/Authorization to the API. The raw /v1/me response never
 * reaches the browser, so anonymous visitors do not generate a browser-
 * logged 401 (which was the only errors-in-console failure on the bio).
 */
const resolveBioSessionUser = createServerFn({
  method: "GET",
}).handler(async (): Promise<BioCurrentUser | null> => {
  try {
    const headers = new Headers({ Accept: "application/json" });
    for (const headerName of ["authorization", "cookie"]) {
      const value = getRequestHeader(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    }

    const response = await fetch(`${API_V1_URL}/me`, { headers });
    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      return null;
    }
    const user = isRecord(payload.user) ? payload.user : payload;
    if (!isRecord(user)) {
      return null;
    }

    const id = stringValue(user.id);
    if (!id) {
      return null;
    }

    const accountType = user.accountType === "fan" ? "fan" : "artist",
      username =
        stringValue(user.username) ??
        stringValue(user.stageName)?.toLowerCase().replaceAll(/\s+/gu, "") ??
        "artist";

    return {
      accountType,
      avatarUrl: stringValue(user.avatarUrl),
      displayName:
        stringValue(user.displayName) ?? stringValue(user.name) ?? "Artist",
      email: stringValue(user.email),
      id,
      name: stringValue(user.name),
      username,
    };
  } catch {
    return null;
  }
});

/**
 * Used by the home route's loader so the public hero renders in the initial
 * HTML — resolving the session client-side made the hero appear after
 * hydration (0.36 CLS, and the browser logged 401s for anonymous visitors).
 */
export const resolveBioSessionUserId = createServerFn({
  method: "GET",
}).handler(async () => {
  const user = await resolveBioSessionUser();

  return user?.id ?? null;
});

/** Initial session state for the nav, resolved server-side without a 401. */
export const resolveBioNavSession = createServerFn({
  method: "GET",
}).handler(async () => {
  const user = await resolveBioSessionUser();

  return user ?? null;
});
