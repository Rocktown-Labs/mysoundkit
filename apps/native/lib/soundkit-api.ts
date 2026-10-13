import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { hc } from "hono/client";
import type {
  ClientResponse,
  InferRequestType,
  InferResponseType,
} from "hono/client";

import type { AppType } from "../../server/src/rpc-contract";
import { API_BASE_URL } from "./api";

export const apiClient = hc<AppType>(API_BASE_URL, {
  init: { credentials: "include" },
});

export class NativeApiError extends Error {
  public status: number;

  public constructor(message: string, status: number) {
    super(message);
    this.name = "NativeApiError";
    this.status = status;
  }
}

async function rpcJson<T>(
  response: ClientResponse<T, number, "json">
): Promise<T>;
async function rpcJson(
  response: Pick<Response, "json" | "ok" | "status">
): Promise<unknown>;
async function rpcJson<T>(
  response: Pick<Response, "json" | "ok" | "status">
): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }
  const errorPayload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null,
    message =
      errorPayload?.message ?? `SoundKit API request failed: ${response.status}`;
  throw new NativeApiError(message, response.status);
}

// ---------------------------------------------------------------------------
// Endpoint handles (bound once so the RPC client infers request/response types)
// ---------------------------------------------------------------------------

const artistGet = apiClient.v1.artists[":username"].$get,
  artistMediaGet = apiClient.v1.artists[":username"].media.$get,
  artistsGet = apiClient.v1.artists.index.$get,
  battleGet = apiClient.v1.battles[":battleId"].$get,
  battlesGet = apiClient.v1.battles.index.$get,
  genresGet = apiClient.v1.discover.genres.$get,
  listeningPartiesGet = apiClient.v1["listening-parties"].index.$get,
  liveExperienceGet = apiClient.v1.live.experiences[":experienceId"].$get,
  liveExperiencesGet = apiClient.v1.live.experiences.public.$get,
  publicProjectGet = apiClient.v1.projects.public[":projectId"].$get,
  publicProjectsGet = apiClient.v1.projects.public.$get,
  trackGet = apiClient.v1.tracks[":trackId"].$get,
  tracksGet = apiClient.v1.tracks.index.$get,
  videoGet = apiClient.v1.videos[":videoId"].$get,
  videosGet = apiClient.v1.videos.index.$get;

// ---------------------------------------------------------------------------
// Types (inferred from the canonical Hono RPC contract)
// ---------------------------------------------------------------------------

type TracksQuery = InferRequestType<typeof tracksGet>["query"];
type VideosQuery = InferRequestType<typeof videosGet>["query"];
type PublicProjectsQuery = InferRequestType<typeof publicProjectsGet>["query"];
type ArtistsQuery = InferRequestType<typeof artistsGet>["query"];
type PublicRegionQuery = InferRequestType<typeof liveExperiencesGet>["query"];

export type TrackSummary = InferResponseType<typeof tracksGet, 200>[number];
export type TrackDetail = InferResponseType<typeof trackGet, 200>;
export type VideoSummary = InferResponseType<typeof videosGet, 200>[number];
export type VideoDetail = InferResponseType<typeof videoGet, 200>;
export type ProjectSummary = PublicProjectSummary;
export type PublicProjectSummary = InferResponseType<
  typeof publicProjectsGet,
  200
>[number];
export type PublicProjectDetail = InferResponseType<
  typeof publicProjectGet,
  200
>;
export type ArtistSummary = InferResponseType<typeof artistsGet, 200>[number];
export type ArtistDetail = InferResponseType<typeof artistGet, 200>;
export type ArtistMedia = InferResponseType<typeof artistMediaGet, 200>;
export type BattleSummary = InferResponseType<typeof battlesGet, 200>[number];
export type BattleDetail = InferResponseType<typeof battleGet, 200>;
export type LiveExperienceSummary = InferResponseType<
  typeof liveExperiencesGet,
  200
>[number];
export type LiveExperienceDetail = InferResponseType<
  typeof liveExperienceGet,
  200
>;
export type ListeningPartySummary = InferResponseType<
  typeof listeningPartiesGet,
  200
>[number];
export type GenreSummary = InferResponseType<typeof genresGet, 200>[number];

export type {
  TracksQuery,
  VideosQuery,
  PublicProjectsQuery,
  ArtistsQuery,
  PublicRegionQuery,
};

// ---------------------------------------------------------------------------
// URL resolution: the API returns relative asset paths ("/v1/...", "/media/...")
// for some fields and absolute URLs for others.
// ---------------------------------------------------------------------------

export const resolveApiUrl = (url?: null | string): null | string => {
  if (!url) {
    return null;
  }
  if (/^https?:\/\//u.test(url)) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const listKey = (scope: string, query: Record<string, unknown>) => [
    scope,
    pageKey(query),
  ],
  pageKey = (query: Record<string, unknown>) => {
    const { page, ...rest } = query;
    return [rest, page ?? 1] as const;
  };

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const useTracksQuery = (query: TracksQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => rpcJson(await tracksGet({ query })),
    queryKey: listKey("tracks", query),
  });

