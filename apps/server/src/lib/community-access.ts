/* eslint-disable one-var, sort-vars */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  communities,
  communityBans,
  communityMembers,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import { and, eq, inArray } from "drizzle-orm";

import { hasCommunityAccess } from "@/lib/community-access-policy";
import { loadCommunitySchemaCapabilities } from "@/lib/community-schema-capabilities";

export const canAccessCommunity = async ({
  communityId,
  userId,
}: {
  communityId: string;
  userId: string;
}) => {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const db = createDb(),
    capabilities = await loadCommunitySchemaCapabilities(),
    [ban] = capabilities.bans
      ? await db
          .select({ userId: communityBans.userId })
          .from(communityBans)
          .where(
            and(
              eq(communityBans.communityId, communityId),
              eq(communityBans.userId, userId)
            )
          )
          .limit(1)
      : [];

  const [community] = await db
    .select({ artistUserId: communities.artistUserId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  const [membership] = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, communityId),
        eq(communityMembers.userId, userId)
      )
    )
    .limit(1);

  if (membership) {
    return true;
  }

  const subscriptions = await db
    .select({
      currentPeriodEnd: communitySubscriptions.currentPeriodEnd,
      status: communitySubscriptions.status,
    })
    .from(communitySubscriptions)
    .where(
      and(
        eq(communitySubscriptions.communityId, communityId),
        eq(communitySubscriptions.userId, userId),
        inArray(communitySubscriptions.status, ["active", "canceled"])
      )
    );

  return hasCommunityAccess({
    isBanned: Boolean(ban),
    isMember: Boolean(membership),
    isOwner: community?.artistUserId === userId,
    subscriptions,
  });
};
