/* eslint-disable complexity, sort-vars, unicorn/max-nested-calls, one-var, no-nested-ternary, unicorn/no-negated-condition */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistFriendRequests,
  artistProfiles,
  conversationParticipants,
  conversations,
  messageAttachments,
  messages,
  projectCollaborators,
  projects,
  trackCollaborators,
  tracks,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { resolveConversationUnreadCount } from "@/lib/messages-domain";
import { notify } from "@/lib/notifications";
import { sampleConversations, sampleMessages } from "@/lib/sample-data";
import {
  conversationSummarySchema,
  createConversationBodySchema,
  createFriendRequestBodySchema,
  createMessageBodySchema,
  friendRequestSummarySchema,
  friendSummarySchema,
  messageResponseSchema,
  messageSchema,
  peopleSearchQuerySchema,
  peopleSearchResultSchema,
  respondFriendRequestBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { claimUploadIntent, completeUploadIntent } from "@/lib/upload-intents";

const app = new OpenAPIHono<AppEnv>(),
  sampleFriends = [
    {
      avatarUrl: "/soundkit-default-avatar.svg",
      email: "alex@soundkit.app",
      id: "sample-alex",
      lastInteractionAt: new Date().toISOString(),
      name: "Alex Johnson",
      relationship: "collaborator" as const,
      role: "Producer",
      username: "alex",
    },
    {
      avatarUrl: "/soundkit-default-avatar.svg",
      email: "sam@soundkit.app",
      id: "sample-sam",
      lastInteractionAt: new Date().toISOString(),
      name: "Sam Rivera",
      relationship: "friend" as const,
      role: "Artist",
      username: "sam",
    },
  ],
  toIso = (val: unknown): string => {
    if (!val) {
      return new Date().toISOString();
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (typeof val === "string" || typeof val === "number") {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
    return new Date().toISOString();
  },
  toNullableIso = (val: unknown): string | null => {
    if (!val) {
      return null;
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (typeof val === "string" || typeof val === "number") {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
    return null;
  },
  toFriendRequestSummary = ({
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
    createdAt: toIso(createdAt),
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

    const { limit, q } = c.req.valid("query"),
      term = `%${q.replaceAll("%", "\\%")}%`,
      db = createDb(),
      rows = await db
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
        .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .leftJoin(artistProfiles, eq(artistProfiles.userId, authUser.id))
        .where(
          and(
            ne(authUser.id, user.id),
            or(
              ilike(userProfiles.displayName, term),
              ilike(userProfiles.username, term),
              ilike(authUser.name, term),
              ilike(artistProfiles.stageName, term),
              ilike(authUser.email, term)
            )
          )
        )
        .orderBy(
          sql`coalesce(${userProfiles.displayName}, ${artistProfiles.stageName}, ${authUser.name}, ${authUser.email})`
        )
        .limit(limit);

    return c.json(
      rows.map((row) => ({
        avatarUrl: row.avatarUrl,
        displayName:
          row.displayName ??
          row.stageName ??
          row.name ??
          row.username ??
          "SoundKit User",
        email: row.email,
        stageName: row.stageName,
        userId: row.userId,
        username: row.username ?? row.email?.split("@")[0] ?? "user",
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

    const db = createDb(),
      rows = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          createdAt: artistFriendRequests.createdAt,
          displayName: userProfiles.displayName,
          email: authUser.email,
          message: artistFriendRequests.message,
          name: authUser.name,
          recipientUserId: artistFriendRequests.recipientUserId,
          requestId: artistFriendRequests.id,
          requesterUserId: artistFriendRequests.requesterUserId,
          status: artistFriendRequests.status,
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
          displayName:
            row.displayName ?? row.name ?? row.username ?? "SoundKit Artist",
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

    const body = c.req.valid("json"),
      username = body.username.trim().replace(/^@/u, "");

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

    const db = createDb(),
      [recipient] = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          userId: userProfiles.userId,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .innerJoin(
          artistProfiles,
          eq(artistProfiles.userId, userProfiles.userId)
        )
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
        .limit(2),
      acceptedRequest = existingRequests.find(
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

    await notify(
      {
        actorUserId: user.id,
        data: {
          actorName: user.name ?? "An artist",
          requestId: request.id,
        },
        entity: { id: request.id, type: "friend_request" },
        eventId: request.id,
        recipientUserId: recipient.userId,
        type: "friend.requested",
      },
      { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
    );

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
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid friend request action"
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

    const { requestId } = c.req.valid("param"),
      { action } = c.req.valid("json");

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

    const db = createDb(),
      [existingRequest] = await db
        .select()
        .from(artistFriendRequests)
        .where(eq(artistFriendRequests.id, requestId))
        .limit(1);

    if (!existingRequest) {
      return c.json(
        { message: "Friend request not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const isRequester = existingRequest.requesterUserId === user.id,
      isRecipient = existingRequest.recipientUserId === user.id;

    if (!isRequester && !isRecipient) {
      return c.json(
        {
          message: "You are not authorized to respond to this friend request.",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    if (action === "cancel" && !isRequester) {
      return c.json(
        { message: "Only the sender can cancel a friend request." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if ((action === "accept" || action === "decline") && !isRecipient) {
      return c.json(
        {
          message: "Only the recipient can accept or decline a friend request.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const nextStatus =
      action === "accept"
        ? ("accepted" as const)
        : action === "cancel"
          ? ("canceled" as const)
          : ("declined" as const);

    let updatedRequest = existingRequest;

    if (existingRequest.status === "pending") {
      const [updated] = await db
        .update(artistFriendRequests)
        .set({
          respondedAt: new Date(),
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(artistFriendRequests.id, requestId))
        .returning();

      if (updated) {
        updatedRequest = updated;
      }
    } else if (existingRequest.status !== nextStatus) {
      return c.json(
        {
          message: `Friend request has already been ${existingRequest.status}.`,
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (nextStatus === "accepted" && existingRequest.status === "pending") {
      await notify(
        {
          actorUserId: user.id,
          data: {
            actorName: user.name ?? "An artist",
            requestId: updatedRequest.id,
          },
          entity: { id: updatedRequest.id, type: "friend_request" },
          eventId: updatedRequest.id,
          recipientUserId: updatedRequest.requesterUserId,
          type: "friend.accepted",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }

    const otherUserId =
        updatedRequest.recipientUserId === user.id
          ? updatedRequest.requesterUserId
          : updatedRequest.recipientUserId,
      [otherUser] = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          name: authUser.name,
          username: userProfiles.username,
        })
        .from(authUser)
        .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(eq(authUser.id, otherUserId))
        .limit(1);

    return c.json(
      toFriendRequestSummary({
        avatarUrl: otherUser?.avatarUrl ?? null,
        createdAt: updatedRequest.createdAt,
        direction:
          updatedRequest.recipientUserId === user.id ? "incoming" : "outgoing",
        displayName:
          otherUser?.displayName ??
          otherUser?.name ??
          otherUser?.username ??
          null,
        message: updatedRequest.message,
        requestId: updatedRequest.id,
        status: updatedRequest.status,
        userId: otherUserId,
        username: otherUser?.username ?? null,
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

    const db = createDb(),
      [
        followRows,
        followerRows,
        sentFriendRows,
        receivedFriendRows,
        collaboratorRows,
      ] = await Promise.all([
        db
          .select({
            accountType: userProfiles.accountType,
            avatarUrl: userProfiles.avatarUrl,
            displayName: userProfiles.displayName,
            email: authUser.email,
            id: authUser.id,
            name: authUser.name,
            username: userProfiles.username,
          })
          .from(artistFollows)
          .innerJoin(authUser, eq(authUser.id, artistFollows.artistUserId))
          .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
          .where(eq(artistFollows.followerUserId, user.id))
          .limit(100),
        db
          .select({
            accountType: userProfiles.accountType,
            avatarUrl: userProfiles.avatarUrl,
            displayName: userProfiles.displayName,
            email: authUser.email,
            id: authUser.id,
            name: authUser.name,
            username: userProfiles.username,
          })
          .from(artistFollows)
          .innerJoin(authUser, eq(authUser.id, artistFollows.followerUserId))
          .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
          .where(eq(artistFollows.artistUserId, user.id))
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
            eq(authUser.id, artistFriendRequests.recipientUserId)
          )
          .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
          .where(
            and(
              eq(artistFriendRequests.status, "accepted"),
              eq(artistFriendRequests.requesterUserId, user.id)
            )
          )
          .limit(50),
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
            eq(authUser.id, artistFriendRequests.requesterUserId)
          )
          .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
          .where(
            and(
              eq(artistFriendRequests.status, "accepted"),
              eq(artistFriendRequests.recipientUserId, user.id)
            )
          )
          .limit(50),
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
      ]),
      friendRows = [...sentFriendRows, ...receivedFriendRows],
      friends = new Map<string, z.infer<typeof friendSummarySchema>>();

    for (const row of followRows) {
      friends.set(row.id, {
        avatarUrl: row.avatarUrl,
        email: row.email,
        id: row.id,
        lastInteractionAt: null,
        name: row.displayName ?? row.name ?? row.username ?? "SoundKit Artist",
        relationship: "following",
        role: row.accountType === "fan" ? "Fan" : "Artist",
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
        relationship: row.accountType === "fan" ? "fan" : "artist_follower",
        role: row.accountType === "fan" ? "Fan" : "Artist",
        username: row.username,
      });
    }

    for (const row of friendRows) {
      friends.set(row.id, {
        avatarUrl: row.avatarUrl,
        email: row.email,
        id: row.id,
        lastInteractionAt: toNullableIso(row.requestCreatedAt),
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
        lastInteractionAt: toNullableIso(row.createdAt),
        name: row.displayName ?? row.email ?? "Invited collaborator",
        relationship: "collaborator",
        role: row.role,
        username: row.username,
      });
    }

    friends.delete(user.id);
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
          participantId: null,
          participantName: null,
          participantUsername: null,
        })),
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      rows = await db
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
        .limit(100),
      conversationIds = rows.map((row) => row.id),
      unreadRows =
        conversationIds.length > 0
          ? await db
              .select({
                conversationId: messages.conversationId,
                unreadCount: sql<number>`count(*)::int`,
              })
              .from(messages)
              .innerJoin(
                conversationParticipants,
                and(
                  eq(
                    conversationParticipants.conversationId,
                    messages.conversationId
                  ),
                  eq(conversationParticipants.userId, user.id)
                )
              )
              .where(
                and(
                  inArray(messages.conversationId, conversationIds),
                  ne(messages.senderUserId, user.id),
                  or(
                    isNull(conversationParticipants.lastReadAt),
                    gt(messages.createdAt, conversationParticipants.lastReadAt)
                  )
                )
              )
              .groupBy(messages.conversationId)
          : [],
      unreadByConversationId = new Map(
        unreadRows.map((row) => [row.conversationId, row.unreadCount])
      ),
      otherParticipants =
        conversationIds.length > 0
          ? await db
              .select({
                artistStageName: artistProfiles.stageName,
                authAvatarUrl: authUser.image,
                authName: authUser.name,
                conversationId: conversationParticipants.conversationId,
                profileAvatarUrl: userProfiles.avatarUrl,
                profileDisplayName: userProfiles.displayName,
                userId: conversationParticipants.userId,
                username: userProfiles.username,
              })
              .from(conversationParticipants)
              .leftJoin(
                userProfiles,
                eq(userProfiles.userId, conversationParticipants.userId)
              )
              .leftJoin(
                artistProfiles,
                eq(artistProfiles.userId, conversationParticipants.userId)
              )
              .leftJoin(
                authUser,
                eq(authUser.id, conversationParticipants.userId)
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
          : [],
      participantByConversationId = new Map(
        otherParticipants.map((participant) => [
          participant.conversationId,
          participant,
        ])
      ),
      unreadEntries = rows.map((row) => ({
        conversationId: row.id,
        conversationType: row.conversationType,
        participantUserId:
          participantByConversationId.get(row.id)?.userId ?? null,
        unreadCount: unreadByConversationId.get(row.id) ?? 0,
      }));

    const summaries: z.infer<typeof conversationSummarySchema>[] = [];
    const seenDirectParticipantIds = new Set<string>();

    for (const row of rows) {
      const participant = participantByConversationId.get(row.id);
      const participantId = participant?.userId ?? null;

      // Deduplicate direct conversations by participant ID so each user only has 1 thread
      if (row.conversationType === "direct" && participantId) {
        if (seenDirectParticipantIds.has(participantId)) {
          continue;
        }
        seenDirectParticipantIds.add(participantId);
      }

      const participantName =
        participant?.artistStageName ??
        participant?.profileDisplayName ??
        participant?.authName ??
        participant?.username ??
        null;

      const participantAvatarUrl =
        participant?.profileAvatarUrl ?? participant?.authAvatarUrl ?? null;

      const displayTitle =
        row.title && row.title !== "Untitled conversation"
          ? row.title
          : (participantName ?? "Direct Message");

      const unreadCount = resolveConversationUnreadCount({
        conversationId: row.id,
        conversationType: row.conversationType,
        entries: unreadEntries,
        participantUserId: participantId,
      });

      summaries.push({
        conversationType: row.conversationType,
        id: row.id,
        participantAvatarUrl,
        participantId,
        participantName,
        participantUsername: participant?.username ?? null,
        title: displayTitle,
        unreadCount,
        updatedAt: toIso(row.updatedAt),
      });
    }

    return c.json(summaries, HttpStatusCodes.OK);
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

    const body = c.req.valid("json"),
      conversationType =
        body.participantUserIds.length > 1
          ? ("group" as const)
          : ("direct" as const),
      now = new Date();

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

    const db = createDb(),
      participantUserIds = [...new Set([user.id, ...body.participantUserIds])],
      requestedParticipantUserIds = participantUserIds.filter(
        (participantUserId) => participantUserId !== user.id
      ),
      [acceptedFriendRows, collaboratorRows] = await Promise.all([
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
      ]),
      allowedParticipantUserIds = new Set([
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

    // Reuse existing direct conversation if one already exists between the two users
    const [targetUserId] = requestedParticipantUserIds;
    if (conversationType === "direct" && targetUserId) {
      const directConvos = await db
        .select({
          id: conversations.id,
          title: conversations.title,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          eq(conversationParticipants.conversationId, conversations.id)
        )
        .where(
          and(
            eq(conversations.conversationType, "direct"),
            eq(conversationParticipants.userId, user.id)
          )
        )
        .orderBy(desc(conversations.updatedAt));

      if (directConvos.length > 0) {
        const convoIds = directConvos.map((convo) => convo.id);
        const [existingParticipant] = await db
          .select({
            conversationId: conversationParticipants.conversationId,
          })
          .from(conversationParticipants)
          .where(
            and(
              inArray(conversationParticipants.conversationId, convoIds),
              eq(conversationParticipants.userId, targetUserId)
            )
          )
          .limit(1);

        if (existingParticipant) {
          const existing = directConvos.find(
            (convo) => convo.id === existingParticipant.conversationId
          );

          const [participantProfile] = await db
            .select({
              artistName: artistProfiles.stageName,
              authAvatar: authUser.image,
              authName: authUser.name,
              profileAvatar: userProfiles.avatarUrl,
              profileName: userProfiles.displayName,
              username: userProfiles.username,
            })
            .from(conversationParticipants)
            .leftJoin(
              userProfiles,
              eq(userProfiles.userId, conversationParticipants.userId)
            )
            .leftJoin(
              artistProfiles,
              eq(artistProfiles.userId, conversationParticipants.userId)
            )
            .leftJoin(
              authUser,
              eq(authUser.id, conversationParticipants.userId)
            )
            .where(
              and(
                eq(
                  conversationParticipants.conversationId,
                  existingParticipant.conversationId
                ),
                eq(conversationParticipants.userId, targetUserId)
              )
            )
            .limit(1);

          const participantName =
            participantProfile?.artistName ??
            participantProfile?.profileName ??
            participantProfile?.authName ??
            participantProfile?.username ??
            null;

          return c.json(
            {
              conversationType: "direct" as const,
              id: existingParticipant.conversationId,
              participantAvatarUrl:
                participantProfile?.profileAvatar ??
                participantProfile?.authAvatar ??
                null,
              participantId: targetUserId,
              participantName,
              participantUsername: participantProfile?.username ?? null,
              title:
                existing?.title && existing.title !== "Untitled conversation"
                  ? existing.title
                  : (participantName ?? "Direct Message"),
              unreadCount: 0,
              updatedAt: toIso(existing?.updatedAt ?? now),
            },
            HttpStatusCodes.CREATED
          );
        }
      }
    }

    const conversationId = crypto.randomUUID();

    // Look up recipient details for new conversation title fallback
    let initialTitle = body.title ?? null;
    if (
      !initialTitle &&
      conversationType === "direct" &&
      requestedParticipantUserIds[0]
    ) {
      const [targetProfile] = await db
        .select({
          artistName: artistProfiles.stageName,
          authName: authUser.name,
          profileName: userProfiles.displayName,
          username: userProfiles.username,
        })
        .from(authUser)
        .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .leftJoin(artistProfiles, eq(artistProfiles.userId, authUser.id))
        .where(eq(authUser.id, requestedParticipantUserIds[0]))
        .limit(1);

      initialTitle =
        targetProfile?.artistName ??
        targetProfile?.profileName ??
        targetProfile?.authName ??
        targetProfile?.username ??
        null;
    }

    const [conversation] = await db
      .insert(conversations)
      .values({
        conversationType,
        createdByUserId: user.id,
        id: conversationId,
        title: initialTitle,
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
        participantId: requestedParticipantUserIds[0] ?? null,
        participantName: initialTitle,
        participantUsername: null,
        title: conversation?.title ?? initialTitle ?? "Direct Message",
        unreadCount: 0,
        updatedAt: toIso(conversation?.updatedAt ?? now),
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/conversations/{conversationId}/read",
    request: {
      params: z.object({
        conversationId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ readAt: z.string(), success: z.boolean() }),
        "Conversation marked read"
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

    const { conversationId } = c.req.valid("param"),
      readAt = new Date();

    if (!isDatabaseConfigured()) {
      return c.json(
        { readAt: readAt.toISOString(), success: true },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [participant] = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, user.id)
          )
        )
        .limit(1);

    if (!participant) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const [targetConversation] = await db
      .select({ conversationType: conversations.conversationType })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    let conversationIdsToMark = [conversationId];

    if (targetConversation?.conversationType === "direct") {
      const [otherParticipant] = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            ne(conversationParticipants.userId, user.id)
          )
        )
        .limit(1);

      if (otherParticipant?.userId) {
        const userDirectConversations = await db
          .select({ id: conversations.id })
          .from(conversations)
          .innerJoin(
            conversationParticipants,
            eq(conversationParticipants.conversationId, conversations.id)
          )
          .where(
            and(
              eq(conversations.conversationType, "direct"),
              eq(conversationParticipants.userId, user.id)
            )
          );
        if (userDirectConversations.length > 0) {
          const candidateIds = userDirectConversations.map(({ id }) => id),
            matchingConversations = await db
              .select({
                conversationId: conversationParticipants.conversationId,
              })
              .from(conversationParticipants)
              .where(
                and(
                  inArray(
                    conversationParticipants.conversationId,
                    candidateIds
                  ),
                  eq(conversationParticipants.userId, otherParticipant.userId)
                )
              );
          if (matchingConversations.length > 0) {
            conversationIdsToMark = [
              ...new Set(
                matchingConversations.map(({ conversationId: id }) => id)
              ),
            ];
          }
        }
      }
    }

    await Promise.all([
      db
        .update(conversationParticipants)
        .set({ lastReadAt: readAt })
        .where(
          and(
            inArray(
              conversationParticipants.conversationId,
              conversationIdsToMark
            ),
            eq(conversationParticipants.userId, user.id)
          )
        ),
      db
        .update(userNotifications)
        .set({ read: true })
        .where(
          and(
            eq(userNotifications.userId, user.id),
            eq(userNotifications.type, "chat_message"),
            inArray(
              userNotifications.link,
              conversationIdsToMark.map(
                (id) =>
                  `/dashboard/messages?conversationId=${encodeURIComponent(id)}`
              )
            )
          )
        ),
    ]);

    return c.json(
      { readAt: readAt.toISOString(), success: true },
      HttpStatusCodes.OK
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
        "Messages in conversation"
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

    const { conversationId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(
        sampleMessages.map((message) => ({ ...message, attachments: [] })),
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      participantRows = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, user.id)
          )
        )
        .limit(1);

    if (participantRows.length === 0) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const [targetConvo] = await db
      .select({
        conversationType: conversations.conversationType,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    let convoIdsToFetch = [conversationId];

    if (targetConvo?.conversationType === "direct") {
      const [otherParticipantRow] = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            ne(conversationParticipants.userId, user.id)
          )
        )
        .limit(1);

      if (otherParticipantRow?.userId) {
        const userDirectConvos = await db
          .select({ id: conversations.id })
          .from(conversations)
          .innerJoin(
            conversationParticipants,
            eq(conversationParticipants.conversationId, conversations.id)
          )
          .where(
            and(
              eq(conversations.conversationType, "direct"),
              eq(conversationParticipants.userId, user.id)
            )
          );

        if (userDirectConvos.length > 0) {
          const directIds = userDirectConvos.map((convo) => convo.id);
          const matchingConvos = await db
            .select({
              conversationId: conversationParticipants.conversationId,
            })
            .from(conversationParticipants)
            .where(
              and(
                inArray(conversationParticipants.conversationId, directIds),
                eq(conversationParticipants.userId, otherParticipantRow.userId)
              )
            );

          if (matchingConvos.length > 0) {
            convoIdsToFetch = [
              ...new Set(matchingConvos.map((item) => item.conversationId)),
            ];
          }
        }
      }
    }

    const rows = await db
        .select({
          body: messages.body,
          createdAt: messages.createdAt,
          id: messages.id,
          senderUserId: messages.senderUserId,
          status: messages.status,
        })
        .from(messages)
        .where(inArray(messages.conversationId, convoIdsToFetch))
        .orderBy(asc(messages.createdAt), asc(messages.id))
        .limit(200),
      messageIds = rows.map((row) => row.id),
      attachmentRows =
        messageIds.length > 0
          ? await db
              .select({
                displayName: messageAttachments.displayName,
                id: messageAttachments.id,
                messageId: messageAttachments.messageId,
                mimeType: messageAttachments.mimeType,
                objectKey: messageAttachments.objectKey,
                sizeBytes: messageAttachments.sizeBytes,
                sourceProjectId: messageAttachments.sourceProjectId,
                sourceTrackId: messageAttachments.sourceTrackId,
                url: messageAttachments.url,
              })
              .from(messageAttachments)
              .where(inArray(messageAttachments.messageId, messageIds))
          : [],
      attachmentsByMessageId = new Map<string, typeof attachmentRows>();

    for (const attachment of attachmentRows) {
      const current = attachmentsByMessageId.get(attachment.messageId) ?? [];
      current.push(attachment);
      attachmentsByMessageId.set(attachment.messageId, current);
    }

    return c.json(
      rows.map((message) => ({
        attachments: (attachmentsByMessageId.get(message.id) ?? []).map(
          (attachment) => ({
            displayName: attachment.displayName,
            id: attachment.id,
            mimeType: attachment.mimeType,
            objectKey: attachment.objectKey,
            sizeBytes: attachment.sizeBytes,
            sourceProjectId: attachment.sourceProjectId,
            sourceTrackId: attachment.sourceTrackId,
            url: attachment.url,
          })
        ),
        body: message.body,
        createdAt: toIso(message.createdAt),
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
      [HttpStatusCodes.CREATED]: jsonContent(
        messageSchema,
        "Message sent in conversation"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid message attachment"
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

    const { conversationId } = c.req.valid("param"),
      body = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      const createdMessage = {
        attachments: body.attachments.map((attachment) => ({
          displayName: attachment.displayName,
          id: crypto.randomUUID(),
          mimeType: attachment.mimeType ?? null,
          objectKey: attachment.objectKey ?? null,
          sizeBytes: attachment.sizeBytes ?? null,
          sourceProjectId: attachment.sourceProjectId ?? null,
          sourceTrackId: attachment.sourceTrackId ?? null,
          url: attachment.url,
        })),
        body: body.body,
        createdAt: new Date().toISOString(),
        id: `mock-${Date.now()}`,
        senderId: user.id,
        status: "sent" as const,
      };

      return c.json(createdMessage, HttpStatusCodes.CREATED);
    }

    const db = createDb(),
      participantRows = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, user.id)
          )
        )
        .limit(1);

    if (participantRows.length === 0) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const messageId = body.clientMessageId ?? crypto.randomUUID(),
      [existingMessage] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, messageId),
            eq(messages.conversationId, conversationId),
            eq(messages.senderUserId, user.id)
          )
        )
        .limit(1);

    if (existingMessage) {
      const existingAttachments = await db
        .select()
        .from(messageAttachments)
        .where(eq(messageAttachments.messageId, messageId));
      return c.json(
        {
          attachments: existingAttachments.map(
            ({ messageId: _, ...attachment }) => attachment
          ),
          body: existingMessage.body,
          createdAt: toIso(existingMessage.createdAt),
          id: existingMessage.id,
          senderId: existingMessage.senderUserId,
          status: existingMessage.status,
        },
        HttpStatusCodes.CREATED
      );
    }

    const attachmentObjectKeys = body.attachments
        .map((attachment) => attachment.objectKey)
        .filter((objectKey): objectKey is string => Boolean(objectKey));
    if (
      attachmentObjectKeys.some(
        (objectKey) => !objectKey.startsWith(`uploads/${user.id}/`)
      )
    ) {
      return c.json(
        { message: "A message attachment does not belong to this user." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    for (const objectKey of attachmentObjectKeys) {
      await claimUploadIntent({
        entityId: messageId,
        entityType: "message_attachment",
        objectKey,
        userId: user.id,
      });
    }

    const now = new Date(),
      [message] = await db
        .insert(messages)
        .values({
          body: body.body,
          conversationId,
          createdAt: now,
          id: messageId,
          senderUserId: user.id,
          status: "sent",
        })
        .onConflictDoNothing()
        .returning(),
      attachments =
        body.attachments.length > 0
          ? await db
              .insert(messageAttachments)
              .values(
                body.attachments.map((attachment) => ({
                  displayName: attachment.displayName,
                  id: crypto.randomUUID(),
                  messageId,
                  mimeType: attachment.mimeType ?? null,
                  objectKey: attachment.objectKey ?? null,
                  sizeBytes: attachment.sizeBytes ?? null,
                  sourceProjectId: attachment.sourceProjectId ?? null,
                  sourceTrackId: attachment.sourceTrackId ?? null,
                  url: attachment.url,
                }))
              )
              .returning()
          : [];

    for (const objectKey of attachmentObjectKeys) {
      await completeUploadIntent({
        entityId: messageId,
        entityType: "message_attachment",
        objectKey,
        userId: user.id,
      });
    }

    await db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, conversationId));

    const otherParticipants = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          ne(conversationParticipants.userId, user.id)
        )
      );

    for (const participant of otherParticipants) {
      await notify(
        {
          actorUserId: user.id,
          aggregationKey: `message:${conversationId}:${participant.userId}`,
          data: {
            actorName: user.name ?? "Someone",
            conversationId,
            messageId,
            preview: body.body || "Sent an attachment",
          },
          entity: { id: conversationId, type: "conversation" },
          eventId: messageId,
          recipientUserId: participant.userId,
          type: "message.received",
        },
        {
          emailQueue: c.env.EMAIL_DELIVERY_QUEUE,
          notificationQueue: c.env.NOTIFICATION_QUEUE,
        }
      );
    }

    return c.json(
      {
        attachments: attachments.map(
          ({ messageId: _, ...attachment }) => attachment
        ),
        body: message?.body ?? body.body,
        createdAt: toIso(message?.createdAt ?? new Date()),
        id: messageId,
        senderId: message?.senderUserId ?? user.id,
        status: message?.status ?? ("sent" as const),
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/conversations/{conversationId}/collaborations",
    request: {
      body: jsonContentRequired(
        z.object({
          initialTracks: z.array(z.string()).optional(),
          isProjectLevel: z.boolean().optional(),
          kind: z.enum(["project", "track"]).default("project").optional(),
          projectType: z.enum(["album", "ep", "single"]).optional(),
          title: z.string().trim().min(1).max(160),
        }),
        "Collaboration workspace"
      ),
      params: z.object({ conversationId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        z.object({
          href: z.string(),
          id: z.string(),
          kind: z.enum(["project", "track"]),
        }),
        "Collaboration created"
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

    const { conversationId } = c.req.valid("param"),
      body = c.req.valid("json"),
      kind = body.kind ?? "project",
      db = createDb(),
      [convRow] = await db
        .select({
          conversationType: conversations.conversationType,
        })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1),
      participants = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));

    if (!participants.some((participant) => participant.userId === user.id)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    let collaboratorIds = participants
      .map((participant) => participant.userId)
      .filter((participantId) => participantId !== user.id);

    if (
      collaboratorIds.length === 0 &&
      convRow?.conversationType === "direct"
    ) {
      const otherConvoParticipants = await db
        .select({
          userId: conversationParticipants.userId,
        })
        .from(conversationParticipants)
        .innerJoin(
          conversations,
          eq(conversations.id, conversationParticipants.conversationId)
        )
        .where(
          and(
            eq(conversations.conversationType, "direct"),
            ne(conversationParticipants.userId, user.id)
          )
        )
        .limit(1);

      if (otherConvoParticipants[0]?.userId) {
        collaboratorIds = [otherConvoParticipants[0].userId];
      }
    }

    const workspaceId = crypto.randomUUID(),
      href =
        kind === "project"
          ? `/dashboard/projects/${workspaceId}`
          : `/dashboard/tracks/${workspaceId}`;

    if (kind === "project") {
      await db.insert(projects).values({
        description: "Shared collaboration started from SoundKit Messages.",
        id: workspaceId,
        isPublic: false,
        ownerUserId: user.id,
        projectType: body.projectType ?? "single",
        slug: `collaboration-${workspaceId}`,
        status: "draft",
        title: body.title,
      });
      if (collaboratorIds.length > 0) {
        await db.insert(projectCollaborators).values(
          collaboratorIds.map((collaboratorUserId) => ({
            canDelete: false,
            canEdit: true,
            canUpload: true,
            collaboratorRole: "artist" as const,
            collaboratorUserId,
            id: crypto.randomUUID(),
            invitationStatus: "accepted" as const,
            invitedByUserId: user.id,
            projectId: workspaceId,
          }))
        );
      }
    } else {
      await db.insert(tracks).values({
        catalogItemType: "single",
        id: workspaceId,
        isPublic: false,
        ownerUserId: user.id,
        productionStatus: "demo",
        releaseStrategy: "private",
        slug: `collaboration-${workspaceId}`,
        title: body.title,
      });
      if (collaboratorIds.length > 0) {
        await db.insert(trackCollaborators).values(
          collaboratorIds.map((collaboratorUserId) => ({
            canDelete: false,
            canEdit: true,
            canUpload: true,
            collaboratorRole: "artist" as const,
            collaboratorUserId,
            id: crypto.randomUUID(),
            invitationStatus: "accepted" as const,
            invitedByUserId: user.id,
            trackId: workspaceId,
          }))
        );
      }
    }

    const messageId = crypto.randomUUID();
    await db.insert(messages).values({
      body: `Started shared ${kind}: ${body.title} · ${href}`,
      conversationId,
      id: messageId,
      senderUserId: user.id,
    });
    await db.insert(messageAttachments).values({
      displayName: body.title,
      id: crypto.randomUUID(),
      messageId,
      mimeType: "soundkit/collaboration-proposal",
      objectKey: null,
      sizeBytes: null,
      sourceProjectId: kind === "project" ? workspaceId : null,
      sourceTrackId: kind === "track" ? workspaceId : null,
      url: href,
    });

    for (const collaboratorId of collaboratorIds) {
      await notify(
        {
          actorUserId: user.id,
          data: {
            actionPath: href,
            actorName: user.name ?? "An artist",
            workTitle: body.title,
            workType: kind,
          },
          entity: { id: workspaceId, type: kind },
          eventId: workspaceId,
          recipientUserId: collaboratorId,
          type: "collaboration.invited",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }

    return c.json({ href, id: workspaceId, kind }, HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/conversations/{conversationId}/collaborations/{collaborationId}/respond",
    request: {
      body: jsonContentRequired(
        z.object({
          action: z.enum(["accept", "decline", "cancel"]),
        }),
        "Collaboration response action"
      ),
      params: z.object({
        collaborationId: z.string(),
        conversationId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          action: z.enum(["accept", "decline", "cancel"]),
          href: z.string(),
          status: z.string(),
          success: z.boolean(),
        }),
        "Collaboration status updated"
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

    const { collaborationId, conversationId } = c.req.valid("param"),
      { action } = c.req.valid("json"),
      db = createDb(),
      [project] = await db
        .select({
          id: projects.id,
          ownerUserId: projects.ownerUserId,
          title: projects.title,
        })
        .from(projects)
        .where(eq(projects.id, collaborationId))
        .limit(1),
      [track] = project
        ? [null]
        : await db
            .select({
              id: tracks.id,
              ownerUserId: tracks.ownerUserId,
              title: tracks.title,
            })
            .from(tracks)
            .where(eq(tracks.id, collaborationId))
            .limit(1),
      ownerUserId = project?.ownerUserId ?? track?.ownerUserId,
      workTitle = project?.title ?? track?.title ?? "collaboration",
      workType = project ? ("project" as const) : ("track" as const),
      href =
        workType === "project"
          ? `/dashboard/projects/${collaborationId}`
          : `/dashboard/tracks/${collaborationId}`;

    if (action === "accept") {
      await db
        .update(projectCollaborators)
        .set({ invitationStatus: "accepted" })
        .where(
          and(
            eq(projectCollaborators.projectId, collaborationId),
            eq(projectCollaborators.collaboratorUserId, user.id)
          )
        );
      await db
        .update(trackCollaborators)
        .set({ invitationStatus: "accepted" })
        .where(
          and(
            eq(trackCollaborators.trackId, collaborationId),
            eq(trackCollaborators.collaboratorUserId, user.id)
          )
        );
      await db.insert(messages).values({
        body: `Accepted collaboration! Workspace unlocked · ${href}`,
        conversationId,
        id: crypto.randomUUID(),
        senderUserId: user.id,
      });

      if (ownerUserId) {
        await notify(
          {
            actorUserId: user.id,
            data: {
              actionPath: href,
              actorName: user.name ?? "An artist",
              workTitle,
              workType,
            },
            entity: { id: collaborationId, type: workType },
            eventId: collaborationId,
            recipientUserId: ownerUserId,
            type: "collaboration.accepted",
          },
          { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
        );
      }
    } else if (action === "decline" || action === "cancel") {
      const attachmentRows = await db
        .select({ messageId: messageAttachments.messageId })
        .from(messageAttachments)
        .where(
          or(
            eq(messageAttachments.sourceProjectId, collaborationId),
            eq(messageAttachments.sourceTrackId, collaborationId)
          )
        );
      const messageIdsToDelete = attachmentRows
        .map((a) => a.messageId)
        .filter(Boolean);
      if (messageIdsToDelete.length > 0) {
        await db
          .delete(messageAttachments)
          .where(inArray(messageAttachments.messageId, messageIdsToDelete));
        await db
          .delete(messages)
          .where(inArray(messages.id, messageIdsToDelete));
      }

      await db
        .delete(projectCollaborators)
        .where(eq(projectCollaborators.projectId, collaborationId));
      await db.delete(projects).where(eq(projects.id, collaborationId));
      await db
        .delete(trackCollaborators)
        .where(eq(trackCollaborators.trackId, collaborationId));
      await db.delete(tracks).where(eq(tracks.id, collaborationId));

      await db.insert(messages).values({
        body:
          action === "cancel"
            ? "Cancelled collaboration invite."
            : "Declined collaboration proposal.",
        conversationId,
        id: crypto.randomUUID(),
        senderUserId: user.id,
      });

      if (action === "decline" && ownerUserId) {
        await notify(
          {
            actorUserId: user.id,
            data: {
              actionPath: "/dashboard/messages",
              actorName: user.name ?? "An artist",
              workTitle,
              workType,
            },
            entity: { id: collaborationId, type: workType },
            eventId: collaborationId,
            recipientUserId: ownerUserId,
            type: "collaboration.declined",
          },
          { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
        );
      }
    }

    return c.json(
      { action, href, status: action, success: true },
      HttpStatusCodes.OK
    );
  }
);

export default app;
