/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  genres,
  listeningParties,
  playlists,
  projects,
  userFollows,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, desc, eq, gte } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  isAuthenticatedSession,
  forbiddenMessage,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { notify } from "@/lib/notifications";
import { profileRegionCondition } from "@/lib/public-explore";
import {
  createListeningPartyBodySchema,
  listeningPartySummarySchema,
  messageResponseSchema,
  publicExploreQuerySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  resolveGenreId = async (genreName?: string) => {
    if (!genreName) {
      return null;
    }

    const [genre] = await createDb()
      .select({ id: genres.id })
      .from(genres)
      .where(eq(genres.name, genreName))
      .limit(1);
    return genre?.id ?? null;
  },
  mapParty = (
    party: typeof listeningParties.$inferSelect & { genre?: string | null }
  ) => ({
    description: party.description,
    endedAt: party.endedAt?.toISOString() ?? null,
    genre: party.genre ?? null,
    hostUserId: party.hostUserId,
    id: party.id,
    liveRoomId: party.liveRoomId,
    organizationId: party.organizationId,
    playbackMode: party.playbackMode,
    playlistId: party.playlistId,
    projectId: party.projectId,
    scheduledStartAt: party.scheduledStartAt.toISOString(),
    startedAt: party.startedAt?.toISOString() ?? null,
    status: party.status,
    title: party.title,
  });

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: publicExploreQuerySchema.partial() },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        listeningPartySummarySchema.array(),
        "Listening parties"
      ),
    },
    tags: ["Listening Parties"],
  }),
  async (c) => {
    const query = c.req.valid("query");

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const regionCondition = profileRegionCondition(query),
      rows = await createDb()
        .select({ genre: genres.name, party: listeningParties })
        .from(listeningParties)
        .leftJoin(projects, eq(projects.id, listeningParties.projectId))
        .leftJoin(genres, eq(genres.id, listeningParties.genreId))
        .leftJoin(
          userProfiles,
          eq(userProfiles.userId, listeningParties.hostUserId)
        )
        .where(
          and(
            gte(listeningParties.scheduledStartAt, new Date()),
            regionCondition
          )
        )
        .orderBy(desc(listeningParties.scheduledStartAt))
        .limit(50);

    return c.json(
      rows.map(({ genre, party }) => mapParty({ ...party, genre })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/sources",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          accountType: z.enum(["artist", "fan"]),
          playlists: z.array(z.object({ id: z.string(), title: z.string() })),
          projects: z.array(
            z.object({
              id: z.string(),
              releaseDate: z.string().nullable(),
              title: z.string(),
            })
          ),
        }),
        "Eligible listening party sources"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Listening Parties"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { accountType: "fan" as const, playlists: [], projects: [] },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [profile] = await db
        .select({ accountType: userProfiles.accountType })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1),
      accountType = profile?.accountType ?? "fan",
      projectRows = await db
        .select({
          id: projects.id,
          ownerUserId: projects.ownerUserId,
          projectType: projects.projectType,
          releaseDate: projects.releaseDate,
          title: projects.title,
        })
        .from(projects)
        .where(
          accountType === "artist"
            ? eq(projects.ownerUserId, user.id)
            : eq(projects.isPublic, true)
        ),
      playlistRows =
        accountType === "fan"
          ? await db
              .select({ id: playlists.id, title: playlists.title })
              .from(playlists)
              .where(eq(playlists.ownerUserId, user.id))
          : [];

    return c.json(
      {
        accountType,
        playlists: playlistRows,
        projects: projectRows
          .filter((project) => project.projectType !== "single")
          .map((project) => ({
            id: project.id,
            releaseDate: project.releaseDate?.toISOString() ?? null,
            title: project.title,
          })),
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(
        createListeningPartyBodySchema,
        "Listening party payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        listeningPartySummarySchema,
        "Listening party"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid party schedule"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Listening Parties"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const body = c.req.valid("json"),
      session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
    if (!entitlements.isPremium) {
      return c.json(
        forbiddenMessage("SoundKit Premium is required to host a party."),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const db = createDb(),
      [profile] = await db
        .select({ accountType: userProfiles.accountType })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1),
      accountType = profile?.accountType ?? "fan",
      [project] = body.projectId
        ? await db
            .select()
            .from(projects)
            .where(eq(projects.id, body.projectId))
            .limit(1)
        : [],
      [playlist] = body.playlistId
        ? await db
            .select()
            .from(playlists)
            .where(
              and(
                eq(playlists.id, body.playlistId),
                eq(playlists.ownerUserId, user.id)
              )
            )
            .limit(1)
        : [],
      validProject =
        project &&
        project.projectType !== "single" &&
        (accountType === "artist"
          ? project.ownerUserId === user.id
          : project.isPublic);

    if (!(validProject || playlist)) {
      return c.json(
        { message: "Choose an eligible album, EP, mixtape, or playlist." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (accountType === "artist" && playlist) {
      return c.json(
        { message: "Artist release parties must use one of your projects." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const scheduledStartAt = new Date(body.scheduledStartAt);
    if (scheduledStartAt.getTime() <= Date.now()) {
      return c.json(
        { message: "Listening parties must be scheduled in the future." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const playbackMode =
        accountType === "artist" ? "programmed_release" : "artist_hosted",
      sessionForWorkspace = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(sessionForWorkspace)
          ? sessionForWorkspace
          : null,
        user,
      }),
      [party] = await db
        .insert(listeningParties)
        .values({
          description: body.description ?? null,
          genreId: await resolveGenreId(body.genre),
          hostUserId: user.id,
          id: crypto.randomUUID(),
          liveRoomId: crypto.randomUUID(),
          organizationId,
          playbackMode,
          playlistId: body.playlistId ?? null,
          projectId: body.projectId ?? null,
          scheduledStartAt,
          title: body.title,
        })
        .returning();

    if (!party) {
      throw new Error("Failed to create listening party.");
    }

    const [artistFollowers, profileFollowers] = await Promise.all([
        db
          .select({ userId: artistFollows.followerUserId })
          .from(artistFollows)
          .where(eq(artistFollows.artistUserId, user.id)),
        db
          .select({ userId: userFollows.followerUserId })
          .from(userFollows)
          .where(eq(userFollows.targetUserId, user.id)),
      ]),
      followerIds = [
        ...new Set([
          ...artistFollowers.map((entry) => entry.userId),
          ...profileFollowers.map((entry) => entry.userId),
        ]),
      ].filter((id) => id !== user.id);
    for (const followerId of followerIds) {
      const experienceId = party.liveRoomId ?? party.id;
      await notify(
        {
          actorUserId: user.id,
          data: {
            artistName: user.name ?? "A host you follow",
            experienceId,
            experienceTitle: party.title,
            href: `/live/parties/${experienceId}`,
            kind: "party",
          },
          entity: { id: party.id, type: "listening_party" },
          eventId: party.id,
          recipientUserId: followerId,
          type: "live.scheduled",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }

    return c.json(mapParty(party), HttpStatusCodes.CREATED);
  }
);

export default app;
