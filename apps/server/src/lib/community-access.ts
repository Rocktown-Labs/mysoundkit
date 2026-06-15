import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  communities,
  communityMembers,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import { and, eq, inArray } from "drizzle-orm";

import { hasCommunitySubscriptionAccess } from "@/lib/community-subscriptions";

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

  const db = createDb();
  const [community] = await db
    .select({ artistUserId: communities.artistUserId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  if (community?.artistUserId === userId) {
    return true;
  }

  const [membership] = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, communityId),
        eq(communityMembers.userId, userId),
        inArray(communityMembers.role, ["owner", "moderator"])
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

  return subscriptions.some(hasCommunitySubscriptionAccess);
};
