export const DEFAULT_COLLABORATION_PROJECT_GENRE = "Hip-Hop/Rap",
  DEFAULT_COLLABORATION_PROJECT_TYPE = "ep" as const,
  resolveCollaborationProjectMetadata = ({
    genre,
    projectType,
  }: {
    genre?: string;
    projectType?: "album" | "ep" | "mixtape" | "single";
  }) => ({
    genre: genre?.trim() || DEFAULT_COLLABORATION_PROJECT_GENRE,
    projectType: projectType ?? DEFAULT_COLLABORATION_PROJECT_TYPE,
  });
