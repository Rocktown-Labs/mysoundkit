import { authClient } from "./auth-client";

/**
 * Fetch wrapper that attaches the better-auth session cookie. The Expo auth
 * client persists the session in SecureStore rather than the native cookie
 * jar, so plain `credentials: "include"` requests stay unauthenticated.
 */
export const authenticatedFetch: typeof fetch = async (input, init) => {
  const [request, options] = await Promise.all([
      Promise.resolve(input),
      Promise.resolve(init),
    ]),
    headers = new Headers(options?.headers);
  let cookie: string | null = null;
  try {
    cookie = await authClient.getCookie();
  } catch {
    cookie = null;
  }

  if (cookie && cookie.length > 0) {
    headers.set("cookie", cookie);
  }

  return fetch(request, { ...options, headers });
};
