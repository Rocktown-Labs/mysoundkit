import { env } from "@soundkit/env/web";
import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";

import type { AppType } from "../../../server/src/rpc-contract";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlash(env.VITE_SERVER_URL);
export const API_V1_URL = `${API_BASE_URL}/v1`;
export const API_AUTH_URL = `${API_BASE_URL}/auth`;
export const MEDIA_BASE_URL = trimTrailingSlash(
  env.VITE_MEDIA_URL ?? API_BASE_URL.replace("://api.", "://media.")
);
export const MEDIA_UPLOAD_URL = `${API_V1_URL}/uploads/media`;
export const PROFILE_MEDIA_UPLOAD_URL = `${API_V1_URL}/uploads/profile-media`;
export const PROJECT_ASSETS_UPLOAD_URL = `${API_V1_URL}/uploads/project-assets`;
export const TRACK_SOURCE_UPLOAD_URL = `${API_V1_URL}/uploads/track-source`;

export const apiClient = hc<AppType>(API_BASE_URL, {
  init: {
    credentials: "include",
  },
});

export class SoundKitApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SoundKitApiError";
    this.status = status;
  }
}

export const rpcJson = async <T>(
  response: ClientResponse<T, number, "json">
): Promise<T> => {
  if (response.ok) {
    return response.json();
  }

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;

  throw new SoundKitApiError(
    payload?.message ?? `SoundKit API request failed: ${response.status}`,
    response.status
  );
};
