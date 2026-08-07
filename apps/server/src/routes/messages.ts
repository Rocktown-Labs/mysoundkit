import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistProfiles,
  conversationParticipants,
  conversations,
  messages,
  trackCollaborators,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
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
  peopleSearchQuerySchema,
  peopleSearchResultSchema,
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
    path: "/people",
    request: {
      query: peopleSearchQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        peopleSearchResultSchema.array(),
        "People matching name, username, or stage name"
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
      return c.json([], HttpStatusCodes.OK);
    }

    const { limit, q } = c.req.valid("query");
    const term = `%${q.replaceAll("%", "\\%")}%`;
    const db = createDb();
    const rows = await db
      .select({
        avatarUrl: userProfiles.avatarUrl,
        displayName: userProfiles.displayName,
        email: authUser.email,
        name: authUser.name,
        stageName: artistProfiles.stageName,
        userId: authUser.id,
        username: userProfiles.username,
      })
      .from(authUser)
      .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
      .leftJoin(artistProfiles, eq(artistProfiles.userId, authUser.id))
      .where(
        or(
          ilike(userProfiles.displayName, term),
          ilike(userProfiles.username, term),
          ilike(authUser.name, term),
          ilike(artistProfiles.stageName, term),
          ilike(authUser.email, term)
        )
      )
      .orderBy(sql`coalesce(${userProfiles.displayName}, ${authUser.name})`)
      .limit(limit);

    return c.json(
      rows.map((row) => ({
        avatarUrl: row.avatarUrl,
        displayName:
          row.displayName ?? row.stageName ?? row.name ?? row.username,
        email: row.email,
        stageName: row.stageName,
        userId: row.userId,
        username: row.username,
      })),
      HttpStatusCodes.OK
    );
  }
);

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
      return c.json(
        sampleConversations.map((conversation) => ({
          ...conversation,
          participantAvatarUrl: null,
          participantName: null,
          participantUsername: null,
        })),
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const rows = await db
      .select({
        conversationType: conversations.conversationType,
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
      })
      .from(conversationParticipants)
      .innerJoin(
        conversations,
        eq(conversations.id, conversationParticipants.conversationId)
      )
      .where(eq(conversationParticipants.userId, user.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(50);

    const conversationIds = rows.map((row) => row.id);
    const otherParticipants =
      conversationIds.length > 0
        ? await db
            .select({
              avatarUrl: userProfiles.avatarUrl,
              conversationId: conversationParticipants.conversationId,
              displayName: userProfiles.displayName,
              userId: userProfiles.userId,
              username: userProfiles.username,
            })
            .from(conversationParticipants)
            .innerJoin(
              userProfiles,
              eq(userProfiles.userId, conversationParticipants.userId)
            )
            .where(
              and(
                inArray(
                  conversationParticipants.conversationId,
                  conversationIds
                ),
                ne(conversationParticipants.userId, user.id)
              )
            )
        : [];
    const participantByConversationId = new Map(
      otherParticipants.map((participant) => [
        participant.conversationId,
        participant,
      ])
    );

    return c.json(
      rows.map((row) => {
        const participant = participantByConversationId.get(row.id);

        return {
          conversationType: row.conversationType,
          id: row.id,
          participantAvatarUrl: participant?.avatarUrl ?? null,
          participantName:
            participant?.displayName ?? participant?.username ?? null,
          participantUsername: participant?.username ?? null,
          title: row.title ?? "Untitled conversation",
          unreadCount: 0,
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
      HttpStatusCodes.OK
    );
  }
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

    const body = c.req.valid("json");
    const conversationType =
      body.participantUserIds.length > 1
        ? ("group" as const)
        : ("direct" as const);
    const now = new Date();

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          conversationType,
          id: "conv_new",
          participantAvatarUrl: null,
          participantName: null,
          participantUsername: null,
          title: body.title ?? "New conversation",
          unreadCount: 0,
          updatedAt: now.toISOString(),
        },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb();
    const conversationId = crypto.randomUUID();
    const participantUserIds = [
      ...new Set([user.id, ...body.participantUserIds]),
    ];
    const [conversation] = await db
      .insert(conversations)
      .values({
        conversationType,
        createdByUserId: user.id,
        id: conversationId,
        title: body.title ?? null,
        updatedAt: now,
      })
      .returning();

    await db.insert(conversationParticipants).values(
      participantUserIds.map((participantUserId) => ({
        conversationId,
        userId: participantUserId,
      }))
    );

    return c.json(
      {
        conversationType,
        id: conversation?.id ?? conversationId,
        participantAvatarUrl: null,
        participantName: null,
        participantUsername: null,
        title: conversation?.title ?? body.title ?? "New conversation",
        unreadCount: 0,
        updatedAt: (conversation?.updatedAt ?? now).toISOString(),
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
      return c.json(sampleMessages, HttpStatusCodes.OK);
    }

    const { conversationId } = c.req.valid("param");
    const db = createDb();
    const [membership] = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, user.id)
        )
      )
      .limit(1);

    if (!membership) {
      return c.json([], HttpStatusCodes.OK);
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(100);

    return c.json(
      rows.map((message) => ({
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        id: message.id,
        senderId: message.senderUserId,
        status: message.status,
      })),
      HttpStatusCodes.OK
    );
  }
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

    const body = c.req.valid("json");
    const { conversationId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          body: body.body,
          createdAt: new Date().toISOString(),
          id: "msg_new",
          senderId: user.id,
          status: "sent" as const,
        },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb();
    const [membership] = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, user.id)
        )
      )
      .limit(1);

    if (!membership) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const [message] = await db
      .insert(messages)
      .values({
        body: body.body,
        conversationId,
        id: crypto.randomUUID(),
        senderUserId: user.id,
      })
      .returning();

    return c.json(
      {
        body: message?.body ?? body.body,
        createdAt: (message?.createdAt ?? new Date()).toISOString(),
        id: message?.id ?? crypto.randomUUID(),
        senderId: message?.senderUserId ?? user.id,
        status: message?.status ?? ("sent" as const),
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
