import { API_BASE_URL } from "./api";
import { authClient } from "./auth-client";
import { createAuthenticatedFetch } from "./authenticated-fetch-core";

// SecureStore-backed sessions do not live in the native fetch cookie jar.
export const authenticatedFetch = createAuthenticatedFetch({
  apiBaseUrl: API_BASE_URL,
  fetchImpl: fetch,
  getCookie: () => authClient.getCookie(),
});
