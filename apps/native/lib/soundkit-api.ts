/* eslint-disable one-var */
import { useQuery } from "@tanstack/react-query";
import type { InferResponseType, ClientResponse } from "hono/client";
import { hc } from "hono/client";

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
  const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null,
    message =
      errorBody?.message ?? `SoundKit API request failed: ${response.status}`;
  throw new NativeApiError(message, response.status);
}

const PUBLIC_SCOPE = { scope: "public" } as const,
  artistsGet = apiClient.v1.artists.index.$get,
  battlesGet = apiClient.v1.battles.index.$get,
  genresGet = apiClient.v1.discover.genres.$get,
  listeningPartiesGet = apiClient.v1["listening-parties"].index.$get,
  publicLiveExperiencesGet = apiClient.v1.live.experiences.public.$get,
  publicProjectsGet = apiClient.v1.projects.public.$get,
  searchGet = apiClient.v1.search.$get,
  tracksGet = apiClient.v1.tracks.index.$get,
  videosGet = apiClient.v1.videos.index.$get;

export type TrackSummary = InferResponseType<typeof tracksGet, 200>[number];
export type VideoSummary = InferResponseType<typeof videosGet, 200>[number];
export type ProjectSummary = InferResponseType<
  typeof publicProjectsGet,
  200
>[number];
export type ArtistSummary = InferResponseType<typeof artistsGet, 200>[number];
export type BattleSummary = InferResponseType<typeof battlesGet, 200>[number];
export type LiveExperienceSummary = InferResponseType<
  typeof publicLiveExperiencesGet,
  200
>[number];
export type ListeningPartySummary = InferResponseType<
  typeof listeningPartiesGet,
  200
>[number];
export type GenreSummary = InferResponseType<typeof genresGet, 200>[number];

export interface DiscoverRegionQuery {
  region: string;
  regionType: "global" | "north-america";
}

export const useDiscoverTopSongsQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await tracksGet({
          query: {
            ...PUBLIC_SCOPE,
            limit: 10,
            region: region.region,
            regionType: region.regionType,
            sort: "plays-desc",
          },
        })
      ),
    queryKey: ["native", "discover", "top-songs", region],
  });

export const useDiscoverNewReleasesQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await tracksGet({
          query: {
            ...PUBLIC_SCOPE,
            limit: 10,
            region: region.region,
            regionType: region.regionType,
            sort: "date-desc",
          },
        })
      ),
    queryKey: ["native", "discover", "new-releases", region],
  });

export const useDiscoverTopArtistsQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await artistsGet({
          query: {
            category: "top",
            limit: 10,
            region: region.region,
            regionType: region.regionType,
            sort: "rank-asc",
          },
        })
      ),
    queryKey: ["native", "discover", "top-artists", region],
  });

export const useDiscoverVideosQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await videosGet({
          query: {
            ...PUBLIC_SCOPE,
            limit: 10,
            region: region.region,
            regionType: region.regionType,
          },
        })
      ),
    queryKey: ["native", "discover", "videos", region],
  });

export const useDiscoverProjectsQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await publicProjectsGet({
          query: {
            limit: 10,
            region: region.region,
            regionType: region.regionType,
            sort: "date-desc",
          },
        })
      ),
    queryKey: ["native", "discover", "projects", region],
  });

export const useDiscoverBattlesQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await battlesGet({
          query: {
            ...PUBLIC_SCOPE,
            limit: 10,
            region: region.region,
            regionType: region.regionType,
          },
        })
      ),
    queryKey: ["native", "discover", "battles", region],
  });

export const useDiscoverStreamsQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await publicLiveExperiencesGet({
          query: {
            ...PUBLIC_SCOPE,
            kind: "stream",
            region: region.region,
            regionType: region.regionType,
          },
        })
      ),
    queryKey: ["native", "discover", "streams", region],
  });

export const useDiscoverPartiesQuery = (region: DiscoverRegionQuery) =>
  useQuery({
    queryFn: async () =>
      rpcJson(
        await listeningPartiesGet({
          query: {
            ...PUBLIC_SCOPE,
            limit: 10,
            region: region.region,
            regionType: region.regionType,
          },
        })
      ),
    queryKey: ["native", "discover", "parties", region],
  });

export const useGenresQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await genresGet()),
    queryKey: ["native", "discover", "genres"],
  });

export type NativeSearchResult = InferResponseType<typeof searchGet, 200>;

export const useNativeSearchQuery = (q: string) =>
  useQuery({
    enabled: q.trim().length >= 2,
    queryFn: async () =>
      rpcJson(
        await searchGet({ query: { limit: "12", q: q.trim(), type: "all" } })
      ),
    queryKey: ["native", "search", q.trim()],
  });
