/* oxlint-disable one-var */

export const PROJECT_LIBRARY_KINDS = ["concept", "beat", "master"] as const;

export type ProjectLibraryKind = (typeof PROJECT_LIBRARY_KINDS)[number];

export interface ProjectLibraryTrack {
  catalogItemType?: "single" | "album" | "ep" | "beat" | "instrumental";
  fileAvailability?: {
    master: boolean;
  };
  isPublic?: boolean;
  masterDownloadUrl?: string | null;
}

export const projectLibraryKindLabels: Record<ProjectLibraryKind, string> = {
  beat: "Beat",
  concept: "Concept",
  master: "Master",
};

export const projectLibraryKindDescriptions: Record<
  ProjectLibraryKind,
  string
> = {
  beat: "Beat uploads from your library",
  concept: "Private or draft track uploads",
  master: "Masters from your uploaded releases",
};

export const hasUploadedMaster = (track: ProjectLibraryTrack) =>
  Boolean(track.masterDownloadUrl) || track.fileAvailability?.master === true;

export const isTrackForProjectLibraryKind = (
  track: ProjectLibraryTrack,
  kind: ProjectLibraryKind
) => {
  if (!hasUploadedMaster(track)) {
    return false;
  }

  if (kind === "master") {
    return true;
  }

  if (kind === "beat") {
    return track.catalogItemType === "beat";
  }

  return (
    track.catalogItemType !== "beat" &&
    track.catalogItemType !== "instrumental" &&
    track.isPublic !== true
  );
};
