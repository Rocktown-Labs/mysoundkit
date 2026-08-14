import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  adCampaigns,
  adCampaignTargets,
  adMetricDaily,
  userWallets,
} from "@soundkit/db/schema/app";
import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAdminUser } from "@/lib/admin";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const adPlacementSchema = z.enum([
  "audio_preroll",
  "video_preroll",
  "video_overlay",
]);
const adCreativeFormatSchema = z.enum(["audio", "video", "image"]);
const adBillingTypeSchema = z.enum(["upfront_recurring", "prepaid_wallet"]);
const adTargetTypeSchema = z.enum(["state", "country"]);
const adCampaignStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "exhausted_for_today",
  "expired",
]);

const adTargetSchema = z.object({
  targetCode: z.string(),
  targetType: adTargetTypeSchema,
});

const createCampaignBodySchema = z.object({
  billingType: adBillingTypeSchema.default("prepaid_wallet"),
  clickthroughUrl: z.url(),
  creativeFormat: adCreativeFormatSchema.default("audio"),
  creativeImageUrl: z.url().optional(),
  creativeUrl: z.url(),
  dailyBudgetCents: z.number().int().positive().default(500),
  dailyImpressionCap: z.number().int().positive().default(1000),
  endDate: z.string().datetime().optional(),
  name: z.string().trim().min(1).max(120),
  placement: adPlacementSchema.default("audio_preroll"),
  startDate: z.string().datetime().optional(),
  targets: adTargetSchema.array().min(1).max(80),
});

const houseCampaignBodySchema = z.object({
  clickthroughUrl: z.url(),
  creativeFormat: adCreativeFormatSchema,
  creativeImageUrl: z.url().optional(),
  creativeUrl: z.url(),
  name: z.string().trim().min(1).max(120),
  placement: adPlacementSchema,
});

const adCampaignSchema = z.object({
  billingType: adBillingTypeSchema,
  clickthroughUrl: z.string(),
  creativeFormat: adCreativeFormatSchema,
  creativeImageUrl: z.string().nullable(),
  creativeUrl: z.string(),
  dailyBudgetCents: z.number().int(),
  dailyImpressionCap: z.number().int(),
  endDate: z.string().nullable(),
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
});

const walletSchema = z.object({
  balanceCents: z.number().int(),
  currency: z.string(),
});

const serveAdQuerySchema = z.object({
  contentType: z.enum(["audio", "video"]).default("audio"),
  placement: adPlacementSchema.default("audio_preroll"),
  trackId: z.string().optional(),
  videoId: z.string().optional(),
});

