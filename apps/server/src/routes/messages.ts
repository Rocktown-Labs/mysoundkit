import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistFriendRequests,
  artistProfiles,
  conversationParticipants,
  conversations,
  messages,
  trackCollaborators,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { notifyFriendRequestEmail } from "@/lib/email-events";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { sampleConversations, sampleMessages } from "@/lib/sample-data";
import {
  conversationSummarySchema,
  createConversationBodySchema,
  createFriendRequestBodySchema,
  createMessageBodySchema,
  friendRequestSummarySchema,
  friendSummarySchema,
  messageSchema,
  peopleSearchQuerySchema,
  peopleSearchResultSchema,
  respondFriendRequestBodySchema,
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

const toFriendRequestSummary = ({
  createdAt,
  direction,
  displayName,
  message,
  requestId,
  status,
  userId,
  username,
  avatarUrl,
}: {
  avatarUrl: string | null;
  createdAt: Date;
  direction: "incoming" | "outgoing";
  displayName: string | null;
  message: string | null;
  requestId: string;
  status: "accepted" | "canceled" | "declined" | "pending";
  userId: string;
  username: string | null;
}) => ({
  avatarUrl,
  createdAt: createdAt.toISOString(),
  direction,
  displayName: displayName ?? username ?? "SoundKit Artist",
  id: requestId,
  message,
  status,
  userId,
  username,
});

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
    path: "/friend-requests",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        friendRequestSummarySchema.array(),
        "Artist friend requests"
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

    const db = createDb();
    const rows = await db
      .select({
        avatarUrl: userProfiles.avatarUrl,
        createdAt: artistFriendRequests.createdAt,
        displayName: userProfiles.displayName,
        message: artistFriendRequests.message,
        recipientUserId: artistFriendRequests.recipientUserId,
        requestId: artistFriendRequests.id,
        requesterUserId: artistFriendRequests.requesterUserId,
        status: artistFriendRequests.status,
        username: userProfiles.username,
      })
      .from(artistFriendRequests)
      .innerJoin(
        userProfiles,
        eq(
          userProfiles.userId,
          sql`case when ${artistFriendRequests.requesterUserId} = ${user.id} then ${artistFriendRequests.recipientUserId} else ${artistFriendRequests.requesterUserId} end`
        )
      )
      .where(
        or(
          eq(artistFriendRequests.requesterUserId, user.id),
          eq(artistFriendRequests.recipientUserId, user.id)
        )
      )
      .orderBy(desc(artistFriendRequests.createdAt))
      .limit(100);

    return c.json(
      rows.map((row) =>
        toFriendRequestSummary({
          avatarUrl: row.avatarUrl,
          createdAt: row.createdAt,
          direction: row.recipientUserId === user.id ? "incoming" : "outgoing",
          displayName: row.displayName,
          message: row.message,
          requestId: row.requestId,
          status: row.status,
          userId:
            row.recipientUserId === user.id
              ? row.requesterUserId
              : row.recipientUserId,
          username: row.username,
        })
      ),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/friend-requests",
    request: {
      body: jsonContentRequired(
        createFriendRequestBodySchema,
        "Artist friend request payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        friendRequestSummarySchema,
        "Artist friend request created"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid friend request"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Artist not found"
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
    const username = body.username.trim().replace(/^@/u, "");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          avatarUrl: null,
          createdAt: new Date().toISOString(),
          direction: "outgoing" as const,
          displayName: username,
          id: "friend-request-preview",
          message: body.message ?? null,
          status: "pending" as const,
          userId: "preview-artist",
          username,
        },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb();
    const [recipient] = await db
      .select({
        avatarUrl: userProfiles.avatarUrl,
        displayName: userProfiles.displayName,
        userId: userProfiles.userId,
        username: userProfiles.username,
      })
      .from(userProfiles)
      .innerJoin(artistProfiles, eq(artistProfiles.userId, userProfiles.userId))
      .where(eq(userProfiles.username, username))
      .limit(1);

    if (!recipient) {
      return c.json(
        { message: "Artist not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (recipient.userId === user.id) {
      return c.json(
        { message: "Choose another artist to add as a friend." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const existingRequests = await db
      .select({
        recipientUserId: artistFriendRequests.recipientUserId,
        requesterUserId: artistFriendRequests.requesterUserId,
        status: artistFriendRequests.status,
      })
      .from(artistFriendRequests)
      .where(
        or(
          and(
            eq(artistFriendRequests.requesterUserId, user.id),
            eq(artistFriendRequests.recipientUserId, recipient.userId)
          ),
          and(
            eq(artistFriendRequests.requesterUserId, recipient.userId),
            eq(artistFriendRequests.recipientUserId, user.id)
          )
        )
      )
      .limit(2);
    const acceptedRequest = existingRequests.find(
      (existingRequest) => existingRequest.status === "accepted"
    );

    if (acceptedRequest) {
      return c.json(
        { message: "You are already friends with this artist." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const incomingPendingRequest = existingRequests.find(
      (existingRequest) =>
        existingRequest.status === "pending" &&
        existingRequest.requesterUserId === recipient.userId
    );

    if (incomingPendingRequest) {
      return c.json(
        {
          message:
            "This artist already sent you a friend request. Accept it to start chatting.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [request] = await db
      .insert(artistFriendRequests)
      .values({
        id: crypto.randomUUID(),
        message: body.message ?? null,
        recipientUserId: recipient.userId,
        requesterUserId: user.id,
        status: "pending",
      })
      .onConflictDoUpdate({
        set: {
          message: body.message ?? null,
          respondedAt: null,
          status: "pending",
          updatedAt: new Date(),
        },
        target: [
          artistFriendRequests.requesterUserId,
          artistFriendRequests.recipientUserId,
        ],
      })
      .returning();

    if (!request) {
      return c.json(
        { message: "Unable to create friend request." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    await db.insert(userNotifications).values({
      id: crypto.randomUUID(),
      link: "/dashboard/collaborators",
      message: `${user.name ?? "An artist"} sent you a friend request.`,
      title: "New Friend Request",
      type: "artist_friend_request",
      userId: recipient.userId,
    });

    await notifyFriendRequestEmail({
      queue: c.env.EMAIL_DELIVERY_QUEUE,
      recipientUserId: recipient.userId,
      requestId: request.id,
      requesterName: user.name ?? "An artist",
    });

    return c.json(
      toFriendRequestSummary({
        avatarUrl: recipient.avatarUrl,
        createdAt: request.createdAt,
        direction: "outgoing",
        displayName: recipient.displayName,
        message: request.message,
        requestId: request.id,
        status: request.status,
        userId: recipient.userId,
        username: recipient.username,
      }),
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/friend-requests/{requestId}",
    request: {
      body: jsonContentRequired(
        respondFriendRequestBodySchema,
        "Artist friend request response payload"
      ),
      params: z.object({ requestId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        friendRequestSummarySchema,
        "Artist friend request updated"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Friend request not found"
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

    const { requestId } = c.req.valid("param");
    const { action } = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          avatarUrl: null,
          createdAt: new Date().toISOString(),
          direction: "incoming" as const,
          displayName: "SoundKit Artist",
          id: requestId,
          message: null,
          status:
            action === "accept" ? ("accepted" as const) : ("declined" as const),
          userId: "preview-artist",
          username: null,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const allowedUserClause =
      action === "cancel"
        ? eq(artistFriendRequests.requesterUserId, user.id)
        : eq(artistFriendRequests.recipientUserId, user.id);
    const nextStatus =
      action === "accept"
        ? ("accepted" as const)
        : (action === "cancel"
          ? ("canceled" as const)
          : ("declined" as const));
    const [request] = await db
      .update(artistFriendRequests)
      .set({
        respondedAt: new Date(),
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(artistFriendRequests.id, requestId),
          allowedUserClause,
          eq(artistFriendRequests.status, "pending")
        )
      )
      .returning();

    if (!request) {
      return c.json(
        { message: "Friend request not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (nextStatus === "accepted") {
      await db.insert(userNotifications).values({
        id: crypto.randomUUID(),
        link: "/dashboard/messages",
        message: `${user.name ?? "An artist"} accepted your friend request. You can start a chat now.`,
        title: "Friend Request Accepted",
        type: "artist_friend_accepted",
        userId: request.requesterUserId,
      });
    }

    const otherUserId =
      request.recipientUserId === user.id
        ? request.requesterUserId
        : request.recipientUserId;
    const [otherProfile] = await db
      .select({
        avatarUrl: userProfiles.avatarUrl,
        displayName: userProfiles.displayName,
        username: userProfiles.username,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, otherUserId))
      .limit(1);

    return c.json(
      toFriendRequestSummary({
        avatarUrl: otherProfile?.avatarUrl ?? null,
        createdAt: request.createdAt,
        direction:
          request.recipientUserId === user.id ? "incoming" : "outgoing",
        displayName: otherProfile?.displayName ?? null,
        message: request.message,
        requestId: request.id,
        status: request.status,
        userId: otherUserId,
        username: otherProfile?.username ?? null,
      }),
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
    const [followRows, followerRows, friendRows, collaboratorRows] =
      await Promise.all([
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
            displayName: userProfiles.displayName,
            email: authUser.email,
            id: authUser.id,
            name: authUser.name,
            username: userProfiles.username,
          })
          .from(artistFollows)
          .innerJoin(authUser, eq(authUser.id, artistFollows.followerUserId))
          .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
          .leftJoin(artistProfiles, eq(artistProfiles.userId, authUser.id))
          .where(
            and(
              eq(artistFollows.artistUserId, user.id),
              sql`${artistProfiles.userId} is null`
            )
          )
          .limit(100),
        db
          .select({
            avatarUrl: userProfiles.avatarUrl,
            displayName: userProfiles.displayName,
            email: authUser.email,
            id: authUser.id,
            name: authUser.name,
            requestCreatedAt: artistFriendRequests.createdAt,
            username: userProfiles.username,
          })
          .from(artistFriendRequests)
          .innerJoin(
            authUser,
            eq(
              authUser.id,
              sql`case when ${artistFriendRequests.requesterUserId} = ${user.id} then ${artistFriendRequests.recipientUserId} else ${artistFriendRequests.requesterUserId} end`
            )
          )
          .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
          .where(
            and(
              eq(artistFriendRequests.status, "accepted"),
              or(
                eq(artistFriendRequests.requesterUserId, user.id),
                eq(artistFriendRequests.recipientUserId, user.id)
              )
            )
          )
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

    for (const row of followerRows) {
      friends.set(row.id, {
        avatarUrl: row.avatarUrl,
        email: row.email,
        id: row.id,
        lastInteractionAt: null,
        name: row.displayName ?? row.name ?? row.username ?? "SoundKit Fan",
        relationship: "fan",
        role: "Fan",
        username: row.username,
      });
    }

    for (const row of friendRows) {
      friends.set(row.id, {
        avatarUrl: row.avatarUrl,
        email: row.email,
        id: row.id,
        lastInteractionAt: row.requestCreatedAt.toISOString(),
        name: row.displayName ?? row.name ?? row.username ?? "SoundKit Artist",
        relationship: "friend",
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

    friends.delete(user.id);
    return c.json(Array.from(friends.values()), HttpStatusCodes.OK);
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
    const requestedParticipantUserIds = participantUserIds.filter(
      (participantUserId) => participantUserId !== user.id
    );
    const [acceptedFriendRows, collaboratorRows] = await Promise.all([
      requestedParticipantUserIds.length > 0
        ? db
            .select({
              recipientUserId: artistFriendRequests.recipientUserId,
              requesterUserId: artistFriendRequests.requesterUserId,
            })
            .from(artistFriendRequests)
            .where(
              and(
                eq(artistFriendRequests.status, "accepted"),
                or(
                  and(
                    eq(artistFriendRequests.requesterUserId, user.id),
                    inArray(
                      artistFriendRequests.recipientUserId,
                      requestedParticipantUserIds
                    )
                  ),
                  and(
                    eq(artistFriendRequests.recipientUserId, user.id),
                    inArray(
                      artistFriendRequests.requesterUserId,
                      requestedParticipantUserIds
                    )
                  )
                )
              )
            )
        : [],
      requestedParticipantUserIds.length > 0
        ? db
            .select({
              collaboratorUserId: trackCollaborators.collaboratorUserId,
              invitedByUserId: trackCollaborators.invitedByUserId,
            })
            .from(trackCollaborators)
            .where(
              and(
                or(
                  and(
                    eq(trackCollaborators.invitedByUserId, user.id),
                    inArray(
                      trackCollaborators.collaboratorUserId,
                      requestedParticipantUserIds
                    )
                  ),
                  and(
                    eq(trackCollaborators.collaboratorUserId, user.id),
                    inArray(
                      trackCollaborators.invitedByUserId,
                      requestedParticipantUserIds
                    )
                  )
                )
              )
            )
        : [],
    ]);
    const allowedParticipantUserIds = new Set([
      ...acceptedFriendRows.map((row) =>
        row.requesterUserId === user.id
          ? row.recipientUserId
          : row.requesterUserId
      ),
      ...collaboratorRows
        .flatMap((row) => [row.collaboratorUserId, row.invitedByUserId])
        .filter(
          (participantUserId): participantUserId is string =>
            Boolean(participantUserId) && participantUserId !== user.id
        ),
    ]);

    if (
      requestedParticipantUserIds.some(
        (participantUserId) => !allowedParticipantUserIds.has(participantUserId)
      )
    ) {
      return c.json(
        { message: "Accept a friend request before starting this chat." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

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
