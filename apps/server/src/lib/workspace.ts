import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { workspaceProfiles } from "@soundkit/db/schema/app";
import { member, organization, team } from "@soundkit/db/schema/auth";
import { and, eq } from "drizzle-orm";

import type { AuthenticatedSession, AuthenticatedUser } from "@/lib/types";

export const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");

export const uniqueSlug = (value: string) =>
  `${slugify(value) || "soundkit"}-${crypto.randomUUID().slice(0, 8)}`;

export const resolveActiveOrganizationId = async ({
  session,
  user,
}: {
  session: AuthenticatedSession | null;
  user: AuthenticatedUser;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();

  if (session?.activeOrganizationId) {
    const [activeMembership] = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(
        and(
          eq(member.organizationId, session.activeOrganizationId),
          eq(member.userId, user.id)
        )
      )
      .limit(1);

    if (activeMembership) {
      return activeMembership.organizationId;
    }
  }

  const [firstMembership] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, user.id))
    .limit(1);

  return firstMembership?.organizationId ?? null;
};

export const ensureWorkspaceForUser = async ({
  accountType,
  displayName,
  user,
}: {
  accountType: "artist" | "fan";
  displayName: string;
  user: AuthenticatedUser;
}) => {
  const db = createDb(),

   [existingMembership] = await db
    .select({
      organizationId: member.organizationId,
    })
    .from(member)
    .where(eq(member.userId, user.id))
    .limit(1);

  if (existingMembership) {
    await db
      .insert(workspaceProfiles)
      .values({
        organizationId: existingMembership.organizationId,
        workspaceType: accountType === "artist" ? "artist_team" : "fan_family",
      })
      .onConflictDoNothing();

    return existingMembership.organizationId;
  }

  const organizationId = crypto.randomUUID(),
   teamId = crypto.randomUUID(),
   now = new Date();

  await db.insert(organization).values({
    createdAt: now,
    id: organizationId,
    name: displayName,
    slug: uniqueSlug(displayName),
  });

  await db.insert(member).values({
    createdAt: now,
    id: crypto.randomUUID(),
    organizationId,
    role: "owner",
    userId: user.id,
  });

  await db.insert(team).values({
    createdAt: now,
    id: teamId,
    name: accountType === "artist" ? "Artist Team" : "Family",
    organizationId,
    updatedAt: now,
  });

  await db.insert(workspaceProfiles).values({
    createdAt: now,
    organizationId,
    updatedAt: now,
    workspaceType: accountType === "artist" ? "artist_team" : "fan_family",
  });

  return organizationId;
};
