import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  trackCollaborators,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { desc, eq, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { sampleConversations, sampleMessages } from "@/lib/sample-data";
import {
  conversationSummarySchema,
  createConversationBodySchema,
  createMessageBodySchema,
  friendSummarySchema,
  messageSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const sampleFriends = [
  {
    avatarUrl: "/diverse-user-avatars.png",
    email: "alex@soundkit.app",
    id: "sample-alex",
    lastInteractionAt: new Date().toISOString(),
    name: "Alex Johnson",
    relationship: "collaborator" as const,
    role: "Producer",
    username: "alex",
  },
  {
    avatarUrl: "/diverse-user-avatars.png",
    email: "sam@soundkit.app",
    id: "sample-sam",
    lastInteractionAt: new Date().toISOString(),
    name: "Sam Rivera",
    relationship: "friend" as const,
    role: "Artist",
    username: "sam",
  },
];

app.openapi(
  createRoute({
    method: "get",
    path: "/friends",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        friendSummarySchema.array(),
        "Friends and collaborators list"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Messages"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(sampleFriends, HttpStatusCodes.OK);
    }

    const db = createDb();
    const [followRows, collaboratorRows] = await Promise.all([
      db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          email: authUser.email,
          id: authUser.id,
          name: authUser.name,
          username: userProfiles.username,
        })
        .from(artistFollows)
        .innerJoin(authUser, eq(authUser.id, artistFollows.artistUserId))
        .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(eq(artistFollows.followerUserId, user.id))
        .limit(100),
      db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          collaboratorUserId: trackCollaborators.collaboratorUserId,
          createdAt: trackCollaborators.createdAt,
          displayName: userProfiles.displayName,
          email: trackCollaborators.inviteEmail,
          role: trackCollaborators.collaboratorRole,
          username: userProfiles.username,
        })
        .from(trackCollaborators)
        .leftJoin(
          userProfiles,
          eq(userProfiles.userId, trackCollaborators.collaboratorUserId)
        )
        .where(
          or(
            eq(trackCollaborators.invitedByUserId, user.id),
            eq(trackCollaborators.collaboratorUserId, user.id)
          )
        )
        .orderBy(desc(trackCollaborators.createdAt))
        .limit(100),
    ]);

    const friends = new Map<string, z.infer<typeof friendSummarySchema>>();

    for (const row of followRows) {
      friends.set(row.id, {
        avatarUrl: row.avatarUrl,
        email: row.email,
        id: row.id,
        lastInteractionAt: null,
        name: row.displayName ?? row.name ?? row.username ?? "SoundKit Artist",
        relationship: "following",
        role: "Artist",
        username: row.username,
      });
    }

    for (const row of collaboratorRows) {
      const id = row.collaboratorUserId ?? row.email ?? crypto.randomUUID();
      friends.set(id, {
        avatarUrl: row.avatarUrl,
        email: row.email,
        id,
        lastInteractionAt: row.createdAt.toISOString(),
        name: row.displayName ?? row.email ?? "Invited collaborator",
        relationship: "collaborator",
        role: row.role,
        username: row.username,
      });
    }

    return c.json([...friends.values()], HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/conversations",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        conversationSummarySchema.array(),
        "Conversation list"
      ),
    },
    tags: ["Messages"],
  }),
  (c) => c.json(sampleConversations, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/conversations",
    request: {
      body: jsonContentRequired(
        createConversationBodySchema,
        "Conversation create payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        conversationSummarySchema,
        "Conversation created"
      ),
    },
    tags: ["Messages"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        conversationType:
          body.participantUserIds.length > 1
            ? ("group" as const)
            : ("direct" as const),
        id: "conv_new",
        title: body.title ?? "New conversation",
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/conversations/{conversationId}/messages",
    request: {
      params: z.object({
        conversationId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageSchema.array(),
        "Conversation messages"
      ),
    },
    tags: ["Messages"],
  }),
  (c) => c.json(sampleMessages, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/conversations/{conversationId}/messages",
    request: {
      body: jsonContentRequired(
        createMessageBodySchema,
        "Message create payload"
      ),
      params: z.object({
        conversationId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(messageSchema, "Message created"),
    },
    tags: ["Messages"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        body: body.body,
        createdAt: new Date().toISOString(),
        id: "msg_new",
        senderId: "current_user",
        status: "sent" as const,
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
