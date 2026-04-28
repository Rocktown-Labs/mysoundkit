import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";

import { apiClient, rpcJson } from "./api";

const meGet = apiClient.v1.me.index.$get;
const artistOnboardingPost = apiClient.v1.onboarding.artist.$post;
const fanOnboardingPost = apiClient.v1.onboarding.fan.$post;
const tracksGet = apiClient.v1.tracks.index.$get;
const tracksPost = apiClient.v1.tracks.index.$post;
const trackGet = apiClient.v1.tracks[":trackId"].$get;
const trackPatch = apiClient.v1.tracks[":trackId"].$patch;
const trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post;
const trackProcessPost = apiClient.v1.tracks[":trackId"].process.$post;
const projectsGet = apiClient.v1.projects.index.$get;
const projectsPost = apiClient.v1.projects.index.$post;
const projectGet = apiClient.v1.projects[":projectId"].$get;
const projectPatch = apiClient.v1.projects[":projectId"].$patch;
const videosGet = apiClient.v1.videos.index.$get;
const videosPost = apiClient.v1.videos.index.$post;
const sellerStatusGet = apiClient.v1.seller.status.$get;

type ArtistOnboardingBody = InferRequestType<
  typeof artistOnboardingPost
>["json"];
type FanOnboardingBody = InferRequestType<typeof fanOnboardingPost>["json"];
export type TrackSummary = InferResponseType<typeof tracksGet, 200>[number];
type CreateTrackBody = InferRequestType<typeof tracksPost>["json"];
type UpdateTrackBody = InferRequestType<typeof trackPatch>["json"];
type CreateTrackAssetBody = InferRequestType<typeof trackAssetPost>["json"];
type TrackProcessingStatus = InferResponseType<typeof trackProcessPost, 200>;
type CreateProjectBody = InferRequestType<typeof projectsPost>["json"];
type UpdateProjectBody = InferRequestType<typeof projectPatch>["json"];
type CreateVideoBody = InferRequestType<typeof videosPost>["json"];
type SellerStatus = InferResponseType<typeof sellerStatusGet, 200>;

export const soundkitQueryKeys = {
  billingPlans: ["billing", "plans"] as const,
  me: ["me"] as const,
  project: (id: string) => ["projects", id] as const,
  projects: ["projects"] as const,
  sellerStatus: ["seller", "status"] as const,
  track: (id: string) => ["tracks", id] as const,
  tracks: ["tracks"] as const,
  videos: ["videos"] as const,
};

export const useMeQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await meGet()),
    queryKey: soundkitQueryKeys.me,
  });

export const useArtistOnboardingMutation = () =>
  useMutation({
    mutationFn: async (body: ArtistOnboardingBody) =>
      rpcJson(await artistOnboardingPost({ json: body })),
  });

export const useFanOnboardingMutation = () =>
  useMutation({
    mutationFn: async (body: FanOnboardingBody) =>
      rpcJson(await fanOnboardingPost({ json: body })),
  });

export const useTracksQuery = (initialData?: TrackSummary[]) =>
  useQuery({
    initialData,
    queryFn: async () => rpcJson(await tracksGet()),
    queryKey: soundkitQueryKeys.tracks,
  });

export const useTrackQuery = (trackId: string) =>
  useQuery({
    enabled: Boolean(trackId),
    queryFn: async () => rpcJson(await trackGet({ param: { trackId } })),
    queryKey: soundkitQueryKeys.track(trackId),
  });

export const useCreateTrackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateTrackBody) =>
      rpcJson(await tracksPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.tracks }),
  });
};

export const useUpdateTrackMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateTrackBody) =>
      rpcJson(await trackPatch({ json: body, param: { trackId } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.tracks });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      });
    },
  });
};

export const useCreateTrackAssetMutation = (trackId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateTrackAssetBody) =>
      rpcJson(await trackAssetPost({ json: body, param: { trackId } })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      }),
  });
};

export const useProcessTrackMutation = (trackId: string) =>
  useMutation({
    mutationFn: async (): Promise<TrackProcessingStatus> =>
      rpcJson(await trackProcessPost({ param: { trackId } })),
  });

export const useProjectsQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await projectsGet()),
    queryKey: soundkitQueryKeys.projects,
  });

export const useProjectQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryFn: async () => rpcJson(await projectGet({ param: { projectId } })),
    queryKey: soundkitQueryKeys.project(projectId),
  });

export const useCreateProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateProjectBody) =>
      rpcJson(await projectsPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.projects }),
  });
};

export const useUpdateProjectMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateProjectBody) =>
      rpcJson(await projectPatch({ json: body, param: { projectId } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.projects });
      queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.project(projectId),
      });
    },
  });
};

export const useVideosQuery = () =>
  useQuery({
    queryFn: async () => rpcJson(await videosGet()),
    queryKey: soundkitQueryKeys.videos,
  });

export const useCreateVideoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateVideoBody) =>
      rpcJson(await videosPost({ json: body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.videos }),
  });
};

export const useSellerStatusQuery = () =>
  useQuery({
    queryFn: async (): Promise<SellerStatus> =>
      rpcJson(await sellerStatusGet()),
    queryKey: soundkitQueryKeys.sellerStatus,
  });
