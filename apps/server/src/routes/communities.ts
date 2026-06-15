import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  communities,
  communityMembers,
  communityMessages,
  communityPosts,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import { and, desc, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { canAccessCommunity } from "@/lib/community-access";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { isSellerEnabled } from "@/lib/seller";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId, slugify } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();
const communitySchema = z.object({
  artistUserId: z.string(),
  description: z.string().nullable(),
  id: z.string(),
  monthlyPriceCents: z.number().int(),
  name: z.string(),
  slug: z.string(),
});
const createCommunitySchema = z.object({
  description: z.string().max(2000).optional(),
  monthlyPriceCents: z.number().int().min(299).max(9999),
  name: z.string().min(1).max(100),
});
const createPostSchema = z.object({
  body: z.string().max(10_000).optional(),
  mediaUrl: z.url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  postType: z.enum(["text", "image", "audio", "video", "poll"]).default("text"),
});
const createMessageSchema = z.object({ body: z.string().min(1).max(2000) });
const communityPostSchema = createPostSchema.extend({
  body: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  mediaUrl: z.string().nullable(),
  metadata: z.unknown().nullable(),
  userId: z.string(),
});
const communityMessageSchema = createMessageSchema.extend({
  createdAt: z.string(),
  id: z.string(),
  userId: z.string(),
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
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

    const rows = await createDb().select().from(communities);
    return c.json(rows, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(createCommunitySchema, "Community payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(communitySchema, "Community"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Premium and Connect required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
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

    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

    if (
      !entitlements.canOperatePaidCommunity ||
      !(await isSellerEnabled({ organizationId, userId: user.id }))
    ) {
      return c.json(
        {
          message: "Artist Premium and an enabled payout account are required.",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json");
    const row = {
      artistUserId: user.id,
      description: body.description ?? null,
      id: crypto.randomUUID(),
      monthlyPriceCents: body.monthlyPriceCents,
      name: body.name,
      slug: `${slugify(body.name)}-${user.id.slice(0, 6)}`,
    };

    if (isDatabaseConfigured()) {
      await createDb().insert(communities).values(row);
    }

    return c.json(row, HttpStatusCodes.CREATED);
  }
);

const requireCommunityAccess = ({
  communityId,
  userId,
}: {
  communityId: string;
  userId: string;
}) => canAccessCommunity({ communityId, userId });
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
      and(eq(communities.id, communityId), eq(communities.artistUserId, userId))
    )
    .limit(1);

  return Boolean(community);
};

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/posts",
    request: { params: z.object({ communityId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        communityPostSchema.array(),
        "Community posts"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user");
    const { communityId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityAccess({ communityId, userId: user.id }))
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
      .orderBy(desc(communityPosts.createdAt));
    return c.json(
      rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
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
      params: z.object({ communityId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(communityPostSchema, "Post"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user");
    const { communityId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityAccess({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json");
    const createdAt = new Date();
    const row = {
      body: body.body ?? null,
      communityId,
      createdAt,
      id: crypto.randomUUID(),
      mediaUrl: body.mediaUrl ?? null,
      metadata: body.metadata ?? null,
      postType: body.postType,
      userId: user.id,
    };
    await createDb().insert(communityPosts).values(row);
    return c.json(
      { ...row, createdAt: createdAt.toISOString() },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/messages",
    request: { params: z.object({ communityId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        communityMessageSchema.array(),
        "Community chat"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user");
    const { communityId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityAccess({ communityId, userId: user.id }))
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
      .orderBy(desc(communityMessages.createdAt));
    return c.json(
      rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
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
      params: z.object({ communityId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(communityMessageSchema, "Message"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user");
    const { communityId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityAccess({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const createdAt = new Date();
    const row = {
      body: c.req.valid("json").body,
      communityId,
      createdAt,
      id: crypto.randomUUID(),
      userId: user.id,
    };
    await createDb().insert(communityMessages).values(row);
    return c.json(
      { ...row, createdAt: createdAt.toISOString() },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/members",
    request: { params: z.object({ communityId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z
          .object({
            joinedAt: z.string(),
            role: z.enum(["owner", "moderator", "member"]),
            userId: z.string(),
          })
          .array(),
        "Members"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Membership required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user");
    const { communityId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityAccess({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "An active community membership is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const rows = await createDb()
      .select()
      .from(communityMembers)
      .where(eq(communityMembers.communityId, communityId));
    return c.json(
      rows.map((row) => ({ ...row, joinedAt: row.joinedAt.toISOString() })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{communityId}/analytics",
    request: { params: z.object({ communityId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          activeSubscribers: z.number().int(),
          canceledSubscribers: z.number().int(),
          churnedSubscribers: z.number().int(),
          monthlyRecurringRevenueCents: z.number().int(),
        }),
        "Community analytics"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Community owner required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const user = c.get("user");
    const { communityId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(user) ||
      !(await requireCommunityOwner({ communityId, userId: user.id }))
    ) {
      return c.json(
        { message: "Community owner access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const db = createDb();
    const [community] = await db
      .select({ monthlyPriceCents: communities.monthlyPriceCents })
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);
    const rows = await db
      .select({
        count: sql<number>`count(*)`,
        status: communitySubscriptions.status,
      })
      .from(communitySubscriptions)
      .where(eq(communitySubscriptions.communityId, communityId))
      .groupBy(communitySubscriptions.status);
    const countFor = (status: (typeof rows)[number]["status"]) =>
      Number(rows.find((row) => row.status === status)?.count ?? 0);
    const activeSubscribers = countFor("active");

    return c.json(
      {
        activeSubscribers,
        canceledSubscribers: countFor("canceled"),
        churnedSubscribers: countFor("expired"),
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
      params: z.object({ communityId: z.string(), userId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ message: z.string() }),
        "Membership updated"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Community owner required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const currentUser = c.get("user");
    const { communityId, userId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(currentUser) ||
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
    request: {
      params: z.object({ communityId: z.string(), userId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ message: z.string() }),
        "Member removed"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Community owner required"
      ),
    },
    tags: ["Communities"],
  }),
  async (c) => {
    const currentUser = c.get("user");
    const { communityId, userId } = c.req.valid("param");

    if (
      !isAuthenticatedUser(currentUser) ||
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
