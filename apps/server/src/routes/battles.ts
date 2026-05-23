import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { trackLyrics, tracks } from "@soundkit/db/schema/app";
import { and, eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  forbiddenMessage,
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { sampleBattles } from "@/lib/sample-data";
import {
  battleEligibilityBodySchema,
  battleEligibilitySchema,
  battleSummarySchema,
  createChallengeBodySchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleSummarySchema.array(),
        "Battles feed"
      ),
    },
    tags: ["Battles"],
  }),
  (c) => c.json(sampleBattles, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/eligibility",
    request: {
      body: jsonContentRequired(
        battleEligibilityBodySchema,
        "Battle track eligibility payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleEligibilitySchema,
        "Battle track eligibility"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { trackIds } = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          eligible: false,
          tracks: trackIds.map((trackId) => ({
            lyricsRevisionId: null,
            ready: false,
            reason: "Database is not configured.",
            trackId,
          })),
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    if (trackIds.length === 0) {
      return c.json(
        {
          eligible: true,
          tracks: [],
        },
        HttpStatusCodes.OK
      );
    }

    const [ownedTracks, approvedLyricsRows] = await Promise.all([
      db
        .select({ id: tracks.id })
        .from(tracks)
        .where(
          and(
            inArray(tracks.id, trackIds),
            organizationId
              ? eq(tracks.organizationId, organizationId)
              : eq(tracks.ownerUserId, user.id)
          )
        ),
      db
        .select({
          id: trackLyrics.id,
          timedLines: trackLyrics.timedLines,
          trackId: trackLyrics.trackId,
        })
        .from(trackLyrics)
        .where(
          and(
            inArray(trackLyrics.trackId, trackIds),
            eq(trackLyrics.status, "approved")
          )
        ),
    ]);

    const ownedTrackIds = new Set(ownedTracks.map((track) => track.id));
    const approvedLyricsByTrackId = new Map<
      string,
      { id: string; timedLines: typeof trackLyrics.$inferSelect.timedLines }
    >();

    for (const approvedLyrics of approvedLyricsRows) {
      if (!approvedLyricsByTrackId.has(approvedLyrics.trackId)) {
        approvedLyricsByTrackId.set(approvedLyrics.trackId, {
          id: approvedLyrics.id,
          timedLines: approvedLyrics.timedLines,
        });
      }
    }

    const readiness = trackIds.map((trackId) => {
      if (!ownedTrackIds.has(trackId)) {
        return {
          lyricsRevisionId: null,
          ready: false,
          reason: "Track was not found.",
          trackId,
        };
      }

      const approvedLyrics = approvedLyricsByTrackId.get(trackId);
      const hasSynchronizedLyrics =
        (approvedLyrics?.timedLines?.length ?? 0) > 0;

      return {
        lyricsRevisionId: approvedLyrics?.id ?? null,
        ready: hasSynchronizedLyrics,
        reason: hasSynchronizedLyrics
          ? null
          : "Approved synchronized lyrics are required for battle tracks.",
        trackId,
      };
    });

    return c.json(
      {
        eligible: readiness.every((track) => track.ready),
        tracks: readiness,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{battleId}",
    request: {
      params: z.object({
        battleId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleSummarySchema,
        "Battle detail summary"
      ),
    },
    tags: ["Battles"],
  }),
  (c) => {
    const { battleId } = c.req.valid("param");
    const battle =
      sampleBattles.find((entry) => entry.id === battleId) ?? sampleBattles[0];
    return c.json(battle, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/challenge",
    request: {
      body: jsonContentRequired(
        createChallengeBodySchema,
        "Battle challenge payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        messageResponseSchema,
        "Battle challenge created"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium artist access required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Battles"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

    if (!entitlements.canCreateLiveBattles) {
      return c.json(
        forbiddenMessage(
          "A premium artist subscription is required to create live battles."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json");
    return c.json(
      { message: `Challenge created for ${body.opponentUsername}` },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
