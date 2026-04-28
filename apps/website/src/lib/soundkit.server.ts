import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";

import { API_BASE_URL } from "@/lib/api";

import type { AppType } from "../../../server/src/rpc-contract";

export class SoundKitServerError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SoundKitServerError";
    this.status = status;
  }
}

export const createSoundKitServerClient = (cookie: string | null) =>
  hc<AppType>(API_BASE_URL, {
    headers: (): Record<string, string> => {
      if (!cookie) {
        return {};
      }

      return { cookie };
    },
  });

export const soundkitServerJson = async <T>(
  response: ClientResponse<T, number, "json">
): Promise<T> => {
  if (response.ok) {
    return response.json();
  }

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;

  throw new SoundKitServerError(
    payload?.message ?? `SoundKit API request failed: ${response.status}`,
    response.status
  );
};