const servedAdSchema = z.object({
  ad: z
    .object({
      campaignId: z.string(),
      clickthroughUrl: z.string(),
      creativeFormat: adCreativeFormatSchema,
      imageUrl: z.string().nullable(),
      mediaUrl: z.string(),
      title: z.string(),
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
});

const adEventBodySchema = z.object({
  campaignId: z.string(),
  eventType: z.enum(["impression", "click", "complete"]),
});

const todayKey = () => new Date().toISOString().slice(0, 10);

const normalizeTargetCode = (value: string | null | undefined) =>
  value?.trim().toUpperCase() ?? "";

const requestTargets = (headers: Headers) => {
  const country = normalizeTargetCode(
    headers.get("cf-ipcountry") ??
      headers.get("x-vercel-ip-country") ??
      headers.get("x-country-code")
  );
  const region = normalizeTargetCode(
    headers.get("cf-region-code") ??
      headers.get("x-vercel-ip-country-region") ??
      headers.get("x-region-code")
  );

  return [region ? `US-${region.replace(/^US-/u, "")}` : "", country].filter(
    Boolean
  );
};

const computeMetrics = ({
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
});

const serializeCampaign = async (campaign: typeof adCampaigns.$inferSelect) => {
  const db = createDb();
  const [targets, metricsRows] = await Promise.all([
    db
      .select()
      .from(adCampaignTargets)
      .where(eq(adCampaignTargets.campaignId, campaign.id)),
    db
      .select()
      .from(adMetricDaily)
      .where(eq(adMetricDaily.campaignId, campaign.id)),
  ]);
  const totals = metricsRows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicksCount,
      impressions: acc.impressions + row.impressionsCount,
      spendCents: acc.spendCents + row.spendCents,
    }),
    { clicks: 0, impressions: 0, spendCents: 0 }
  );

  return {
    billingType: campaign.billingType,
    clickthroughUrl: campaign.clickthroughUrl,
    creativeFormat: campaign.creativeFormat,
    creativeImageUrl: campaign.creativeImageUrl,
    creativeUrl: campaign.creativeUrl,
    dailyBudgetCents: campaign.dailyBudgetCents,
    dailyImpressionCap: campaign.dailyImpressionCap,
    endDate: campaign.endDate?.toISOString() ?? null,
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

    const body = c.req.valid("json");
    const db = createDb();
    const [campaign] = await db
      .insert(adCampaigns)
      .values({
        advertiserId: user.id,
        billingType: body.billingType,
        clickthroughUrl: body.clickthroughUrl,
        creativeFormat: body.creativeFormat,
        creativeImageUrl: body.creativeImageUrl ?? null,
        creativeUrl: body.creativeUrl,
        dailyBudgetCents: body.dailyBudgetCents,
        dailyImpressionCap: body.dailyImpressionCap,
        endDate: body.endDate ? new Date(body.endDate) : null,
        id: crypto.randomUUID(),
        name: body.name,
        placement: body.placement,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        status: "active",
      })
      .returning();

    if (!campaign) {
      throw new Error("Failed to create ad campaign.");
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
    const user = c.get("user");
    if (!isAdminUser(user)) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json");
    const db = createDb();
    const [campaign] = await db
      .insert(adCampaigns)
      .values({
        advertiserId: user?.id ?? "soundkit",
        billingType: "prepaid_wallet",
        clickthroughUrl: body.clickthroughUrl,
        creativeFormat: body.creativeFormat,
        creativeImageUrl: body.creativeImageUrl ?? null,
        creativeUrl: body.creativeUrl,
        dailyBudgetCents: 0,
        dailyImpressionCap: 100_000,
        id: crypto.randomUUID(),
        name: body.name,
        placement: body.placement,
        startDate: new Date(),
        status: "active",
      })
      .returning();
    if (!campaign) {
      throw new Error("Failed to create house ad.");
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
        z.object({ status: z.enum(["active", "paused"]) }),
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
    const { campaignId } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const [campaign] = await createDb()
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

    const query = c.req.valid("query");
    const targets = requestTargets(c.req.raw.headers);

    if (targets.length === 0) {
      return c.body(null, HttpStatusCodes.NO_CONTENT);
    }

    const db = createDb();
    const today = todayKey();
    const now = new Date();
    const candidates = await db
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
      .where(
        and(
          eq(adCampaigns.status, "active"),
          eq(adCampaigns.placement, query.placement),
          lte(adCampaigns.startDate, now),
          or(
            sql`${adCampaigns.endDate} is null`,
            sql`${adCampaigns.endDate} >= ${now}`
          ),
          inArray(adCampaignTargets.targetCode, targets)
        )
      )
      .limit(20);

    const qualified = candidates.filter(
      ({ campaign, metrics }) =>
        (metrics?.impressionsCount ?? 0) < campaign.dailyImpressionCap
    );
    const selected = qualified[0]?.campaign;

    if (!selected) {
      return c.body(null, HttpStatusCodes.NO_CONTENT);
    }

    return c.json(
      {
        ad: {
          campaignId: selected.id,
          clickthroughUrl: selected.clickthroughUrl,
          creativeFormat: selected.creativeFormat,
          imageUrl: selected.creativeImageUrl,
          mediaUrl: selected.creativeUrl,
          title: selected.name,
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

    const body = c.req.valid("json");
    const today = todayKey();
    const impressionDelta = body.eventType === "impression" ? 1 : 0;
    const clickDelta = body.eventType === "click" ? 1 : 0;

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
