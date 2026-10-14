/**
 * Decides which URLs the desktop shell may render in its own window.
 *
 * The window is locked to the SoundKit origin and its subdomains (the
 * better-auth social sign-in flow redirects through the API origin), plus the
 * Google OAuth consent host. Every other destination — the bio site, artist
 * outbound links, `mailto:` — is handed to the system browser instead of
 * being blocked outright.
 */
export interface NavigationPolicyConfig {
  /** Canonical web app URL, e.g. https://mysoundkit.com */
  appUrl: string;
  /** Vite dev server origin in development, if a dev server is running. */
  devOrigin?: string | null;
  /** Extra hosts allowed for OAuth redirect chains. */
  oauthHosts?: readonly string[];
}

export interface NavigationPolicy {
  readonly appOrigin: string;
  isAllowedInWindow: (url: string) => boolean;
  canOpenExternally: (url: string) => boolean;
}

/* oxlint-disable eslint/one-var, eslint/sort-vars -- declarator order follows data dependencies and export adjacency. */

export const GOOGLE_OAUTH_HOSTS = ["accounts.google.com"] as const;

const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export const createNavigationPolicy = ({
  appUrl,
  devOrigin = null,
  oauthHosts = GOOGLE_OAUTH_HOSTS,
}: NavigationPolicyConfig): NavigationPolicy => {
  const appUrlParsed = new URL(appUrl),
    allowedExactOrigins = new Set<string>([
      appUrlParsed.origin,
      ...(devOrigin ? [new URL(devOrigin).origin] : []),
    ]),
    allowedHosts = new Set<string>(
      oauthHosts.map((host) => host.toLowerCase())
    ),
    appHost = appUrlParsed.hostname.toLowerCase(),
    appOrigin = appUrlParsed.origin,
    isAllowedHost = (host: string): boolean => {
      const normalizedHost = host.toLowerCase();

      return (
        normalizedHost === appHost ||
        normalizedHost.endsWith(`.${appHost}`) ||
        allowedHosts.has(normalizedHost)
      );
    };

  return {
    appOrigin,
    canOpenExternally: (url: string): boolean => {
      try {
        return EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
      } catch {
        return false;
      }
    },
    isAllowedInWindow: (url: string): boolean => {
      try {
        const parsed = new URL(url);

        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return false;
        }

        return (
          allowedExactOrigins.has(parsed.origin) ||
          isAllowedHost(parsed.hostname)
        );
      } catch {
        return false;
      }
    },
  };
};
