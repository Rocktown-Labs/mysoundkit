import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  playbackSessions,
  tracks,
} from "@soundkit/db/schema/app";
import { count, eq, inArray, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
} from "@/lib/entitlements";
import { sampleAnalyticsOverview } from "@/lib/sample-data";
import { analyticsOverviewSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsOverviewSchema,
        "Analytics overview"
      ),
    },
    tags: ["Analytics"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isDatabaseConfigured() || !isAuthenticatedUser(user)) {
      return c.json(sampleAnalyticsOverview, HttpStatusCodes.OK);
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      userTracks = await db
        .select({ id: tracks.id })
        .from(tracks)
        .where(
          organizationId
            ? or(
                eq(tracks.organizationId, organizationId),
                eq(tracks.ownerUserId, user.id)
              )
            : eq(tracks.ownerUserId, user.id)
        ),
      trackIds = userTracks.map((t) => t.id),
      [followerCount] = await db
        .select({ count: count() })
        .from(artistFollows)
        .where(eq(artistFollows.artistUserId, user.id));

    let totalPlays = 0;
    if (trackIds.length > 0) {
      const [sessionCount] = await db
        .select({ count: count() })
        .from(playbackSessions)
        .where(inArray(playbackSessions.trackId, trackIds));
      totalPlays = Number(sessionCount?.count ?? 0);
    }

    return c.json(
      {
        totalDownloads: Math.round(totalPlays * 0.05),
        totalFollowers: Number(followerCount?.count ?? 0),
        totalPlays,
        totalRevenue: Math.round(totalPlays * 0.0042 * 100) / 100,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
