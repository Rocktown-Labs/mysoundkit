/* eslint-disable complexity, no-nested-ternary, sort-vars, one-var */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistFriendRequests,
  userFollows,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, desc, eq, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { mergeNetworkPerson, sortNetworkPeople } from "@/lib/network-domain";
import type { NetworkPersonState } from "@/lib/network-domain";
import { messageResponseSchema, networkResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const toPerson = (row: {
  accountType: "artist" | "fan";
  avatarUrl: string | null;
  email: string | null;
  id: string;
  name: string | null;
  username: string | null;
}): NetworkPersonState => ({
  accountType: row.accountType,
  avatarUrl: row.avatarUrl,
  canMessage: false,
  email: row.email,
  followsYou: false,
  id: row.id,
  isFollowing: false,
  isFriend: false,
  name: row.name ?? row.username ?? row.email ?? "SoundKit User",
  username: row.username,
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(networkResponseSchema, "Network"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Network"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        {
          counts: {
            artistFollowers: 0,
            fanFollowers: 0,
            followers: 0,
            following: 0,
            friends: 0,
            pendingRequests: 0,
          },
          followers: [],
          following: [],
          friends: [],
          requests: [],
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const personSelection = {
      accountType: userProfiles.accountType,
      avatarUrl: userProfiles.avatarUrl,
      email: authUser.email,
      id: authUser.id,
      name: authUser.name,
      username: userProfiles.username,
    } as const;
    const [
      followingUserRows,
      followingArtistRows,
      followerUserRows,
      followerArtistRows,
      friendRows,
      requestRows,
    ] = await Promise.all([
      db
        .select(personSelection)
        .from(userFollows)
        .innerJoin(authUser, eq(authUser.id, userFollows.targetUserId))
        .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(eq(userFollows.followerUserId, user.id)),
      db
        .select(personSelection)
        .from(artistFollows)
        .innerJoin(authUser, eq(authUser.id, artistFollows.artistUserId))
        .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(eq(artistFollows.followerUserId, user.id)),
      db
        .select(personSelection)
        .from(userFollows)
        .innerJoin(authUser, eq(authUser.id, userFollows.followerUserId))
        .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(eq(userFollows.targetUserId, user.id)),
      db
        .select(personSelection)
        .from(artistFollows)
        .innerJoin(authUser, eq(authUser.id, artistFollows.followerUserId))
        .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(eq(artistFollows.artistUserId, user.id)),
      db
        .select(personSelection)
        .from(artistFriendRequests)
        .innerJoin(
          authUser,
          eq(
            authUser.id,
            sql`case when ${artistFriendRequests.requesterUserId} = ${user.id} then ${artistFriendRequests.recipientUserId} else ${artistFriendRequests.requesterUserId} end`
          )
        )
        .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(
          and(
            eq(artistFriendRequests.status, "accepted"),
            or(
              eq(artistFriendRequests.requesterUserId, user.id),
              eq(artistFriendRequests.recipientUserId, user.id)
            )
          )
        ),
      db
        .select({
          ...personSelection,
          createdAt: artistFriendRequests.createdAt,
          direction: sql<
            "incoming" | "outgoing"
          >`case when ${artistFriendRequests.recipientUserId} = ${user.id} then 'incoming' else 'outgoing' end`,
          message: artistFriendRequests.message,
          recipientUserId: artistFriendRequests.recipientUserId,
          requestId: artistFriendRequests.id,
          requesterUserId: artistFriendRequests.requesterUserId,
          status: artistFriendRequests.status,
        })
        .from(artistFriendRequests)
        .innerJoin(
          authUser,
          eq(
            authUser.id,
            sql`case when ${artistFriendRequests.requesterUserId} = ${user.id} then ${artistFriendRequests.recipientUserId} else ${artistFriendRequests.requesterUserId} end`
          )
        )
        .innerJoin(userProfiles, eq(userProfiles.userId, authUser.id))
        .where(
          or(
            eq(artistFriendRequests.requesterUserId, user.id),
            eq(artistFriendRequests.recipientUserId, user.id)
          )
        )
        .orderBy(desc(artistFriendRequests.createdAt))
        .limit(100),
    ]);

    const people = new Map<string, NetworkPersonState>();
    for (const row of followingUserRows) {
      mergeNetworkPerson(people, toPerson(row), { isFollowing: true });
    }
    for (const row of followingArtistRows) {
      mergeNetworkPerson(people, toPerson(row), { isFollowing: true });
    }
    for (const row of followerUserRows) {
      mergeNetworkPerson(people, toPerson(row), { followsYou: true });
    }
    for (const row of followerArtistRows) {
      mergeNetworkPerson(people, toPerson(row), { followsYou: true });
    }
    for (const row of friendRows) {
      mergeNetworkPerson(
        people,
        { ...toPerson(row), canMessage: true },
        { isFriend: true }
      );
    }

    const requestItems = requestRows.map((row) => ({
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt.toISOString(),
      direction: row.direction,
      displayName: row.name ?? row.username ?? "SoundKit Artist",
      id: row.requestId,
      message: row.message,
      status: row.status,
      userId:
        row.recipientUserId === user.id
          ? row.requesterUserId
          : row.recipientUserId,
      username: row.username,
    }));
    const allPeople = sortNetworkPeople(people.values());
    const followers = allPeople.filter((person) => person.followsYou);
    const following = allPeople.filter((person) => person.isFollowing);
    const friends = allPeople.filter((person) => person.isFriend);
    const pendingRequests = requestItems.filter(
      (request) => request.status === "pending"
    );

    return c.json(
      {
        counts: {
          artistFollowers: followers.filter(
            (person) => person.accountType === "artist"
          ).length,
          fanFollowers: followers.filter(
            (person) => person.accountType === "fan"
          ).length,
          followers: followers.length,
          following: following.length,
          friends: friends.length,
          pendingRequests: pendingRequests.length,
        },
        followers,
        following,
        friends,
        requests: requestItems,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
