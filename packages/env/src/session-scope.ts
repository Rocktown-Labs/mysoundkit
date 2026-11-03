/* oxlint-disable one-var, sort-vars -- Early returns keep environment boundaries explicit. */
/** Match only our isolated API domains; production cookie names remain stable. */
const isolatedScopeFromUrl = (url: URL) => {
  if (url.protocol !== "https:" || url.port) {
    return null;
  }
  if (url.hostname === "api.staging.soundkit.bio") {
    return { cookiePrefix: "soundkit-staging", domain: "staging.soundkit.bio" };
  }
  const preview = /^api\.(?<stage>pr-[1-9]\d*)\.preview\.soundkit\.bio$/u.exec(
    url.hostname
  );
  return preview
    ? {
        cookiePrefix: `soundkit-${preview.groups?.stage}`,
        domain: `${preview.groups?.stage}.preview.soundkit.bio`,
      }
    : null;
};

const parseApiUrl = (apiUrl: string) => {
  try {
    const url = new URL(apiUrl);
    return ["https:", "http:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

export const isolatedSessionScope = (apiUrl: string) => {
  const url = parseApiUrl(apiUrl);
  return url ? isolatedScopeFromUrl(url) : null;
};

export const nativeSessionScope = (apiUrl: string, scheme: string) => {
  const url = parseApiUrl(apiUrl);
  if (!url) {
    throw new Error("Invalid SoundKit API URL configuration");
  }
  const isolated = isolatedScopeFromUrl(url);
  if (url.origin === "https://api.mysoundkit.com") {
    return { cookiePrefix: "better-auth", storagePrefix: scheme };
  }
  // Hex preserves the entire origin without collisions and uses only characters
  // accepted by Expo SecureStore. Paths do not define different environments.
  const originKey = Array.from(url.origin, (character) =>
    (character.codePointAt(0) ?? 0).toString(16).padStart(2, "0")
  ).join("");
  return {
    cookiePrefix: isolated?.cookiePrefix ?? "better-auth",
    storagePrefix: `${scheme}.env.${originKey}`,
  };
};
