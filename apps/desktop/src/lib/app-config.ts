export const DEFAULT_APP_URL = "https://mysoundkit.com";

/* oxlint-disable eslint/one-var, eslint/sort-vars -- declarator order follows data dependencies and export adjacency. */

const HTTP_URL_PATTERN = /^https?:\/\//u;

/**
 * Normalizes the configured SoundKit web app URL.
 *
 * The desktop shell runs the production website, so this URL is the entire
 * product surface. It must be an absolute http(s) URL; anything else is a
 * configuration error we want to surface at startup rather than a blank
 * window at runtime.
 */
export const resolveAppUrl = (rawUrl?: string | undefined): string => {
  const candidateUrl = (rawUrl ?? "").trim() || DEFAULT_APP_URL;

  if (!HTTP_URL_PATTERN.test(candidateUrl)) {
    throw new Error(
      `SOUNDKIT_APP_URL must be an http(s) URL, received: ${candidateUrl}`
    );
  }

  return candidateUrl.replace(/\/+$/u, "");
};
