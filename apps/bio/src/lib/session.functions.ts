/* eslint-disable one-var, sort-vars */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { API_V1_URL } from "./api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Resolves the signed-in user during SSR by forwarding the incoming
 * request's cookie/Authorization to the API. Used by the home route's
 * loader so the public hero renders in the initial HTML — resolving the
 * session client-side made the hero appear after hydration (0.36 CLS, and
 * the browser logged 401s for anonymous visitors).
 */
export const resolveBioSessionUserId = createServerFn({
  method: "GET",
}).handler(async () => {
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
    const { user } = payload;
    if (!isRecord(user) || typeof user.id !== "string") {
      return null;
    }
    return user.id;
  } catch {
    return null;
  }
});
