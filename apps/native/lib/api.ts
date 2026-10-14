import { env } from "@soundkit/env/native";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlash(env.EXPO_PUBLIC_SERVER_URL);
export const API_V1_URL = `${API_BASE_URL}/v1`;
export const API_AUTH_URL = `${API_BASE_URL}/auth`;
export const MEDIA_UPLOAD_URL = `${API_V1_URL}/uploads/media`;
/** Public website origin — used to host the Turnstile WebView bridge on an
 * approved hostname so siteverify's `hostname` check passes for the app. */
export const WEB_PUBLIC_URL = trimTrailingSlash(
  env.EXPO_PUBLIC_WEB_URL || "https://mysoundkit.com"
);
