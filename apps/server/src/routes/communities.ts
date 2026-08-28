/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls, unicorn/no-await-expression-member */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  notificationSettings,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import {
  communities,
  communityBans,
  communityMembers,
  communityMessages,
  communityPosts,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import { and, asc, count, desc, eq, inArray, max } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { canAccessCommunity } from "@/lib/community-access";
import { loadCommunitySchemaCapabilities } from "@/lib/community-schema-capabilities";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { isSellerEnabled } from "@/lib/seller";
import type {
  AppEnv,
  AuthenticatedSession,
  AuthenticatedUser,
} from "@/lib/types";
import { resolveActiveOrganizationId, slugify } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  messageSchema = z.object({ message: z.string() }),
  communitySchema = z.object({
    artist: z.object({
      avatarUrl: z.string().nullable(),
      name: z.string(),
      username: z.string(),
    }),
    artistUserId: z.string(),
    coverImageUrl: z.string().nullable(),
    currency: z.string(),
    description: z.string().nullable(),
    genre: z
      .object({ id: z.string(), name: z.string(), slug: z.string() })
      .nullable(),
    id: z.string(),
    isMember: z.boolean(),
    isOwner: z.boolean(),
    memberCount: z.number().int().nonnegative(),
    monthlyPriceCents: z.number().int().nonnegative(),
    name: z.string(),
    slug: z.string(),
    updatedAt: z.string(),
  }),
  priceSchema = z
    .number()
    .int()
    .nonnegative()
    .refine((value) => value === 0 || (value >= 299 && value <= 9999), {
      message: "Choose free or a monthly price between $2.99 and $99.99.",
    }),
  communityInputSchema = z.object({
    coverImageUrl: z.url().nullable().optional(),
    description: z.string().max(2000).optional(),
    genreId: z.string().nullable().optional(),
    monthlyPriceCents: priceSchema,
    name: z.string().trim().min(1).max(100),
  }),
  communityListQuerySchema = z.object({
    access: z.enum(["all", "free", "paid"]).default("all"),
    genre: z.string().default("all"),
    q: z.string().trim().max(120).default(""),
    sort: z
      .enum(["activity-desc", "members-desc", "newest-desc", "name-asc"])
      .default("activity-desc"),
  }),
  createPostSchema = z.object({
    body: z.string().max(10_000).optional(),
    mediaUrl: z.url().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    postType: z
      .enum(["text", "image", "audio", "video", "poll"])
      .default("text"),
  }),
  communityAuthorSchema = z.object({
    avatarUrl: z.string().nullable(),
    name: z.string(),
    username: z.string(),
  }),
  communityPostSchema = createPostSchema.extend({
    author: communityAuthorSchema,
    body: z.string().nullable(),
    createdAt: z.string(),
    id: z.string(),
    isPinned: z.boolean(),
    mediaUrl: z.string().nullable(),
    metadata: z.unknown().nullable(),
    userId: z.string(),
  }),
  createMessageSchema = z.object({
    body: z.string().trim().min(1).max(2000),
    clientMessageId: z.string().min(1).max(100).optional(),
  }),
  communityMessageSchema = z.object({
    author: communityAuthorSchema,
    body: z.string(),
    createdAt: z.string(),
    id: z.string(),
    userId: z.string(),
  }),
  communityMemberSchema = z.object({
    avatarUrl: z.string().nullable(),
    joinedAt: z.string(),
    name: z.string(),
    role: z.enum(["owner", "moderator", "member"]),
    userId: z.string(),
    username: z.string(),
  }),
  communityBanSchema = z.object({
    avatarUrl: z.string().nullable(),
    bannedAt: z.string(),
    name: z.string(),
    reason: z.string().nullable(),
    userId: z.string(),
    username: z.string(),
  }),
  routeParams = z.object({ communityId: z.string().min(1) }),
  memberRouteParams = routeParams.extend({ userId: z.string().min(1) }),
  fallbackAuthor = (userId: string) => ({
    avatarUrl: null,
    name: "SoundKit member",
    username: userId,
  });

type CommunityListQuery = z.infer<typeof communityListQuerySchema>;

const requireCommunityOwner = async ({
    communityId,
    userId,
  }: {
    communityId: string;
    userId: string;
  }) => {
    if (!isDatabaseConfigured()) {
      return false;
    }
    const [community] = await createDb()
      .select({ id: communities.id })
      .from(communities)
      .where(
        and(
          eq(communities.id, communityId),
          eq(communities.artistUserId, userId)
        )
      )
      .limit(1);
    return Boolean(community);
  },
  ensurePaidCommunityEligibility = async ({
    session,
    user,
  }: {
    session: AuthenticatedSession | null;
    user: AuthenticatedUser;
  }) => {
    const entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
    return (
      entitlements.canOperatePaidCommunity &&
      (await isSellerEnabled({ organizationId, userId: user.id }))
    );
  },
  loadCommunities = async ({
    currentUserId,
    filters,
  }: {
    currentUserId?: string;
    filters: CommunityListQuery;
  }) => {
    const db = createDb(),
      capabilities = await loadCommunitySchemaCapabilities(),
      rows = capabilities.discovery
        ? await db
            .select({
              artistAvatarUrl: userProfiles.avatarUrl,
              artistName: userProfiles.displayName,
              artistUsername: userProfiles.username,
              community: communities,
              genreId: genres.id,
              genreName: genres.name,
              genreSlug: genres.slug,
            })
            .from(communities)
            .innerJoin(
              userProfiles,
              eq(userProfiles.userId, communities.artistUserId)
            )
            .leftJoin(genres, eq(genres.id, communities.genreId))
            .where(eq(communities.isActive, true))
        : (
            await db
              .select({
                artistAvatarUrl: userProfiles.avatarUrl,
                artistName: userProfiles.displayName,
                artistUsername: userProfiles.username,
                community: {
                  artistUserId: communities.artistUserId,
                  createdAt: communities.createdAt,
                  currency: communities.currency,
                  description: communities.description,
                  id: communities.id,
                  isActive: communities.isActive,
                  monthlyPriceCents: communities.monthlyPriceCents,
                  name: communities.name,
                  slug: communities.slug,
                  stripePriceId: communities.stripePriceId,
                  updatedAt: communities.updatedAt,
                },
              })
              .from(communities)
              .innerJoin(
                userProfiles,
                eq(userProfiles.userId, communities.artistUserId)
              )
              .where(eq(communities.isActive, true))
          ).map((row) => ({
            ...row,
            community: {
              ...row.community,
              coverImageUrl: null,
              genreId: null,
            },
            genreId: null,
            genreName: null,
            genreSlug: null,
          })),
      communityIds = rows.map(({ community }) => community.id),
      memberRows =
        communityIds.length === 0
          ? []
          : await db
              .select({
                communityId: communityMembers.communityId,
                value: count(),
              })
              .from(communityMembers)
              .where(inArray(communityMembers.communityId, communityIds))
              .groupBy(communityMembers.communityId),
      activityRows =
        communityIds.length === 0
          ? []
          : await db
              .select({
                communityId: communityMessages.communityId,
                value: max(communityMessages.createdAt),
              })
              .from(communityMessages)
              .where(inArray(communityMessages.communityId, communityIds))
              .groupBy(communityMessages.communityId),
      myMemberships =
        !currentUserId || communityIds.length === 0
          ? []
          : await db
              .select({ communityId: communityMembers.communityId })
              .from(communityMembers)
              .where(
                and(
                  eq(communityMembers.userId, currentUserId),
                  inArray(communityMembers.communityId, communityIds)
                )
              ),
      memberCountByCommunity = new Map(
        memberRows.map((row) => [row.communityId, Number(row.value)])
      ),
      activityByCommunity = new Map(
        activityRows.map((row) => [row.communityId, row.value])
      ),
      myCommunityIds = new Set(
        myMemberships.map((membership) => membership.communityId)
      ),
      query = filters.q.toLocaleLowerCase(),
      items = rows
        .map((row) => {
          const latestActivity =
            activityByCommunity.get(row.community.id) ??
            row.community.updatedAt;
          return {
            artist: {
              avatarUrl: row.artistAvatarUrl,
              name: row.artistName ?? row.community.name,
              username: row.artistUsername,
            },
            artistUserId: row.community.artistUserId,
            coverImageUrl: row.community.coverImageUrl,
            currency: row.community.currency,
            description: row.community.description,
            genre:
              row.genreId && row.genreName && row.genreSlug
                ? { id: row.genreId, name: row.genreName, slug: row.genreSlug }
                : null,
            id: row.community.id,
            isMember:
              row.community.artistUserId === currentUserId ||
              myCommunityIds.has(row.community.id),
            isOwner: row.community.artistUserId === currentUserId,
            memberCount: memberCountByCommunity.get(row.community.id) ?? 0,
            monthlyPriceCents: row.community.monthlyPriceCents,
            name: row.community.name,
            slug: row.community.slug,
            updatedAt: latestActivity.toISOString(),
          };
        })
        .filter((community) => {
          const matchesQuery =
              query.length === 0 ||
              community.name.toLocaleLowerCase().includes(query) ||
              community.artist.name.toLocaleLowerCase().includes(query) ||
              community.description?.toLocaleLowerCase().includes(query),
            matchesGenre =
              filters.genre === "all" ||
              community.genre?.slug === filters.genre,
            matchesAccess =
              filters.access === "all" ||
              (filters.access === "free"
                ? community.monthlyPriceCents === 0
                : community.monthlyPriceCents > 0);
          return Boolean(matchesQuery && matchesGenre && matchesAccess);
        });

    items.sort((left, right) => {
      if (filters.sort === "members-desc") {
        return right.memberCount - left.memberCount;
      }
      if (filters.sort === "newest-desc") {
        return right.id.localeCompare(left.id);
      }
      if (filters.sort === "name-asc") {
        return left.name.localeCompare(right.name);
      }
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
    return items;
  },
  loadCommunityAuthors = async (userIds: string[]) => {
    if (userIds.length === 0) {
      return new Map<string, ReturnType<typeof fallbackAuthor>>();
    }
    const profiles = await createDb()
      .select({
        avatarUrl: userProfiles.avatarUrl,
        name: userProfiles.displayName,
        userId: userProfiles.userId,
        username: userProfiles.username,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, [...new Set(userIds)]));
    return new Map(
      profiles.map((profile) => [
        profile.userId,
        {
          avatarUrl: profile.avatarUrl,
          name: profile.name ?? profile.username,
          username: profile.username,
        },
      ])
    );
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: communityListQuerySchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        communitySchema.array(),
        "Community list"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }
    const user = c.get("user");
    return c.json(
      await loadCommunities({
        currentUserId: isAuthenticatedUser(user) ? user.id : undefined,
        filters: c.req.valid("query"),
      }),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(communityInputSchema, "Community payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(communitySchema, "Community"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageSchema,
        "Artist or paid-community eligibility required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageSchema,
        "Authentication required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Community storage is not configured." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const db = createDb(),
      [profile] = await db
        .select({
          accountType: userProfiles.accountType,
          genreId: artistProfiles.primaryGenreId,
        })
        .from(userProfiles)
        .leftJoin(
          artistProfiles,
          eq(artistProfiles.userId, userProfiles.userId)
        )
        .where(eq(userProfiles.userId, user.id))
        .limit(1),
      body = c.req.valid("json"),
      capabilities = await loadCommunitySchemaCapabilities();
    if (profile?.accountType !== "artist") {
      return c.json(
        { message: "Complete artist onboarding before creating a community." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (
      body.monthlyPriceCents > 0 &&
      !(await ensurePaidCommunityEligibility({
        session: c.get("session"),
        user,
      }))
    ) {
      return c.json(
        {
          message:
            "Premium community access and an enabled payout account are required to charge members.",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const row = {
      artistUserId: user.id,
      coverImageUrl: body.coverImageUrl ?? null,
      description: body.description ?? null,
      genreId: body.genreId ?? profile.genreId ?? null,
      id: crypto.randomUUID(),
      monthlyPriceCents: body.monthlyPriceCents,
      name: body.name,
      slug: `${slugify(body.name)}-${user.id.slice(0, 6)}`,
    };
    const communityInsert = capabilities.discovery
      ? row
      : {
          artistUserId: row.artistUserId,
          description: row.description,
          id: row.id,
          monthlyPriceCents: row.monthlyPriceCents,
          name: row.name,
          slug: row.slug,
        };
    await db.transaction(async (transaction) => {
      await transaction.insert(communities).values(communityInsert);
      await transaction.insert(communityMembers).values({
        communityId: row.id,
        role: "owner",
        userId: user.id,
      });
    });
    const created = (
      await loadCommunities({
        currentUserId: user.id,
        filters: {
          access: "all",
          genre: "all",
          q: "",
          sort: "newest-desc",
        },
      })
    ).find((community) => community.id === row.id);
    if (!created) {
      throw new Error("Created community could not be loaded.");
    }
    return c.json(created, HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}",
    request: { params: routeParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(communitySchema, "Community detail"),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Community not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const user = c.get("user"),
      { communityId } = c.req.valid("param"),
      communitiesList = await loadCommunities({
        currentUserId: isAuthenticatedUser(user) ? user.id : undefined,
        filters: { access: "all", genre: "all", q: "", sort: "activity-desc" },
      }),
      community = communitiesList.find((item) => item.id === communityId);
    return community
      ? c.json(community, HttpStatusCodes.OK)
      : c.json({ message: "Community not found." }, HttpStatusCodes.NOT_FOUND);
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{communityId}",
    request: {
      body: jsonContentRequired(
        communityInputSchema.partial(),
        "Community update"
      ),
      params: routeParams,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(communitySchema, "Community updated"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Owner required"),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityOwner({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const body = c.req.valid("json");
    if (
      body.monthlyPriceCents !== undefined &&
      body.monthlyPriceCents > 0 &&
      !(await ensurePaidCommunityEligibility({
        session: c.get("session"),
        user,
      }))
    ) {
      return c.json(
        {
          message:
            "Premium community access and payouts are required for paid membership.",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const capabilities = await loadCommunitySchemaCapabilities(),
      communityUpdate = capabilities.discovery
        ? body
        : {
            description: body.description,
            monthlyPriceCents: body.monthlyPriceCents,
            name: body.name,
          };
    await createDb()
      .update(communities)
      .set({ ...communityUpdate, updatedAt: new Date() })
      .where(eq(communities.id, communityId));
    const updated = (
      await loadCommunities({
        currentUserId: user.id,
        filters: {
          access: "all",
          genre: "all",
          q: "",
          sort: "activity-desc",
        },
      })
    ).find((community) => community.id === communityId);
    if (!updated) {
      throw new Error("Updated community could not be loaded.");
    }
    return c.json(updated, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{communityId}/join",
    request: { params: routeParams },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(messageSchema, "Community joined"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageSchema,
        "Checkout required"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Banned"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageSchema,
        "Authentication required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const db = createDb(),
      capabilities = await loadCommunitySchemaCapabilities(),
      [community] = await db
        .select({
          monthlyPriceCents: communities.monthlyPriceCents,
        })
        .from(communities)
        .where(
          and(eq(communities.id, communityId), eq(communities.isActive, true))
        )
        .limit(1),
      [ban] = capabilities.bans
        ? await db
            .select({ userId: communityBans.userId })
            .from(communityBans)
            .where(
              and(
                eq(communityBans.communityId, communityId),
                eq(communityBans.userId, user.id)
              )
            )
            .limit(1)
        : [];
    if (ban) {
      return c.json(
        { message: "You cannot join this community." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (!community || community.monthlyPriceCents > 0) {
      return c.json(
        { message: "Paid communities must be joined through checkout." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    await db
      .insert(communityMembers)
      .values({ communityId, role: "member", userId: user.id })
      .onConflictDoNothing();
    return c.json({ message: "Community joined." }, HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/posts",
    request: { params: routeParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        communityPostSchema.array(),
        "Community posts"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageSchema,
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await canAccessCommunity({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const rows = await createDb()
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.communityId, communityId))
        .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt)),
      authors = await loadCommunityAuthors(rows.map((row) => row.userId));
    return c.json(
      rows.map((row) => ({
        ...row,
        author: authors.get(row.userId) ?? fallbackAuthor(row.userId),
        createdAt: row.createdAt.toISOString(),
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{communityId}/posts",
    request: {
      body: jsonContentRequired(createPostSchema, "Community post"),
      params: routeParams,
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(communityPostSchema, "Post"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageSchema,
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await canAccessCommunity({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const body = c.req.valid("json"),
      createdAt = new Date(),
      row = {
        body: body.body ?? null,
        communityId,
        createdAt,
        id: crypto.randomUUID(),
        mediaUrl: body.mediaUrl ?? null,
        metadata: body.metadata ?? null,
        postType: body.postType,
        userId: user.id,
      },
      authorMap = await loadCommunityAuthors([user.id]),
      db = createDb(),
      [community] = await db
        .select({ artistUserId: communities.artistUserId })
        .from(communities)
        .where(eq(communities.id, communityId))
        .limit(1);
    await db.transaction(async (transaction) => {
      await transaction.insert(communityPosts).values(row);
      await transaction
        .update(communities)
        .set({ updatedAt: createdAt })
        .where(eq(communities.id, communityId));
    });

    if (community?.artistUserId === user.id) {
      const recipients = await db
        .select({
          communityPostsEnabled: notificationSettings.communityPosts,
          userId: communityMembers.userId,
        })
        .from(communityMembers)
        .leftJoin(
          notificationSettings,
          eq(notificationSettings.userId, communityMembers.userId)
        )
        .where(eq(communityMembers.communityId, communityId));
      const notificationRecipients = recipients.filter(
        (recipient) =>
          recipient.userId !== user.id &&
          recipient.communityPostsEnabled !== false
      );
      if (notificationRecipients.length > 0) {
        await db
          .insert(userNotifications)
          .values(
            notificationRecipients.map((recipient) => ({
              actorUserId: user.id,
              entityId: communityId,
              entityType: "community",
              id: `community_post:${row.id}:${recipient.userId}`,
              link: `/communities/${communityId}`,
              message: `${authorMap.get(user.id)?.name ?? "The creator"} posted an update in your community.`,
              title: "New community update",
              type: "community_post",
              userId: recipient.userId,
            }))
          )
          .onConflictDoNothing();
      }
    }
    return c.json(
      {
        ...row,
        author: authorMap.get(user.id) ?? fallbackAuthor(user.id),
        createdAt: createdAt.toISOString(),
        isPinned: false,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/messages",
    request: { params: routeParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        communityMessageSchema.array(),
        "Community chat"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageSchema,
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await canAccessCommunity({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const rows = await createDb()
        .select()
        .from(communityMessages)
        .where(eq(communityMessages.communityId, communityId))
        .orderBy(desc(communityMessages.createdAt))
        .limit(100),
      orderedRows = rows.toReversed(),
      authors = await loadCommunityAuthors(
        orderedRows.map((row) => row.userId)
      );
    return c.json(
      orderedRows.map((row) => ({
        ...row,
        author: authors.get(row.userId) ?? fallbackAuthor(row.userId),
        createdAt: row.createdAt.toISOString(),
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{communityId}/messages",
    request: {
      body: jsonContentRequired(createMessageSchema, "Community message"),
      params: routeParams,
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(communityMessageSchema, "Message"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageSchema,
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await canAccessCommunity({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const body = c.req.valid("json"),
      createdAt = new Date(),
      row = {
        body: body.body,
        communityId,
        createdAt,
        id: body.clientMessageId ?? crypto.randomUUID(),
        userId: user.id,
      },
      authorMap = await loadCommunityAuthors([user.id]);
    await createDb().transaction(async (transaction) => {
      await transaction
        .insert(communityMessages)
        .values(row)
        .onConflictDoNothing();
      await transaction
        .update(communities)
        .set({ updatedAt: createdAt })
        .where(eq(communities.id, communityId));
    });
    return c.json(
      {
        ...row,
        author: authorMap.get(user.id) ?? fallbackAuthor(user.id),
        createdAt: createdAt.toISOString(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/members",
    request: { params: routeParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        communityMemberSchema.array(),
        "Members"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageSchema,
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await canAccessCommunity({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const rows = await createDb()
      .select({
        avatarUrl: userProfiles.avatarUrl,
        joinedAt: communityMembers.joinedAt,
        name: userProfiles.displayName,
        role: communityMembers.role,
        userId: communityMembers.userId,
        username: userProfiles.username,
      })
      .from(communityMembers)
      .innerJoin(userProfiles, eq(userProfiles.userId, communityMembers.userId))
      .where(eq(communityMembers.communityId, communityId))
      .orderBy(asc(communityMembers.joinedAt));
    return c.json(
      rows.map((row) => ({
        ...row,
        joinedAt: row.joinedAt.toISOString(),
        name: row.name ?? row.username,
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/bans",
    request: { params: routeParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        communityBanSchema.array(),
        "Banned members"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Owner required"),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityOwner({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const capabilities = await loadCommunitySchemaCapabilities();
    if (!capabilities.bans) {
      return c.json([], HttpStatusCodes.OK);
    }
    const rows = await createDb()
      .select({
        avatarUrl: userProfiles.avatarUrl,
        bannedAt: communityBans.bannedAt,
        name: userProfiles.displayName,
        reason: communityBans.reason,
        userId: communityBans.userId,
        username: userProfiles.username,
      })
      .from(communityBans)
      .innerJoin(userProfiles, eq(userProfiles.userId, communityBans.userId))
      .where(eq(communityBans.communityId, communityId))
      .orderBy(desc(communityBans.bannedAt));
    return c.json(
      rows.map((row) => ({
        ...row,
        bannedAt: row.bannedAt.toISOString(),
        name: row.name ?? row.username,
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{communityId}/members/{userId}/ban",
    request: {
      body: jsonContentRequired(
        z.object({ reason: z.string().max(500).optional() }),
        "Ban details"
      ),
      params: memberRouteParams,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(messageSchema, "Member banned"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Owner required"),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageSchema,
        "Moderation schema unavailable"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const currentUser = c.get("user"),
      { communityId, userId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(currentUser) ||
      userId === currentUser.id ||
      !(await requireCommunityOwner({ communityId, userId: currentUser.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const capabilities = await loadCommunitySchemaCapabilities();
    if (!capabilities.bans) {
      return c.json(
        { message: "Community moderation is not available in this preview." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }
    const db = createDb();
    await db.transaction(async (transaction) => {
      await transaction
        .insert(communityBans)
        .values({
          bannedByUserId: currentUser.id,
          communityId,
          reason: c.req.valid("json").reason ?? null,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            bannedAt: new Date(),
            reason: c.req.valid("json").reason ?? null,
          },
          target: [communityBans.communityId, communityBans.userId],
        });
      await transaction
        .delete(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, userId)
          )
        );
    });
    return c.json({ message: "Member banned." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/{communityId}/bans/{userId}",
    request: { params: memberRouteParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(messageSchema, "Ban removed"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Owner required"),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageSchema,
        "Moderation schema unavailable"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const currentUser = c.get("user"),
      { communityId, userId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(currentUser) ||
      !(await requireCommunityOwner({ communityId, userId: currentUser.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const capabilities = await loadCommunitySchemaCapabilities();
    if (!capabilities.bans) {
      return c.json(
        { message: "Community moderation is not available in this preview." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }
    await createDb()
      .delete(communityBans)
      .where(
        and(
          eq(communityBans.communityId, communityId),
          eq(communityBans.userId, userId)
        )
      );
    return c.json({ message: "Member unbanned." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/analytics",
    request: { params: routeParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          activeSubscribers: z.number().int(),
          canceledSubscribers: z.number().int(),
          churnedSubscribers: z.number().int(),
          memberCount: z.number().int(),
          monthlyRecurringRevenueCents: z.number().int(),
        }),
        "Community analytics"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Owner required"),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user"),
      { communityId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityOwner({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const db = createDb(),
      [community] = await db
        .select({ monthlyPriceCents: communities.monthlyPriceCents })
        .from(communities)
        .where(eq(communities.id, communityId))
        .limit(1),
      subscriptionRows = await db
        .select({ count: count(), status: communitySubscriptions.status })
        .from(communitySubscriptions)
        .where(eq(communitySubscriptions.communityId, communityId))
        .groupBy(communitySubscriptions.status),
      [memberRow] = await db
        .select({ count: count() })
        .from(communityMembers)
        .where(eq(communityMembers.communityId, communityId)),
      countFor = (status: (typeof subscriptionRows)[number]["status"]) =>
        Number(
          subscriptionRows.find((row) => row.status === status)?.count ?? 0
        ),
      activeSubscribers = countFor("active");
    return c.json(
      {
        activeSubscribers,
        canceledSubscribers: countFor("canceled"),
        churnedSubscribers: countFor("expired"),
        memberCount: Number(memberRow?.count ?? 0),
        monthlyRecurringRevenueCents:
          activeSubscribers * (community?.monthlyPriceCents ?? 0),
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{communityId}/members/{userId}",
    request: {
      body: jsonContentRequired(
        z.object({ role: z.enum(["moderator", "member"]) }),
        "Membership role"
      ),
      params: memberRouteParams,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(messageSchema, "Membership updated"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Owner required"),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const currentUser = c.get("user"),
      { communityId, userId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(currentUser) ||
      userId === currentUser.id ||
      !(await requireCommunityOwner({ communityId, userId: currentUser.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    await createDb()
      .update(communityMembers)
      .set({ role: c.req.valid("json").role })
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId)
        )
      );
    return c.json({ message: "Membership updated." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/{communityId}/members/{userId}",
    request: { params: memberRouteParams },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(messageSchema, "Member removed"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Owner required"),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const currentUser = c.get("user"),
      { communityId, userId } = c.req.valid("param");
    if (
      !isAuthenticatedUser(currentUser) ||
      userId === currentUser.id ||
      !(await requireCommunityOwner({ communityId, userId: currentUser.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    await createDb()
      .delete(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId)
        )
      );
    return c.json({ message: "Member removed." }, HttpStatusCodes.OK);
  }
);

export default app;
