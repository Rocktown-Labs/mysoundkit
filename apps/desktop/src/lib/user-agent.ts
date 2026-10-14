/**
 * Google flags embedded browsers by the `Electron/x.y.z` and app-name tokens
 * in the User-Agent string and the `sec-ch-ua` client-hints header, which
 * breaks the site's "Sign in with Google" flow inside the desktop shell.
 * These helpers strip exactly those tokens so the consent screen sees an
 * ordinary Chromium browser. Every other request keeps the honest desktop
 * UA, which keeps site analytics accurate.
 */
/* oxlint-disable eslint/one-var -- the two exported helpers are separate statements by API design. */

const CLIENT_HINT_TOKEN_PATTERN =
    /,?\s*"(?:Electron|soundkit-desktop|desktop)";v="[^"]*"/giu,
  USER_AGENT_TOKEN_PATTERN =
    /\s+(?:Electron|soundkit-desktop|desktop)\/[\d.]+/giu;

export const stripDesktopTokensFromUserAgent = (userAgent: string): string =>
  userAgent.replace(USER_AGENT_TOKEN_PATTERN, "").trim();

export const stripDesktopTokensFromClientHints = (
  clientHints: string
): string =>
  clientHints
    .replace(CLIENT_HINT_TOKEN_PATTERN, "")
    .replace(/^[,\s]+/u, "")
    .trim();
