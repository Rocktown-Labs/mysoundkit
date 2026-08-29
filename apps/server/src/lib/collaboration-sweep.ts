import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { collaborationProposals, projects } from "@soundkit/db/schema/app";
import { and, eq, lte } from "drizzle-orm";

export const runCollaborationProposalSweep = async () => {
  if (!isDatabaseConfigured()) {
    return { archivedProjects: 0, expiredProposals: 0 };
  }

  const db = createDb();
  const now = new Date();
  const expiredProposals = await db
    .update(collaborationProposals)
    .set({ respondedAt: now, status: "expired" })
    .where(
      and(
        eq(collaborationProposals.status, "pending"),
        lte(collaborationProposals.expiresAt, now)
      )
    )
    .returning({
      collaborationId: collaborationProposals.collaborationId,
      kind: collaborationProposals.kind,
    });

  const projectIds = [
    ...new Set(
      expiredProposals
        .filter((proposal) => proposal.kind === "project")
        .map((proposal) => proposal.collaborationId)
    ),
  ];

  for (const projectId of projectIds) {
    await db
      .update(projects)
      .set({ status: "archived", updatedAt: now })
      .where(eq(projects.id, projectId));
  }

  return {
    archivedProjects: projectIds.length,
    expiredProposals: expiredProposals.length,
  };
};
