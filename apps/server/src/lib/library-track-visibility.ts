import {
  purchases,
  projectTracks,
  projectCollaborators,
  trackCollaborators,
  tracks,
} from "@soundkit/db/schema/app";
import { and, eq, exists, isNull, or, sql } from "drizzle-orm";

export const readableTrack = (userId?: string) => {
  const publicTrack = and(eq(tracks.isPublic, true), isNull(tracks.deletedAt));
  if (!userId) {
    return publicTrack;
  }
  return or(
    publicTrack,
    and(eq(tracks.ownerUserId, userId), isNull(tracks.deletedAt)),
    exists(
      sql`(select 1 from ${purchases} where ${purchases.buyerUserId} = ${userId} and ${purchases.trackId} = ${tracks.id})`
    ),
    exists(
      sql`(select 1 from ${purchases} inner join ${projectTracks} on ${projectTracks.projectId} = ${purchases.projectId} where ${purchases.buyerUserId} = ${userId} and ${projectTracks.trackId} = ${tracks.id})`
    ),
    and(
      isNull(tracks.deletedAt),
      or(
        exists(
          sql`(select 1 from ${trackCollaborators} where ${trackCollaborators.trackId} = ${tracks.id} and ${trackCollaborators.collaboratorUserId} = ${userId} and ${trackCollaborators.invitationStatus} = 'accepted')`
        ),
        exists(
          sql`(select 1 from ${projectTracks} inner join ${projectCollaborators} on ${projectCollaborators.projectId} = ${projectTracks.projectId} where ${projectTracks.trackId} = ${tracks.id} and ${projectCollaborators.collaboratorUserId} = ${userId} and ${projectCollaborators.invitationStatus} = 'accepted')`
        )
      )
    )
  );
};
