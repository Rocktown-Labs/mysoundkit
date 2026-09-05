import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  adCampaigns,
  adCampaignTargets,
  adMetricDaily,
  tracks,
  userWallets,
  videos,
} from "@soundkit/db/schema/app";
import { and, desc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  buildBattlePromoCopy,
  fairnessExclusionFor,
  hydrateBattleAdContext,
} from "@/lib/ad-serving";
import { isAdminUser } from "@/lib/admin";
import { mediaBaseUrl } from "@/lib/asset-urls";
import {
  battleSpotCopyFor,
  renderBattleAudioSpot,
} from "@/lib/battle-ad-audio";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import {
  claimUploadIntent,
  completeUploadIntent,
  objectKeyFromMediaUrl,
} from "@/lib/upload-intents";

const app = new OpenAPIHono<AppEnv>(),
  adPlacementSchema = z.enum([
    "audio_preroll",
    "video_preroll",
    "video_overlay",
    "sponsored_queue",
    "featured_rail",
    "battle_boost",
  ]),
  adCreativeFormatSchema = z.enum(["audio", "video", "image"]),
  adBillingTypeSchema = z.enum([
    "upfront_recurring",
    "prepaid_wallet",
    "house",
  ]),
  adTargetTypeSchema = z.enum(["state", "country"]),
  adEntityTypeSchema = z.enum([
    "track",
    "project",
    "video",
    "battle",
    "stream",
  ]),
  adCampaignStatusSchema = z.enum([
    "draft",
    "pending_review",
    "active",
    "paused",
    "rejected",
    "exhausted_for_today",
    "expired",
  ]),
  adTargetSchema = z.object({
    targetCode: z.string(),
    targetType: adTargetTypeSchema,
  }),
  createCampaignBodySchema = z
    .object({
      allowConquest: z.boolean().default(false),
      billingType: adBillingTypeSchema.default("prepaid_wallet"),
      clickthroughUrl: z.url(),
      creativeFormat: adCreativeFormatSchema.default("audio"),
      creativeImageUrl: z.url().optional(),
      creativeUrl: z.url(),
      dailyBudgetCents: z.number().int().positive().default(500),
      dailyImpressionCap: z.number().int().positive().default(1000),
      endDate: z.string().datetime().optional(),
      entityId: z.string().min(1).max(120).optional(),
      entityType: adEntityTypeSchema.optional(),
      name: z.string().trim().min(1).max(120),
      placement: adPlacementSchema.default("audio_preroll"),
      startDate: z.string().datetime().optional(),
      targets: adTargetSchema.array().min(1).max(80),
    })
    .superRefine((body, context) => {
      if (Boolean(body.entityType) !== Boolean(body.entityId)) {
        context.addIssue({
          code: "custom",
          message: "entityType and entityId must be provided together.",
          path: ["entityId"],
        });
      }
    }),
  houseCampaignBodySchema = z.object({
    clickthroughUrl: z.url(),
    creativeFormat: adCreativeFormatSchema,
    creativeImageUrl: z.url().optional(),
    creativeUrl: z.url(),
    endDate: z.string().datetime().optional(),
    name: z.string().trim().min(1).max(120),
    placement: adPlacementSchema,
  }),
  adCampaignSchema = z.object({
    allowConquest: z.boolean(),
    billingType: adBillingTypeSchema,
    clickthroughUrl: z.string(),
    creativeFormat: adCreativeFormatSchema,
    creativeImageUrl: z.string().nullable(),
    creativeUrl: z.string(),
    dailyBudgetCents: z.number().int(),
    dailyImpressionCap: z.number().int(),
    endDate: z.string().nullable(),
    entityId: z.string().nullable(),
    entityType: adEntityTypeSchema.nullable(),
    id: z.string(),
    metrics: z.object({
      clicks: z.number().int(),
      cpcCents: z.number().nullable(),
      cpmCents: z.number().nullable(),
      ctrPercent: z.number(),
      impressions: z.number().int(),
      spendCents: z.number().int(),
    }),
    name: z.string(),
    placement: adPlacementSchema,
    startDate: z.string(),
    status: adCampaignStatusSchema,
    targets: adTargetSchema.array(),
  }),
  walletSchema = z.object({
    balanceCents: z.number().int(),
    currency: z.string(),
  }),
  serveAdQuerySchema = z.object({
    contentType: z.enum(["audio", "video"]).default("audio"),
    placement: adPlacementSchema.default("audio_preroll"),
    trackId: z.string().optional(),
    videoId: z.string().optional(),
  }),
  servedAdSchema = z.object({
    ad: z
      .object({
        battle: z
          .object({
            artistA: z.string().nullable(),
            artistB: z.string().nullable(),
            battleId: z.string(),
            genre: z.string().nullable(),
            promoCopy: z.string(),
            queueSize: z.number().int(),
            startsAt: z.string().nullable(),
            status: z.string(),
            timingLabel: z.string(),
            title: z.string(),
          })
          .nullable(),
        campaignId: z.string(),
        clickthroughUrl: z.string(),
        creativeFormat: adCreativeFormatSchema,
        entity: z
          .object({ id: z.string(), type: adEntityTypeSchema })
          .nullable(),
        imageUrl: z.string().nullable(),
        mediaUrl: z.string(),
        requiresPremium: z.boolean(),
        title: z.string(),
        upgradeUrl: z.string().nullable(),
        vast: z.object({
          adSystem: z.literal("SoundKit"),
          durationSeconds: z.number().int(),
          linear: z.boolean(),
          version: z.literal("4.2"),
        }),
      })
      .nullable(),
    hasAd: z.boolean(),
    reason: z.string().optional(),
  }),
  adEventBodySchema = z.object({
    campaignId: z.string(),
    eventType: z.enum(["impression", "click", "complete"]),
  }),
  todayKey = () => new Date().toISOString().slice(0, 10),
  normalizeTargetCode = (value: string | null | undefined) =>
    value?.trim().toUpperCase() ?? "",
  requestTargets = (headers: Headers) => {
    const country = normalizeTargetCode(
        headers.get("cf-ipcountry") ??
          headers.get("x-vercel-ip-country") ??
          headers.get("x-country-code")
      ),
      region = normalizeTargetCode(
        headers.get("cf-region-code") ??
          headers.get("x-vercel-ip-country-region") ??
          headers.get("x-region-code")
      );

    return [
      "GLOBAL",
      region ? `US-${region.replace(/^US-/u, "")}` : "",
      country,
    ].filter(Boolean);
  },
  computeMetrics = ({
    clicks,
    impressions,
    spendCents,
  }: {
    clicks: number;
    impressions: number;
    spendCents: number;
  }) => ({
    clicks,
    cpcCents: clicks > 0 ? Math.round(spendCents / clicks) : null,
    cpmCents:
      impressions > 0 ? Math.round((spendCents / impressions) * 1000) : null,
    ctrPercent: impressions > 0 ? (clicks / impressions) * 100 : 0,
    impressions,
    spendCents,
  }),
  serializeCampaign = async (campaign: typeof adCampaigns.$inferSelect) => {
    const db = createDb(),
      [targets, metricsRows] = await Promise.all([
        db
          .select()
          .from(adCampaignTargets)
          .where(eq(adCampaignTargets.campaignId, campaign.id)),
        db
          .select()
          .from(adMetricDaily)
          .where(eq(adMetricDaily.campaignId, campaign.id)),
      ]),
      totals = metricsRows.reduce(
        (acc, row) => ({
          clicks: acc.clicks + row.clicksCount,
          impressions: acc.impressions + row.impressionsCount,
          spendCents: acc.spendCents + row.spendCents,
        }),
        { clicks: 0, impressions: 0, spendCents: 0 }
      );

    return {
      allowConquest: campaign.allowConquest,
      billingType: campaign.billingType,
      clickthroughUrl: campaign.clickthroughUrl,
      creativeFormat: campaign.creativeFormat,
      creativeImageUrl: campaign.creativeImageUrl,
      creativeUrl: campaign.creativeUrl,
      dailyBudgetCents: campaign.dailyBudgetCents,
      dailyImpressionCap: campaign.dailyImpressionCap,
      endDate: campaign.endDate?.toISOString() ?? null,
      entityId: campaign.entityId,
      entityType: campaign.entityType,
      id: campaign.id,
      metrics: computeMetrics(totals),
      name: campaign.name,
      placement: campaign.placement,
      startDate: campaign.startDate.toISOString(),
      status: campaign.status,
      targets: targets.map((target) => ({
        targetCode: target.targetCode,
        targetType: target.targetType,
      })),
    };
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/wallet",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(walletSchema, "Ad wallet balance"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ balanceCents: 0, currency: "USD" }, HttpStatusCodes.OK);
    }

    const [wallet] = await createDb()
      .select()
      .from(userWallets)
      .where(eq(userWallets.userId, user.id))
      .limit(1);

    return c.json(
      {
        balanceCents: wallet?.balanceCents ?? 0,
        currency: wallet?.currency ?? "USD",
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/campaigns",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adCampaignSchema.array(),
        "Advertiser campaigns"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const rows = await createDb()
      .select()
      .from(adCampaigns)
      .where(eq(adCampaigns.advertiserId, user.id))
      .orderBy(desc(adCampaigns.createdAt));

    return c.json(
      await Promise.all(rows.map(serializeCampaign)),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/campaigns",
    request: {
      body: jsonContentRequired(
        createCampaignBodySchema,
        "Ad campaign payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        adCampaignSchema,
        "Created ad campaign"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Database required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is required to create ad campaigns." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const body = c.req.valid("json"),
      db = createDb(),
      campaignId = crypto.randomUUID(),
      creativeObjectKeys = [body.creativeUrl, body.creativeImageUrl]
        .flatMap((url) => (url ? [objectKeyFromMediaUrl(url)] : []))
        .filter((objectKey): objectKey is string => Boolean(objectKey));
    for (const objectKey of creativeObjectKeys) {
      await claimUploadIntent({
        entityId: campaignId,
        entityType: "ad_creative",
        objectKey,
        userId: user.id,
      });
    }

    const [campaign] = await db
      .insert(adCampaigns)
      .values({
        advertiserId: user.id,
        allowConquest: body.allowConquest,
        billingType: body.billingType,
        clickthroughUrl: body.clickthroughUrl,
        creativeFormat: body.creativeFormat,
        creativeImageUrl: body.creativeImageUrl ?? null,
        creativeUrl: body.creativeUrl,
        dailyBudgetCents: body.dailyBudgetCents,
        dailyImpressionCap: body.dailyImpressionCap,
        endDate: body.endDate ? new Date(body.endDate) : null,
        entityId: body.entityId ?? null,
        entityType: body.entityType ?? null,
        id: campaignId,
        name: body.name,
        placement: body.placement,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        status: "draft",
      })
      .returning();

    if (!campaign) {
      throw new Error("Failed to create ad campaign.");
    }

    for (const objectKey of creativeObjectKeys) {
      await completeUploadIntent({
        entityId: campaign.id,
        entityType: "ad_creative",
        objectKey,
        userId: user.id,
      });
    }

    await db.insert(adCampaignTargets).values(
      body.targets.map((target) => ({
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        targetCode: normalizeTargetCode(target.targetCode),
        targetType: target.targetType,
      }))
    );

    return c.json(await serializeCampaign(campaign), HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/campaigns/{campaignId}/submit",
    request: {
      params: z.object({ campaignId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(adCampaignSchema, "Submitted campaign"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Not your campaign"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Campaign not found"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const { campaignId } = c.req.valid("param"),
      db = createDb(),
      [campaign] = await db
        .select()
        .from(adCampaigns)
        .where(eq(adCampaigns.id, campaignId))
        .limit(1);
    if (!campaign || campaign.advertiserId !== user.id) {
      return c.json(
        { message: campaign ? "Not your campaign." : "Campaign not found." },
        campaign ? HttpStatusCodes.FORBIDDEN : HttpStatusCodes.NOT_FOUND
      );
    }
    if (campaign.status !== "draft" && campaign.status !== "rejected") {
      return c.json(await serializeCampaign(campaign), HttpStatusCodes.OK);
    }
    // Entity-targeted campaigns derive creative from platform content
    // (already moderated + normalized) so they auto-approve. Uploaded
    // creatives go to human review.
    const autoApproved = Boolean(campaign.entityType && campaign.entityId),
      [updated] = await db
        .update(adCampaigns)
        .set({
          status: autoApproved ? "active" : "pending_review",
          updatedAt: new Date(),
        })
        .where(eq(adCampaigns.id, campaignId))
        .returning();
    if (!updated) {
      return c.json(
        { message: "Campaign not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    return c.json(await serializeCampaign(updated), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/admin/campaigns",
    request: {
      body: jsonContentRequired(houseCampaignBodySchema, "House ad payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        adCampaignSchema,
        "Created house ad"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    const user = c.get("user"),
      adminUserId = user?.id;
    if (!(isAdminUser(user) && adminUserId)) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json"),
      db = createDb(),
      campaignId = crypto.randomUUID(),
      creativeObjectKeys = [body.creativeUrl, body.creativeImageUrl]
        .flatMap((url) => (url ? [objectKeyFromMediaUrl(url)] : []))
        .filter((objectKey): objectKey is string => Boolean(objectKey));
    for (const objectKey of creativeObjectKeys) {
      await claimUploadIntent({
        entityId: campaignId,
        entityType: "ad_creative",
        objectKey,
        userId: adminUserId,
      });
    }

    const [campaign] = await db
      .insert(adCampaigns)
      .values({
        advertiserId: adminUserId,
        billingType: "house",
        clickthroughUrl: body.clickthroughUrl,
        creativeFormat: body.creativeFormat,
        creativeImageUrl: body.creativeImageUrl ?? null,
        creativeUrl: body.creativeUrl,
        dailyBudgetCents: 0,
        dailyImpressionCap: 100_000,
        endDate: body.endDate ? new Date(body.endDate) : null,
        id: campaignId,
        name: body.name,
        placement: body.placement,
        startDate: new Date(),
        status: "active",
      })
      .returning();
    if (!campaign) {
      throw new Error("Failed to create house ad.");
    }
    for (const objectKey of creativeObjectKeys) {
      await completeUploadIntent({
        entityId: campaign.id,
        entityType: "ad_creative",
        objectKey,
        userId: adminUserId,
      });
    }
    await db.insert(adCampaignTargets).values([
      {
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        targetCode: "US",
        targetType: "country",
      },
      {
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        targetCode: "GLOBAL",
        targetType: "country",
      },
    ]);
    return c.json(await serializeCampaign(campaign), HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/admin/campaigns/{campaignId}/status",
    request: {
      body: jsonContentRequired(
        z.object({
          status: z.enum(["active", "paused", "rejected"]),
        }),
        "Campaign status"
      ),
      params: z.object({ campaignId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(adCampaignSchema, "Updated campaign"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Campaign not found"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const { campaignId } = c.req.valid("param"),
      { status } = c.req.valid("json"),
      [campaign] = await createDb()
        .update(adCampaigns)
        .set({ status, updatedAt: new Date() })
        .where(eq(adCampaigns.id, campaignId))
        .returning();
    if (!campaign) {
      return c.json(
        { message: "Campaign not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    return c.json(await serializeCampaign(campaign), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/admin/campaigns",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adCampaignSchema.array(),
        "All ad campaigns"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const rows = await createDb()
      .select()
      .from(adCampaigns)
      .orderBy(desc(adCampaigns.createdAt))
      .limit(100);

    return c.json(
      await Promise.all(rows.map(serializeCampaign)),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/battle-audio",
    request: {
      body: jsonContentRequired(
        z.object({ battleId: z.string().min(1) }),
        "Battle audio spot payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          battleId: z.string(),
          cacheHit: z.boolean(),
          copy: z.string(),
          creativeUrl: z.string().nullable(),
          objectKey: z.string(),
        }),
        "Rendered battle audio spot"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Battle not found"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Spot rendering unavailable"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const { battleId } = c.req.valid("json"),
      prepared = await battleSpotCopyFor(battleId);
    if (!prepared) {
      return c.json(
        { message: "Battle not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const bindings = c.env as AppEnv["Bindings"],
      bucket = bindings.MEDIA_BUCKET,
      openaiKey =
        (bindings as unknown as Record<string, string | undefined>)
          .OPENAI_API_KEY ?? "",
      baseUrl = mediaBaseUrl();
    if (!(bucket && openaiKey && baseUrl)) {
      return c.json(
        { message: "Battle spot rendering is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }
    try {
      return c.json(
        await renderBattleAudioSpot({
          battleId,
          bucket,
          copy: prepared.copy,
          mediaBaseUrl: baseUrl,
          openaiKey,
        }),
        HttpStatusCodes.OK
      );
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Battle spot rendering failed.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/serve",
    request: {
      query: serveAdQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(servedAdSchema, "Selected ad"),
      [HttpStatusCodes.NO_CONTENT]: {
        description: "No ad available",
      },
    },
    tags: ["Ads"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.body(null, HttpStatusCodes.NO_CONTENT);
    }

    const query = c.req.valid("query"),
      targets = requestTargets(c.req.raw.headers),
      user = c.get("user"),
      session = c.get("session");

    if (targets.length === 0) {
      return c.body(null, HttpStatusCodes.NO_CONTENT);
    }

    if (isAuthenticatedUser(user)) {
      const entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });

      if (entitlements.isPremium) {
        return c.body(null, HttpStatusCodes.NO_CONTENT);
      }
    }

    const db = createDb(),
      today = todayKey(),
      now = new Date(),
      creativeCondition =
        query.contentType === "audio"
          ? eq(adCampaigns.creativeFormat, "audio")
          : (query.placement === "video_overlay"
            ? inArray(adCampaigns.creativeFormat, ["image", "video"])
            : eq(adCampaigns.creativeFormat, "video")),
      candidates = await db
        .select({
          campaign: adCampaigns,
          metrics: adMetricDaily,
        })
        .from(adCampaigns)
        .innerJoin(
          adCampaignTargets,
          eq(adCampaignTargets.campaignId, adCampaigns.id)
        )
        .leftJoin(
          adMetricDaily,
          and(
            eq(adMetricDaily.campaignId, adCampaigns.id),
            eq(adMetricDaily.date, today)
          )
        )
        .leftJoin(userWallets, eq(userWallets.userId, adCampaigns.advertiserId))
        .where(
          and(
            eq(adCampaigns.status, "active"),
            eq(adCampaigns.placement, query.placement),
            creativeCondition,
            or(
              eq(adCampaigns.billingType, "upfront_recurring"),
              and(
                eq(adCampaigns.billingType, "prepaid_wallet"),
                gt(userWallets.balanceCents, 0)
              ),
              // House campaigns are Rocktown's own promos: always funded,
              // served as backfill after paid demand.
              eq(adCampaigns.billingType, "house")
            ),
            lte(adCampaigns.startDate, now),
            or(
              sql`${adCampaigns.endDate} is null`,
              sql`${adCampaigns.endDate} >= ${now}`
            ),
            inArray(adCampaignTargets.targetCode, targets)
          )
        )
        // Paid demand first, house backfill last; newest paid first.
        .orderBy(
          sql`CASE WHEN ${adCampaigns.billingType} = 'house' THEN 1 ELSE 0 END`,
          desc(adCampaigns.createdAt)
        )
        .limit(20),
      qualified = candidates.filter(
        ({ campaign, metrics }) =>
          (metrics?.impressionsCount ?? 0) < campaign.dailyImpressionCap
      ),
      // Fairness: resolve the playback context (whose content is playing)
      // and each promo's entity genre, then drop self-serves and
      // non-waived same-genre conquest. Page-level separation (artist
      // pages) is enforced by surfaces requesting neutral inventory.
      [contextTrack] = query.trackId
        ? await db
            .select({
              genreId: tracks.genreId,
              ownerUserId: tracks.ownerUserId,
            })
            .from(tracks)
            .where(eq(tracks.id, query.trackId))
            .limit(1)
        : [],
      [contextVideo] =
        !query.trackId && query.videoId
          ? await db
              .select({
                genreId: videos.genreId,
                ownerUserId: videos.ownerUserId,
              })
              .from(videos)
              .where(eq(videos.id, query.videoId))
              .limit(1)
          : [],
      contextOwnerId =
        contextTrack?.ownerUserId ?? contextVideo?.ownerUserId ?? null,
      contextGenreId = contextTrack?.genreId ?? contextVideo?.genreId ?? null,
      promoTrackIds = [
        ...new Set(
          qualified
            .filter(
              ({ campaign }) =>
                campaign.entityType === "track" && campaign.entityId
            )
            .map(({ campaign }) => campaign.entityId as string)
        ),
      ],
      promoTrackRows =
        promoTrackIds.length > 0
          ? await db
              .select({ genreId: tracks.genreId, id: tracks.id })
              .from(tracks)
              .where(inArray(tracks.id, promoTrackIds))
          : [],
      promoGenreByTrackId = new Map(
        promoTrackRows.map((row) => [row.id, row.genreId])
      ),
      eligible = qualified.filter(
        ({ campaign }) =>
          fairnessExclusionFor(
            {
              advertiserId: campaign.advertiserId,
              allowConquest: campaign.allowConquest,
              entityGenreId:
                campaign.entityType === "track" && campaign.entityId
                  ? (promoGenreByTrackId.get(campaign.entityId) ?? null)
                  : null,
            },
            { contextGenreId, contextOwnerId }
          ) === null
      ),
      selected = eligible[0]?.campaign;

    if (!selected) {
      return c.body(null, HttpStatusCodes.NO_CONTENT);
    }

    const battle =
        selected.entityType === "battle" && selected.entityId
          ? await hydrateBattleAdContext(selected.entityId)
          : null,
      // Premium-only battles served to non-premium listeners render an
      // upgrade CTA instead of Watch — never a dead end.
      requiresPremium = battle?.requiresPremium ?? false;

    return c.json(
      {
        ad: {
          battle: battle
            ? {
                artistA: battle.artistA,
                artistB: battle.artistB,
                battleId: battle.battleId,
                genre: battle.genre,
                promoCopy: buildBattlePromoCopy({
                  artistA: battle.artistA,
                  artistB: battle.artistB,
                  genre: battle.genre,
                  status: battle.status,
                  timingLabel: battle.timingLabel,
                  title: battle.title,
                }),
                queueSize: battle.queueSize,
                startsAt: battle.startsAt,
                status: battle.status,
                timingLabel: battle.timingLabel,
                title: battle.title,
              }
            : null,
          campaignId: selected.id,
          clickthroughUrl: selected.clickthroughUrl,
          creativeFormat: selected.creativeFormat,
          entity:
            selected.entityType && selected.entityId
              ? { id: selected.entityId, type: selected.entityType }
              : null,
          imageUrl: selected.creativeImageUrl,
          mediaUrl: selected.creativeUrl,
          requiresPremium,
          title: selected.name,
          upgradeUrl: requiresPremium
            ? `/pricing?context=battle_boost&entity=${encodeURIComponent(selected.entityId ?? selected.id)}`
            : null,
          vast: {
            adSystem: "SoundKit" as const,
            durationSeconds: selected.creativeFormat === "image" ? 15 : 30,
            linear: selected.placement !== "video_overlay",
            version: "4.2" as const,
          },
        },
        hasAd: true,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/event",
    request: {
      body: jsonContentRequired(adEventBodySchema, "Ad event"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ message: z.string() }),
        "Ad event accepted"
      ),
    },
    tags: ["Ads"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ message: "Ad event accepted." }, HttpStatusCodes.OK);
    }

    const body = c.req.valid("json"),
      today = todayKey(),
      impressionDelta = body.eventType === "impression" ? 1 : 0,
      clickDelta = body.eventType === "click" ? 1 : 0;

    await createDb()
      .insert(adMetricDaily)
      .values({
        campaignId: body.campaignId,
        clicksCount: clickDelta,
        date: today,
        id: crypto.randomUUID(),
        impressionsCount: impressionDelta,
        spendCents: 0,
      })
      .onConflictDoUpdate({
        set: {
          clicksCount: sql`${adMetricDaily.clicksCount} + ${clickDelta}`,
          impressionsCount: sql`${adMetricDaily.impressionsCount} + ${impressionDelta}`,
          updatedAt: new Date(),
        },
        target: [adMetricDaily.campaignId, adMetricDaily.date],
      });

    return c.json({ message: "Ad event accepted." }, HttpStatusCodes.OK);
  }
);

export default app;
