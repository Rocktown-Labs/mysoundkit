/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistProfiles,
  userFollows,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { notifyFollowCreated } from "@/lib/follow-notifications";
import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  followResponseSchema = z.object({
    followed: z.boolean(),
    followerCount: z.number().int().nonnegative(),
  }),
  usernameParamSchema = z.object({ username: z.string() }),
  unauthorizedResponse = jsonContent(
    messageResponseSchema,
    "Authentication required"
  ),
  notFoundResponse = jsonContent(messageResponseSchema, "Artist not found"),
  publicProfileSchema = z.object({
    accountType: z.enum(["artist", "fan"]),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    displayName: z.string(),
    followerCount: z.number().int().nonnegative(),
    id: z.string(),
    isFollowing: z.boolean(),
    location: z.string().nullable(),
    username: z.string(),
  });

app.openapi(
  createRoute({
    method: "get",
    path: "/profiles/{username}",
    request: { params: usernameParamSchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(publicProfileSchema, "Public profile"),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Profile not found"
      ),
    },
    tags: ["Social"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json(
        {
          accountType: "fan" as const,
          avatarUrl: null,
          bio: null,
          displayName: "SoundKit Fan",
          followerCount: 0,
          id: "profile_fan",
          isFollowing: false,
          location: null,
          username: c.req.valid("param").username,
        },
        HttpStatusCodes.OK
      );
    }

    const { username } = c.req.valid("param"),
      viewer = c.get("user"),
      db = createDb(),
      [profile] = await db
        .select({
          accountType: userProfiles.accountType,
          avatarUrl: userProfiles.avatarUrl,
          bio: userProfiles.bio,
          city: userProfiles.city,
          displayName: userProfiles.displayName,
          state: userProfiles.state,
          userId: userProfiles.userId,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(eq(userProfiles.username, username))
        .limit(1);

    if (!(profile?.displayName && profile.username)) {
      return c.json(
        { message: "Profile not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [followerSummary] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userFollows)
        .where(eq(userFollows.targetUserId, profile.userId)),
      [viewerFollow] = isAuthenticatedUser(viewer)
        ? await db
            .select({ id: userFollows.followerUserId })
            .from(userFollows)
            .where(
              and(
                eq(userFollows.followerUserId, viewer.id),
                eq(userFollows.targetUserId, profile.userId)
              )
            )
            .limit(1)
        : [];

    return c.json(
      {
        accountType: profile.accountType,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
        displayName: profile.displayName,
        followerCount: followerSummary?.count ?? 0,
        id: profile.userId,
        isFollowing: Boolean(viewerFollow),
        location:
          [profile.city, profile.state].filter(Boolean).join(", ") || null,
        username: profile.username,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/profiles/{username}/follow",
    request: { params: usernameParamSchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(followResponseSchema, "User followed"),
      [HttpStatusCodes.UNAUTHORIZED]: unauthorizedResponse,
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Profile not found"
      ),
    },
    tags: ["Social"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { username } = c.req.valid("param"),
      db = createDb(),
      [target] = await db
        .select({
          accountType: userProfiles.accountType,
          userId: userProfiles.userId,
        })
        .from(userProfiles)
        .where(eq(userProfiles.username, username))
        .limit(1);
    if (!target || target.userId === user.id) {
      return c.json(
        { message: "Profile not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [createdFollow] = await db
        .insert(userFollows)
        .values({ followerUserId: user.id, targetUserId: target.userId })
        .onConflictDoNothing()
        .returning(),
      [followerProfile] = await db
        .select({
          accountType: userProfiles.accountType,
          displayName: userProfiles.displayName,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1),
      [summary] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userFollows)
        .where(eq(userFollows.targetUserId, target.userId));

    if (createdFollow) {
      await notifyFollowCreated({
        actorAccountType: followerProfile?.accountType ?? "artist",
        actorName: followerProfile?.displayName ?? user.name ?? "Someone",
        actorUserId: user.id,
        actorUsername: followerProfile?.username,
        emailQueue: c.env.EMAIL_DELIVERY_QUEUE,
        recipientUserId: target.userId,
      });
    }

    return c.json(
      { followed: true, followerCount: summary?.count ?? 0 },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/artists/{username}/follow",
    request: {
      params: usernameParamSchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        followResponseSchema,
        "Artist followed"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: unauthorizedResponse,
      [HttpStatusCodes.NOT_FOUND]: notFoundResponse,
    },
    tags: ["Social"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { username } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json({ followed: true, followerCount: 1 }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      [artist] = await db
        .select({
          displayName: userProfiles.displayName,
          followerCount: artistProfiles.followerCount,
          userId: userProfiles.userId,
        })
        .from(userProfiles)
        .innerJoin(
          artistProfiles,
          eq(artistProfiles.userId, userProfiles.userId)
        )
        .where(eq(userProfiles.username, username))
        .limit(1);

    if (!artist) {
      return c.json(
        { message: "Artist not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (artist.userId === user.id) {
      return c.json(
        { followed: true, followerCount: artist.followerCount },
        HttpStatusCodes.OK
      );
    }

    const [createdFollow] = await db
      .insert(artistFollows)
      .values({
        artistUserId: artist.userId,
        followerUserId: user.id,
      })
      .onConflictDoNothing()
      .returning();

    if (createdFollow) {
      await db
        .update(artistProfiles)
        .set({ followerCount: sql`${artistProfiles.followerCount} + 1` })
        .where(eq(artistProfiles.userId, artist.userId));

      const [followerArtistProfile] = await db
        .select({
          accountType: userProfiles.accountType,
          displayName: userProfiles.displayName,
          userId: userProfiles.userId,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1);

      await notifyFollowCreated({
        actorAccountType: followerArtistProfile?.accountType ?? "artist",
        actorName: followerArtistProfile?.displayName ?? user.name ?? "Someone",
        actorUserId: user.id,
        actorUsername: followerArtistProfile?.username,
        emailQueue: c.env.EMAIL_DELIVERY_QUEUE,
        recipientUserId: artist.userId,
      });
    }

    const [updated] = await db
      .select({ followerCount: artistProfiles.followerCount })
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, artist.userId))
      .limit(1);

    return c.json(
      {
        followed: true,
        followerCount: updated?.followerCount ?? artist.followerCount,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/artists/{username}/follow",
    request: { params: usernameParamSchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        followResponseSchema,
        "Artist unfollowed"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: unauthorizedResponse,
      [HttpStatusCodes.NOT_FOUND]: notFoundResponse,
    },
    tags: ["Social"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json({ followed: false, followerCount: 0 }, HttpStatusCodes.OK);
    }
    const db = createDb(),
      [artist] = await db
        .select({
          followerCount: artistProfiles.followerCount,
          userId: artistProfiles.userId,
        })
        .from(userProfiles)
        .innerJoin(
          artistProfiles,
          eq(artistProfiles.userId, userProfiles.userId)
        )
        .where(eq(userProfiles.username, c.req.valid("param").username))
        .limit(1);
    if (!artist) {
      return c.json(
        { message: "Artist not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const [deleted] = await db
      .delete(artistFollows)
      .where(
        and(
          eq(artistFollows.artistUserId, artist.userId),
          eq(artistFollows.followerUserId, user.id)
        )
      )
      .returning({ followerUserId: artistFollows.followerUserId });
    if (deleted) {
      await db
        .update(artistProfiles)
        .set({
          followerCount: sql`greatest(${artistProfiles.followerCount} - 1, 0)`,
        })
        .where(eq(artistProfiles.userId, artist.userId));
    }
    const [updated] = await db
      .select({ followerCount: artistProfiles.followerCount })
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, artist.userId))
      .limit(1);
    return c.json(
      {
        followed: false,
        followerCount: updated?.followerCount ?? artist.followerCount,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/profiles/{username}/follow",
    request: { params: usernameParamSchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        followResponseSchema,
        "Profile unfollowed"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: unauthorizedResponse,
      [HttpStatusCodes.NOT_FOUND]: notFoundResponse,
    },
    tags: ["Social"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json({ followed: false, followerCount: 0 }, HttpStatusCodes.OK);
    }
    const db = createDb(),
      [target] = await db
        .select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(eq(userProfiles.username, c.req.valid("param").username))
        .limit(1);
    if (!target || target.userId === user.id) {
      return c.json(
        { message: "Profile not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    await db
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.followerUserId, user.id),
          eq(userFollows.targetUserId, target.userId)
        )
      );
    const [summary] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.targetUserId, target.userId));
    return c.json(
      { followed: false, followerCount: summary?.count ?? 0 },
      HttpStatusCodes.OK
    );
  }
);


export default app;
