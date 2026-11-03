/* oxlint-disable one-var, sort-vars -- Early returns keep environment boundaries explicit. */
/** Match only our isolated API domains; production cookie names remain stable. */
export const isolatedSessionScope = (apiUrl: string) => {
  const url = new URL(apiUrl);
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

export const nativeSessionScope = (apiUrl: string, scheme: string) => {
  const url = new URL(apiUrl),
    isolated = isolatedSessionScope(apiUrl);
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
