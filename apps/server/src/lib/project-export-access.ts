import { createDb } from "@soundkit/db";
import {
  projectTracks,
  projects,
  trackAssets,
  tracks,
} from "@soundkit/db/schema/app";
import { member } from "@soundkit/db/schema/auth";
import { and, eq } from "drizzle-orm";

export interface ProjectSourceAuthority {
  deletedAt: Date | null;
  hasOrganizationMembership: boolean;
  projectOrganizationId: string | null;
  projectOwnerUserId: string;
  trackOrganizationId: string | null;
  trackOwnerUserId: string;
}

export const isAuthorizedProjectSource = (
  source: ProjectSourceAuthority
): boolean =>
  !source.deletedAt &&
  (source.trackOwnerUserId === source.projectOwnerUserId ||
    (source.hasOrganizationMembership &&
      source.projectOrganizationId !== null &&
      source.trackOrganizationId === source.projectOrganizationId));

/** Recheck the original source, including for exports generated before this policy existed. */
export async function isProjectExportSourceAuthorized({
  projectId,
  sourceAssetId,
  sourceObjectKey,
}: {
  projectId: string;
  sourceAssetId: string | null;
  sourceObjectKey?: string;
}): Promise<boolean> {
  if (!sourceAssetId) {
    return false;
  }

  const [source] = await createDb()
    .select({
      deletedAt: tracks.deletedAt,
      memberId: member.id,
      objectKey: trackAssets.objectKey,
      projectOrganizationId: projects.organizationId,
      projectOwnerUserId: projects.ownerUserId,
      status: trackAssets.status,
      trackOrganizationId: tracks.organizationId,
      trackOwnerUserId: tracks.ownerUserId,
    })
    .from(projects)
    .innerJoin(projectTracks, eq(projectTracks.projectId, projects.id))
    .innerJoin(tracks, eq(tracks.id, projectTracks.trackId))
    .innerJoin(trackAssets, eq(trackAssets.trackId, tracks.id))
    .leftJoin(
      member,
      and(
        eq(member.organizationId, projects.organizationId),
        eq(member.userId, projects.ownerUserId)
      )
    )
    .where(and(eq(projects.id, projectId), eq(trackAssets.id, sourceAssetId)))
    .limit(1);

  return Boolean(
    source &&
    source.status === "ready" &&
    source.objectKey &&
    (sourceObjectKey === undefined || source.objectKey === sourceObjectKey) &&
    isAuthorizedProjectSource({
      ...source,
      hasOrganizationMembership: Boolean(source.memberId),
    })
  );
}