export const useTracksInfiniteQuery = (query: TracksQuery) => {
  const pageSize = Number(query.limit ?? 24);

  return useInfiniteQuery({
    getNextPageParam: (
      lastPage: TrackSummary[],
      allPages: TrackSummary[][]
    ) => {
      if (lastPage.length < pageSize) {
        return;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) =>
      rpcJson(await tracksGet({ query: { ...query, page: pageParam } })),
    queryKey: [...listKey("tracks", query), "infinite"],
  });
};

export const useTrackQuery = (trackId: string) =>
  useQuery({
    enabled: trackId.length > 0,
    queryFn: async () =>
      rpcJson(await trackGet({ param: { trackId } })) as Promise<TrackDetail>,
    queryKey: ["track", trackId],
  });

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

export const useVideosQuery = (query: VideosQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => rpcJson(await videosGet({ query })),
    queryKey: listKey("videos", query),
  });

export const useVideoQuery = (videoId: string) =>
  useQuery({
    enabled: videoId.length > 0,
    queryFn: async () =>
      rpcJson(await videoGet({ param: { videoId } })) as Promise<VideoDetail>,
    queryKey: ["video", videoId],
  });

// ---------------------------------------------------------------------------
// Public projects
// ---------------------------------------------------------------------------

export const usePublicProjectsQuery = (query: PublicProjectsQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => rpcJson(await publicProjectsGet({ query })),
    queryKey: listKey("projects", query),
  });

export const usePublicProjectQuery = (projectId: string) =>
  useQuery({
    enabled: projectId.length > 0,
    queryFn: async () =>
      rpcJson(
        await publicProjectGet({ param: { projectId } })
      ) as Promise<PublicProjectDetail>,
    queryKey: ["project", projectId],
  });

// ---------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------

export const useArtistsQuery = (query: ArtistsQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => rpcJson(await artistsGet({ query })),
    queryKey: listKey("artists", query),
  });

export const useArtistsInfiniteQuery = (query: ArtistsQuery) => {
  const pageSize = Number(query.limit ?? 24);

  return useInfiniteQuery({
    getNextPageParam: (
      lastPage: ArtistSummary[],
      allPages: ArtistSummary[][]
    ) => {
      if (lastPage.length < pageSize) {
        return;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) =>
      rpcJson(await artistsGet({ query: { ...query, page: pageParam } })),
    queryKey: [...listKey("artists", query), "infinite"],
  });
};

export const useArtistQuery = (username: string) =>
  useQuery({
    enabled: username.length > 0,
    queryFn: async () =>
      rpcJson(
        await artistGet({ param: { username } })
      ) as Promise<ArtistDetail>,
    queryKey: ["artist", username],
  });

export const useArtistMediaQuery = (username: string) =>
  useQuery({
    enabled: username.length > 0,
    queryFn: async () =>
      rpcJson(
        await artistMediaGet({ param: { username } })
      ) as Promise<ArtistMedia>,
    queryKey: ["artist", username, "media"],
  });

// ---------------------------------------------------------------------------
// Live: battles, streams, listening parties, genres
// ---------------------------------------------------------------------------

export const useBattlesQuery = (query: PublicRegionQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => rpcJson(await battlesGet({ query })),
    queryKey: listKey("battles", query),
    refetchInterval: 15_000,
  });

export const useBattleQuery = (battleId: string) =>
  useQuery({
    enabled: battleId.length > 0,
    queryFn: async () =>
      rpcJson(
        await battleGet({ param: { battleId } })
      ) as Promise<BattleDetail>,
    queryKey: ["battle", battleId],
  });

export const useLiveExperienceQuery = (experienceId: string) =>
  useQuery({
    enabled: experienceId.length > 0,
    queryFn: async () =>
      rpcJson(
        await liveExperienceGet({ param: { experienceId } })
      ) as Promise<LiveExperienceDetail>,
    queryKey: ["live-experience", experienceId],
  });

export const usePublicLiveExperiencesQuery = (
  kind: "party" | "stream",
  query: PublicRegionQuery
) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () =>
      rpcJson(await liveExperiencesGet({ query: { kind, ...query } })),
    queryKey: [...listKey("live-experiences", query), kind],
    refetchInterval: 10_000,
  });

export const useListeningPartiesQuery = (query: PublicRegionQuery) =>
  useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => rpcJson(await listeningPartiesGet({ query })),
    queryKey: listKey("listening-parties", query),
  }),
  /** Party detail is served through the list endpoint; select by id. */
  useListeningPartyQuery = (partyId: string) =>
    useQuery({
      enabled: partyId.length > 0,
      queryFn: async () => {
        const parties = (await rpcJson(
            await listeningPartiesGet({
              query: { region: "all", regionType: "global" },
            })
          )) as ListeningPartySummary[],
          party = parties.find((entry) => entry.id === partyId);
        if (party === undefined) {
          throw new NativeApiError("Listening party not found", 404);
        }
        return party;
      },
      queryKey: ["listening-party", partyId],
    }),
  useGenresQuery = () =>
    useQuery({
      queryFn: async () =>
        rpcJson(await genresGet({})) as Promise<GenreSummary[]>,
      queryKey: ["genres"],
      staleTime: 60 * 60 * 1000,
    });

/* --- Discover redesign hooks (five public tabs) --- */

const PUBLIC_SCOPE = { scope: "public" } as const,
  searchGet = apiClient.v1.search.$get;

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
        await liveExperiencesGet({
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
