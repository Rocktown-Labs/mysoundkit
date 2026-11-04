import type { createDb } from "@soundkit/db";
import {
  projectCollaborators,
  projectTracks,
  trackCollaborators,
} from "@soundkit/db/schema/app";
import { and, eq } from "drizzle-orm";

/** Accepted track and project invitations confer the same playback authority. */
export const hasAcceptedTrackCollaboration = async ({
  db,
  trackId,
  userId,
}: {
  db: ReturnType<typeof createDb>;
  trackId: string;
  userId: string;
}): Promise<boolean> => {
  const directFilter = and(
      eq(trackCollaborators.trackId, trackId),
      eq(trackCollaborators.collaboratorUserId, userId),
      eq(trackCollaborators.invitationStatus, "accepted")
    ),
    projectFilter = and(
      eq(projectTracks.trackId, trackId),
      eq(projectCollaborators.collaboratorUserId, userId),
      eq(projectCollaborators.invitationStatus, "accepted")
    ),
    [direct, project] = await Promise.all([
      db
        .select({ id: trackCollaborators.id })
        .from(trackCollaborators)
        .where(directFilter)
        .limit(1),
      db
        .select({ id: projectCollaborators.id })
        .from(projectTracks)
        .innerJoin(
          projectCollaborators,
          eq(projectCollaborators.projectId, projectTracks.projectId)
        )
        .where(projectFilter)
        .limit(1),
    ]);
  return direct.length > 0 || project.length > 0;
};
