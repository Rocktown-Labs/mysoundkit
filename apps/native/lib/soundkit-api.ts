import { useQuery } from "@tanstack/react-query";
import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";

import type { AppType } from "../../server/src/rpc-contract";
import { API_BASE_URL } from "./api";

export const apiClient = hc<AppType>(API_BASE_URL, {
  init: { credentials: "include" },
});

class NativeApiError extends Error {
  public status: number;

  public constructor(message: string, status: number) {
    super(message);
    this.name = "NativeApiError";
    this.status = status;
  }
}

function rpcJson<T>(response: ClientResponse<T, number, "json">): Promise<T>;
function rpcJson(
  response: Pick<Response, "json" | "ok" | "status">
): Promise<unknown>;
async function rpcJson<T>(
  response: Pick<Response, "json" | "ok" | "status">
): Promise<T> {
  if (response.ok) {
    return response.json();
  }
  const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null,
    message =
      payload?.message ?? `SoundKit API request failed: ${response.status}`;
  throw new NativeApiError(
    message,
    response.status
  );
}

export const useExploreTracksQuery = () =>
  useQuery({
    queryFn: async () =>
      rpcJson(await apiClient.v1.tracks.index.$get({ query: { limit: 8 } })),
    queryKey: ["native", "explore", "tracks"],
  });
