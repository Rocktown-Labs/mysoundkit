import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  battleKits,
  liveExperiences,
  openVerseListings,
  projects,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { communities } from "@soundkit/db/schema/communities";
import { platformInvites } from "@soundkit/db/schema/referrals";
import { and, count, eq, inArray, isNull, lte, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { artistSetupGuideSchema, messageResponseSchema } from "@/lib/schemas";
import { getSellerAccount, refreshSellerAccount } from "@/lib/seller";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  MINIMUM_BATTLE_KIT_TRACKS = 4,
  emptyResponse = () => ({
    battleKits: {
      canStart: false,
      count: 0,
      minimumReleasedTracks: MINIMUM_BATTLE_KIT_TRACKS,
    },
    capabilities: {
      canCreateLiveBattles: false,
      canHostLiveStreams: false,
      canOperatePaidCommunity: false,
      canReceivePayouts: false,
      canSellProducts: false,
      isPremium: false,
    },
    catalog: {
      hasPlayablePublicRelease: false,
      hasProject: false,
      hasSellableItem: false,
      hasTrack: false,
      releasedPlayableTrackCount: 0,
      trackCount: 0,
    },
    community: { hasOwnedCommunity: false },
    creatorTools: {
      hasLiveExperience: false,
      hasOpenVerse: false,
      hasVideo: false,
    },
    monetization: {
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingStatus: "not_started" as const,
      payoutsEnabled: false,
    },
    profile: { isPublicReady: false },
    referrals: { inviteSent: false },
  });

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistSetupGuideSchema,
        "Artist setup guide state"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Artist account required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Artist setup guide"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(emptyResponse(), HttpStatusCodes.OK);
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [profile] = await db
        .select({
          accountType: userProfiles.accountType,
          city: userProfiles.city,
          country: userProfiles.country,
          displayName: userProfiles.displayName,
          state: userProfiles.state,
          username: userProfiles.username,
          genreId: artistProfiles.primaryGenreId,
        })
        .from(userProfiles)
        .leftJoin(artistProfiles, eq(artistProfiles.userId, user.id))
        .where(eq(userProfiles.userId, user.id))
        .limit(1);

    if (profile?.accountType !== "artist") {
      return c.json(
        { message: "An artist account is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const trackScope = organizationId
        ? or(
            eq(tracks.organizationId, organizationId),
            eq(tracks.ownerUserId, user.id)
          )
        : eq(tracks.ownerUserId, user.id),
      projectScope = organizationId
        ? or(
            eq(projects.organizationId, organizationId),
            eq(projects.ownerUserId, user.id)
          )
        : eq(projects.ownerUserId, user.id),
      openVerseScope = organizationId
        ? or(
            eq(openVerseListings.organizationId, organizationId),
            eq(openVerseListings.ownerUserId, user.id)
          )
        : eq(openVerseListings.ownerUserId, user.id),
      videoScope = organizationId
        ? or(
            eq(videos.organizationId, organizationId),
            eq(videos.ownerUserId, user.id)
          )
        : eq(videos.ownerUserId, user.id),
      [
        trackCounts,
        releasedTrackCounts,
        projectCounts,
        sellableTracks,
        sellableProjects,
        communityRows,
        referralRows,
        battleKitRows,
        openVerseRows,
        videoRows,
        liveRows,
        seller,
      ] = await Promise.all([
        db
          .select({ value: count() })
          .from(tracks)
          .where(and(trackScope, isNull(tracks.deletedAt))),
        db
          .select({ value: count() })
          .from(tracks)
          .where(
            and(
              trackScope,
              isNull(tracks.deletedAt),
              eq(tracks.isPublic, true),
              inArray(tracks.releaseStrategy, [
                "publish_when_ready",
                "scheduled",
              ]),
              or(isNull(tracks.releaseAt), lte(tracks.releaseAt, new Date()))
            )
          ),
        db.select({ value: count() }).from(projects).where(projectScope),
        db
          .select({ value: count() })
          .from(tracks)
          .where(
            and(
              trackScope,
              isNull(tracks.deletedAt),
              eq(tracks.isForSale, true)
            )
          ),
        db
          .select({ value: count() })
          .from(projects)
          .where(and(projectScope, eq(projects.isForSale, true))),
        db
          .select({ id: communities.id })
          .from(communities)
          .where(
            and(
              eq(communities.artistUserId, user.id),
              eq(communities.isActive, true)
            )
          )
          .limit(1),
        db
          .select({ id: platformInvites.id })
          .from(platformInvites)
          .where(eq(platformInvites.inviterUserId, user.id))
          .limit(1),
        db
          .select({ id: battleKits.id })
          .from(battleKits)
          .where(
            organizationId
              ? or(
                  eq(battleKits.organizationId, organizationId),
                  eq(battleKits.ownerUserId, user.id)
                )
              : eq(battleKits.ownerUserId, user.id)
          )
          .limit(1),
        db
          .select({ id: openVerseListings.id })
          .from(openVerseListings)
          .where(openVerseScope)
          .limit(1),
        db.select({ id: videos.id }).from(videos).where(videoScope).limit(1),
        db
          .select({ id: liveExperiences.id })
          .from(liveExperiences)
          .where(eq(liveExperiences.createdByUserId, user.id))
          .limit(1),
        refreshSellerAccount({ organizationId, userId: user.id }),
      ]),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      trackCount = Number(trackCounts[0]?.value ?? 0),
      releasedPlayableTrackCount = Number(releasedTrackCounts[0]?.value ?? 0),
      projectCount = Number(projectCounts[0]?.value ?? 0),
      hasSellableItem =
        Number(sellableTracks[0]?.value ?? 0) > 0 ||
        Number(sellableProjects[0]?.value ?? 0) > 0,
      resolvedSeller =
        seller ?? (await getSellerAccount({ organizationId, userId: user.id })),
      isPublicReady = Boolean(
        profile.username &&
        profile.displayName &&
        profile.city &&
        profile.state &&
        profile.country &&
        profile.genreId
      );

    return c.json(
      {
        battleKits: {
          canStart:
            entitlements.canCreateLiveBattles &&
            releasedPlayableTrackCount >= MINIMUM_BATTLE_KIT_TRACKS,
          count: battleKitRows.length,
          minimumReleasedTracks: MINIMUM_BATTLE_KIT_TRACKS,
        },
        capabilities: {
          canCreateLiveBattles: entitlements.canCreateLiveBattles,
          canHostLiveStreams: entitlements.canHostLiveStreams,
          canOperatePaidCommunity: entitlements.canOperatePaidCommunity,
          canReceivePayouts: entitlements.canReceivePayouts,
          canSellProducts: entitlements.canSellProducts,
          isPremium: entitlements.isPremium,
        },
        catalog: {
          hasPlayablePublicRelease: releasedPlayableTrackCount > 0,
          hasProject: projectCount > 0,
          hasSellableItem,
          hasTrack: trackCount > 0,
          releasedPlayableTrackCount,
          trackCount,
        },
        community: { hasOwnedCommunity: communityRows.length > 0 },
        creatorTools: {
          hasLiveExperience: liveRows.length > 0,
          hasOpenVerse: openVerseRows.length > 0,
          hasVideo: videoRows.length > 0,
        },
        monetization: {
          chargesEnabled: resolvedSeller?.chargesEnabled ?? false,
          detailsSubmitted: resolvedSeller?.detailsSubmitted ?? false,
          onboardingStatus: resolvedSeller?.onboardingStatus ?? "not_started",
          payoutsEnabled: resolvedSeller?.payoutsEnabled ?? false,
        },
        profile: { isPublicReady },
        referrals: { inviteSent: referralRows.length > 0 },
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
