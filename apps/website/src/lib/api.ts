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

const fileNameFromContentDisposition = (value: string | null) => {
  if (!value) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/iu.exec(value);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = /filename="([^"]+)"/iu.exec(value);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const bareMatch = /filename=([^;]+)/iu.exec(value);
  return bareMatch?.[1]?.trim() ?? null;
};

export const downloadFileFromApi = async ({
  fallbackFileName,
  url,
}: {
  fallbackFileName: string;
  url: string;
}) => {
  const href = url.startsWith("http") ? url : `${API_BASE_URL}${url}`,
    response = await fetch(href, { credentials: "include" });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

    throw new SoundKitApiError(
      payload?.message ?? `Download failed: ${response.status}`,
      response.status
    );
  }

  const blob = await response.blob(),
    objectUrl = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download =
    fileNameFromContentDisposition(
      response.headers.get("Content-Disposition")
    ) ?? fallbackFileName;
  anchor.rel = "noopener noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};
