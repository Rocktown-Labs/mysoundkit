import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistProfiles,
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

const app = new OpenAPIHono<AppEnv>();

const followResponseSchema = z.object({
  followed: z.boolean(),
  followerCount: z.number().int().nonnegative(),
});
const usernameParamSchema = z.object({ username: z.string() });
const postIdParamSchema = z.object({ postId: z.string() });
const unauthorizedResponse = jsonContent(
  messageResponseSchema,
  "Authentication required"
);
const notFoundResponse = jsonContent(messageResponseSchema, "Artist not found");
const commentListResponse = jsonContent(commentSchema.array(), "Post comments");
const commentCreatedResponse = jsonContent(commentSchema, "Comment created");
const likeAppliedResponse = jsonContent(messageResponseSchema, "Like applied");

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

    const db = createDb();
    const [artist] = await db
      .select({
        displayName: userProfiles.displayName,
        followerCount: artistProfiles.followerCount,
        userId: userProfiles.userId,
      })
      .from(userProfiles)
      .innerJoin(artistProfiles, eq(artistProfiles.userId, userProfiles.userId))
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
        .limit(1);

      const isFan = !followerArtistProfile?.userId;
      const title = isFan ? "New Fan" : "New Artist Follower";
      const message = isFan
        ? `${user.name ?? "A fan"} started following your profile. You got a new fan!`
        : `${user.name ?? "An artist"} followed your profile.`;

      await db.insert(userNotifications).values({
        id: crypto.randomUUID(),
        link: `/artist/${username}`,
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
