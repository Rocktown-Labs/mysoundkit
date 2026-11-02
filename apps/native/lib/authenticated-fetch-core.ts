export function createAuthenticatedFetch({
  apiBaseUrl,
  getCookie,
  fetchImpl,
}: {
  apiBaseUrl: string;
  getCookie: () =>
    | string
    | null
    | undefined
    | Promise<string | null | undefined>;
  fetchImpl: typeof fetch;
}): typeof fetch {
  const apiOrigin = new URL(apiBaseUrl).origin;
  return async (input, init) => {
    const request =
      typeof Request !== "undefined" && input instanceof Request ? input : null,
     headers = new Headers(init?.headers ?? request?.headers),
     url = request?.url ?? String(input);
    let isApi = false;
    try {
      isApi = new URL(url, apiBaseUrl).origin === apiOrigin;
    } catch {
      /* Invalid targets never receive credentials. */
    }
    if (isApi) {
      try {
        const cookie = await getCookie();
        if (cookie) {headers.set("cookie", cookie);}
      } catch {
        /* The API can return its normal unauthenticated response. */
      }
    } else {
      headers.delete("cookie");
    }
    return await fetchImpl(input, { ...init, headers });
  };
}
