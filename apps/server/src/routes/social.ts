/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistProfiles,
  userFollows,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import { eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { notifyFollowerEmail } from "@/lib/email-events";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { sampleComments } from "@/lib/sample-data";
import {
  commentSchema,
  createCommentBodySchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  followResponseSchema = z.object({
    followed: z.boolean(),
    followerCount: z.number().int().nonnegative(),
  }),
  usernameParamSchema = z.object({ username: z.string() }),
  postIdParamSchema = z.object({ postId: z.string() }),
  unauthorizedResponse = jsonContent(
    messageResponseSchema,
    "Authentication required"
  ),
  notFoundResponse = jsonContent(messageResponseSchema, "Artist not found"),
  commentListResponse = jsonContent(commentSchema.array(), "Post comments"),
  commentCreatedResponse = jsonContent(commentSchema, "Comment created"),
  likeAppliedResponse = jsonContent(messageResponseSchema, "Like applied"),
  publicProfileSchema = z.object({
    accountType: z.enum(["artist", "fan"]),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    displayName: z.string(),
    followerCount: z.number().int().nonnegative(),
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
          location: null,
          username: c.req.valid("param").username,
        },
        HttpStatusCodes.OK
      );
    }

    const { username } = c.req.valid("param"),
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
      .where(eq(userFollows.targetUserId, profile.userId));

    return c.json(
      {
        accountType: profile.accountType,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
        displayName: profile.displayName,
        followerCount: followerSummary?.count ?? 0,
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
        .select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(eq(userProfiles.username, username))
        .limit(1);
    if (!target || target.userId === user.id) {
      return c.json(
        { message: "Profile not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    await db
      .insert(userFollows)
      .values({ followerUserId: user.id, targetUserId: target.userId })
      .onConflictDoNothing();
    const [summary] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.targetUserId, target.userId));
    await db
      .insert(userNotifications)
      .values({
        id: `user_follow:${user.id}:${target.userId}`,
        link: `/people/${username}`,
        message: `${user.name ?? "Someone"} followed your SoundKit profile.`,
        title: "New follower",
        type: "user_follower",
        userId: target.userId,
      })
      .onConflictDoNothing();

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
            displayName: userProfiles.displayName,
            userId: artistProfiles.userId,
            username: userProfiles.username,
          })
          .from(userProfiles)
          .leftJoin(
            artistProfiles,
            eq(artistProfiles.userId, userProfiles.userId)
          )
          .where(eq(userProfiles.userId, user.id))
          .limit(1),
        isFan = !followerArtistProfile?.userId,
        title = isFan ? "New Fan" : "New Artist Follower",
        message = isFan
          ? `${user.name ?? "A fan"} started following your profile. You got a new fan!`
          : `${user.name ?? "An artist"} followed your profile.`;

      await db.insert(userNotifications).values({
        id: crypto.randomUUID(),
        link:
          followerArtistProfile?.username && !isFan
            ? `/artist/${followerArtistProfile.username}`
            : "/dashboard/collaborators?tab=following",
        message,
        title,
        type: isFan ? "fan_follower" : "artist_follower",
        userId: artist.userId,
      });

      await notifyFollowerEmail({
        artistUserId: artist.userId,
        followerName:
          followerArtistProfile?.displayName ?? user.name ?? "Someone",
        followerType: isFan ? "fan" : "artist",
        followerUsername: isFan ? null : followerArtistProfile?.username,
        queue: c.env.EMAIL_DELIVERY_QUEUE,
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
    method: "post",
    path: "/posts/{postId}/likes",
    request: {
      params: postIdParamSchema,
    },
    responses: {
      [HttpStatusCodes.OK]: likeAppliedResponse,
    },
    tags: ["Social"],
  }),
  (c) => c.json({ message: "Like applied" }, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/posts/{postId}/comments",
    request: {
      params: postIdParamSchema,
    },
    responses: {
      [HttpStatusCodes.OK]: commentListResponse,
    },
    tags: ["Social"],
  }),
  (c) => c.json(sampleComments, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/posts/{postId}/comments",
    request: {
      body: jsonContentRequired(
        createCommentBodySchema,
        "Comment create payload"
      ),
      params: postIdParamSchema,
    },
    responses: {
      [HttpStatusCodes.CREATED]: commentCreatedResponse,
    },
    tags: ["Social"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        body: body.body,
        createdAt: new Date().toISOString(),
        id: "comment_new",
        userId: "current_user",
        username: "you",
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
