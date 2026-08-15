import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { tracks } from "@soundkit/db/schema/app";
import { member, subscription } from "@soundkit/db/schema/auth";
import { and, eq, inArray } from "drizzle-orm";

import { shouldExcludeArtistSeatStream } from "./stream-qualification-rules";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const,
 ARTIST_PREMIUM_PLAN_CODES = ["soundkit_premium_artist", "artist_team"];

export const isListenerOnTrackArtistPlan = async ({
  listenerUserId,
  trackId,
}: {
  listenerUserId: string | null | undefined;
  trackId: string;
}) => {
  if (!(listenerUserId && isDatabaseConfigured())) {
    return false;
  }

  const db = createDb(),
   [track] = await db
    .select({
      organizationId: tracks.organizationId,
      ownerUserId: tracks.ownerUserId,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!track?.organizationId) {
    return listenerUserId === track?.ownerUserId;
  }

  const rows = await db
    .select({ memberUserId: member.userId })
    .from(member)
    .innerJoin(
      subscription,
      eq(subscription.referenceId, member.organizationId)
    )
    .where(
      and(
        eq(member.organizationId, track.organizationId),
        inArray(subscription.plan, ARTIST_PREMIUM_PLAN_CODES),
        inArray(subscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
      )
    );

  return shouldExcludeArtistSeatStream({
    artistPlanMemberUserIds: rows.map(({ memberUserId }) => memberUserId),
    listenerUserId,
  });
};
