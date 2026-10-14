export const DEEP_LINK_SCHEME = "soundkit";

/* oxlint-disable eslint/one-var, eslint/sort-vars -- declarator order follows data dependencies and export adjacency. */

const DEEP_LINK_PREFIX = `${DEEP_LINK_SCHEME}://`,
  MAX_DEEP_LINK_LENGTH = 2048,
  /**
   * Accepts unreserved characters, the reserved gen-delims/sub-delims that
   * legitimately appear in SoundKit routes, plus the query separator.
   * Anything percent-encoded or otherwise exotic is rejected — share links
   * are ASCII slugs, and a deep link should never widen the attack surface
   * of `loadURL`.
   */
  SAFE_DEEP_LINK_PATH_PATTERN = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/?]*$/u;

/**
 * Resolves a `soundkit://` deep link to a web app URL.
 *
 * Returns `null` for anything that is not a SoundKit deep link or does not
 * look like a safe in-app path. The native app already owns this scheme on
 * mobile; the desktop app registers it on desktop machines, where links
 * arrive via macOS `open-url` events and Windows/Linux second-instance argv.
 */
export const parseDeepLink = (
  rawUrl: string,
  appUrl: string
): string | null => {
  const rawPath = rawUrl.slice(DEEP_LINK_PREFIX.length).replace(/^\/+/u, ""),
    pathWithQuery = `/${rawPath}`,
    [pathWithoutQuery = ""] = pathWithQuery.split("?"),
    pathSegments = pathWithoutQuery.split("/");

  if (!rawUrl.startsWith(DEEP_LINK_PREFIX)) {
    return null;
  }

  if (rawUrl.length > MAX_DEEP_LINK_LENGTH) {
    return null;
  }

  if (rawPath.length === 0) {
    return appUrl;
  }

  if (!SAFE_DEEP_LINK_PATH_PATTERN.test(pathWithQuery)) {
    return null;
  }

  const hasTraversalSegment = pathSegments.some(
    (segment) => segment === "." || segment === ".."
  );

  if (hasTraversalSegment) {
    return null;
  }

  return `${appUrl}${pathWithQuery}`;
};
