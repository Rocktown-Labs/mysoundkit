import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userProfiles } from "@soundkit/db/schema/app";
import { subscription, user } from "@soundkit/db/schema/auth";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import {
  aiCreditGrants,
  planCatalog,
  subscriptionEntitlements,
} from "@soundkit/db/schema/plans";
import { env } from "@soundkit/env/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAdminUser } from "@/lib/admin";
import {
  adminFinanceSummarySchema,
  adminImportStripePlanBodySchema,
  adminPaymentsOverviewSchema,
  adminSyncStripePlansBodySchema,
  adminSyncStripePlansResponseSchema,
  messageResponseSchema,
} from "@/lib/schemas";
import {
  createStripeCoupon,
  createStripeProduct,
  createStripeRecurringPrice,
  deleteStripeCoupon,
  listStripeCoupons,
  listStripePrices,
  listStripeProducts,
  retrieveStripePrice,
} from "@/lib/stripe";
import type { StripePriceSummary, StripeProductSummary } from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();
const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const normalizeTargetIdentifier = (value: string | undefined) =>
  value?.trim().replace(/^@/u, "").toLowerCase() ?? "";

const planEnvKeys: Record<
  string,
  { annual: string | null; monthly: string | null }
> = {
  artist_team: {
    annual: null,
    monthly: "STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID",
  },
  fan_family: {
    annual: null,
    monthly: "STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID",
  },
  soundkit_premium_artist: {
    annual: "STRIPE_SOUNDKIT_PREMIUM_ARTIST_ANNUAL_PRICE_ID",
    monthly: "STRIPE_SOUNDKIT_PREMIUM_ARTIST_MONTHLY_PRICE_ID",
  },
  soundkit_premium_fan: {
    annual: "STRIPE_SOUNDKIT_PREMIUM_FAN_ANNUAL_PRICE_ID",
    monthly: "STRIPE_SOUNDKIT_PREMIUM_FAN_MONTHLY_PRICE_ID",
  },
};

interface DefaultPlanItem {
  annualPriceCents: number;
  audience: "artist" | "fan";
  code: string;
  entitlements: Record<string, boolean | number | string>;
  isActive: boolean;
  maxSeats?: number;
  monthlyPriceCents: number;
  name: string;
  stripeAnnualPriceId: string;
  stripeMonthlyPriceId: string;
}

const DEFAULT_PLANS: DefaultPlanItem[] = [
  {
    annualPriceCents: 22_899, // ~$228.99/yr (17% off)
    audience: "artist",
    code: "soundkit_premium_artist",
    entitlements: {
      aiStudioCreditsMonthly: 500,
      canCreateLiveBattles: true,
      canHostLiveStreams: true,
      masterTrackDiscountPercent: 50,
      stemSeparationUnlimited: true,
    },
    isActive: true,
    monthlyPriceCents: 2299, // $22.99/mo
    name: "SoundKit Premium Artist",
    stripeAnnualPriceId: "",
    stripeMonthlyPriceId: "",
  },
  {
    annualPriceCents: 9999, // ~$99.99/yr (17% off)
    audience: "fan",
    code: "soundkit_premium_fan",
    entitlements: {
      accessExclusiveLiveBattles: true,
      listeningPartiesUnlimited: true,
      voteInBattleRounds: true,
    },
    isActive: true,
    monthlyPriceCents: 999, // $9.99/mo
    name: "SoundKit Premium Fan",
    stripeAnnualPriceId: "",
    stripeMonthlyPriceId: "",
  },
  {
    annualPriceCents: 49_999,
    audience: "artist",
    code: "artist_team",
    entitlements: {
      canCreateLiveBattles: true,
      canHostLiveStreams: true,
      teamSeats: 5,
    },
    isActive: true,
    maxSeats: 5,
    monthlyPriceCents: 4999,
    name: "Artist Team",
    stripeAnnualPriceId: "",
    stripeMonthlyPriceId: "",
  },
  {
    annualPriceCents: 19_999,
    audience: "fan",
    code: "fan_family",
    entitlements: {
      accessExclusiveLiveBattles: true,
      familySeats: 4,
    },
    isActive: true,
    maxSeats: 4,
    monthlyPriceCents: 1999,
    name: "Fan Family",
    stripeAnnualPriceId: "",
    stripeMonthlyPriceId: "",
  },
];

const ensureDefaultPlansSeeded = async () => {
  if (!isDatabaseConfigured()) {
    return;
  }
  const db = createDb();
  const existing = await db.select().from(planCatalog);

  if (existing.length === 0) {
    for (const plan of DEFAULT_PLANS) {
      await db.insert(planCatalog).values(plan).onConflictDoNothing();
    }
  }
};

const productIdFromPrice = (price: StripePriceSummary) =>
  typeof price.product === "string" ? price.product : price.product.id;

const productNameFromPrice = (price: StripePriceSummary) =>
  typeof price.product === "string" ? "Stripe product" : price.product.name;

const serializeStripePrice = (price: StripePriceSummary) => ({
  active: price.active,
  currency: price.currency.toUpperCase(),
  id: price.id,
  interval: price.recurring?.interval ?? null,
  lookupKey: price.lookup_key ?? null,
  planCode: price.metadata?.soundkit_plan_code ?? null,
  productId: productIdFromPrice(price),
  productName: productNameFromPrice(price),
  unitAmount: price.unit_amount ?? null,
});

export interface StripePriceOption {
  currency: string;
  id: string;
  interval: string | null;
  planCode: string | null;
  productName: string;
  unitAmount: number | null;
}

const serializePlan = (plan: typeof planCatalog.$inferSelect) => {
  const envKeys = planEnvKeys[plan.code] ?? { annual: null, monthly: null };

  return {
    annualPriceCents: plan.annualPriceCents,
    audience: plan.audience,
    code: plan.code,
    envAnnualKey: envKeys.annual,
    envAnnualPriceId: envKeys.annual
      ? getEnvValue(envKeys.annual) || plan.stripeAnnualPriceId
      : plan.stripeAnnualPriceId,
    envMonthlyKey: envKeys.monthly,
    envMonthlyPriceId: envKeys.monthly
      ? getEnvValue(envKeys.monthly) || plan.stripeMonthlyPriceId
      : plan.stripeMonthlyPriceId,
    isActive: plan.isActive,
    maxSeats: plan.maxSeats,
    monthlyPriceCents: plan.monthlyPriceCents,
    name: plan.name,
    stripeAnnualPriceId: plan.stripeAnnualPriceId,
    stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
  };
};

const findProductForPlan = (
  products: StripeProductSummary[],
  plan: typeof planCatalog.$inferSelect
) =>
  products.find(
    (product) => product.metadata?.soundkit_plan_code === plan.code
  ) ??
  products.find((product) =>
    product.name.trim().toLowerCase().includes(plan.name.trim().toLowerCase())
  );

const validateStripePriceImport = async ({
  annualPriceId,
  monthlyPriceId,
}: {
  annualPriceId: string | null;
  monthlyPriceId: string | null;
}) => {
  if (!(monthlyPriceId || annualPriceId)) {
    return "Add at least one Stripe price ID.";
  }

  if (getEnvValue("STRIPE_SECRET_KEY")) {
    const [monthlyPrice, annualPrice] = await Promise.all([
      monthlyPriceId ? retrieveStripePrice(monthlyPriceId) : null,
      annualPriceId ? retrieveStripePrice(annualPriceId) : null,
    ]);

    if (monthlyPriceId && monthlyPrice?.recurring?.interval !== "month") {
      return "The monthly Stripe price ID must be a monthly price.";
    }

    if (annualPriceId && annualPrice?.recurring?.interval !== "year") {
      return "The annual Stripe price ID must be a yearly price.";
    }
  }

  return null;
};

const loadPaymentOverview = async () => {
  await ensureDefaultPlansSeeded();

  if (!isDatabaseConfigured()) {
    return {
      configuredCheckoutPlans: 0,
      planCount: 0,
      plans: [],
      recentTransactions: [],
      stripeConfigured: Boolean(getEnvValue("STRIPE_SECRET_KEY")),
      stripePrices: [],
      totals: {
        grossRevenueCents: 0,
        platformFeeCents: 0,
        successfulTransactions: 0,
      },
    };
  }

  const db = createDb();
  const [
    plans,
    [transactionSummary],
    [feeSummary],
    recentTransactions,
    stripePrices,
  ] = await Promise.all([
    db
      .select()
      .from(planCatalog)
      .orderBy(planCatalog.audience, planCatalog.code),
    db
      .select({
        amountCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(eq(transactions.status, "succeeded")),
    db
      .select({
        amountCents: sql<number>`coalesce(sum(${platformFees.amountCents}), 0)`,
      })
      .from(platformFees),
    db
      .select({
        amountCents: transactions.amountCents,
        createdAt: transactions.createdAt,
        currency: transactions.currency,
        id: transactions.id,
        platformFeeCents: transactions.platformFeeCents,
        status: transactions.status,
        transactionType: transactions.transactionType,
      })
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(12),
    listStripePrices().catch(() => null),
  ]);
  const serializedPlans = plans.map(serializePlan);

  const priceList = stripePrices?.data?.map(serializeStripePrice) ?? [];

  return {
    configuredCheckoutPlans: serializedPlans.filter(
      (plan) => plan.stripeMonthlyPriceId || plan.envMonthlyPriceId
    ).length,
    planCount: plans.length,
    plans: serializedPlans,
    recentTransactions: recentTransactions.map((transaction) => ({
      ...transaction,
      createdAt: transaction.createdAt.toISOString(),
    })),
    stripeConfigured: true,
    stripePrices: priceList,
    totals: {
      grossRevenueCents: Number(transactionSummary?.amountCents ?? 0),
      platformFeeCents: Number(feeSummary?.amountCents ?? 0),
      successfulTransactions: Number(transactionSummary?.count ?? 0),
    },
  };
};

const resolveAdminTargetUser = async ({
  email,
  target,
  userId,
}: {
  email?: string;
  target?: string;
  userId?: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();
  const normalizedTarget = normalizeTargetIdentifier(target);
  const normalizedEmail =
    email?.trim().toLowerCase() ||
    (normalizedTarget.includes("@") ? normalizedTarget : "");
  const normalizedUserId = userId?.trim() || "";
  const normalizedUsername =
    normalizedTarget && !normalizedTarget.includes("@") ? normalizedTarget : "";

  if (!(normalizedUserId || normalizedEmail || normalizedUsername)) {
    return null;
  }

  const [targetUser] = await db
    .select({
      email: user.email,
      id: user.id,
      name: user.name,
      username: userProfiles.username,
    })
    .from(user)
    .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
    .where(
      or(
        normalizedUserId ? eq(user.id, normalizedUserId) : undefined,
        normalizedEmail ? eq(user.email, normalizedEmail) : undefined,
        normalizedUsername
          ? eq(userProfiles.username, normalizedUsername)
          : undefined
      )
    )
    .limit(1);

  return targetUser ?? null;
};

const loadAiCreditBalance = async (userId: string) => {
  const [balance] = await createDb()
    .select({
      amount: sql<number>`coalesce(sum(${aiCreditGrants.amount}), 0)`,
    })
    .from(aiCreditGrants)
    .where(eq(aiCreditGrants.userId, userId));

  return Number(balance?.amount ?? 0);
};

app.openapi(
  createRoute({
    method: "get",
    path: "/summary",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminFinanceSummarySchema,
        "Finance summary"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin Finance"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          platformFeeCents: 0,
          successfulTransactionCents: 0,
          transactionCount: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const [transactionSummary] = await db
      .select({
        amountCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(eq(transactions.status, "succeeded"));
    const [feeSummary] = await db
      .select({
        amountCents: sql<number>`coalesce(sum(${platformFees.amountCents}), 0)`,
      })
      .from(platformFees);

    return c.json(
      {
        platformFeeCents: Number(feeSummary?.amountCents ?? 0),
        successfulTransactionCents: Number(
          transactionSummary?.amountCents ?? 0
        ),
        transactionCount: Number(transactionSummary?.count ?? 0),
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/payments",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminPaymentsOverviewSchema,
        "Payment operations overview"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin Finance"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    return c.json(await loadPaymentOverview(), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/payments/sync-plans",
    request: {
      body: jsonContent(
        adminSyncStripePlansBodySchema,
        "Optional plan codes to sync"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminSyncStripePlansResponseSchema,
        "Sync outcome per plan"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin Finance"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    await ensureDefaultPlansSeeded();

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          message: "Database is required to sync Stripe plans.",
          results: [],
        },
        HttpStatusCodes.OK
      );
    }

    if (!getEnvValue("STRIPE_SECRET_KEY")) {
      return c.json(
        {
          message: "STRIPE_SECRET_KEY is required to sync Stripe plans.",
          results: [],
        },
        HttpStatusCodes.OK
      );
    }

    const body = (await c.req.json().catch(() => ({}))) as {
      planCodes?: string[];
    };
    const db = createDb();
    const plans =
      body.planCodes && body.planCodes.length > 0
        ? await db
            .select()
            .from(planCatalog)
            .where(inArray(planCatalog.code, body.planCodes))
        : await db
            .select()
            .from(planCatalog)
            .where(eq(planCatalog.isActive, true));

    const productList = await listStripeProducts().catch(() => null);
    const products = productList?.data ?? [];
    const results = [];

    for (const plan of plans) {
      let monthlyPriceId = plan.stripeMonthlyPriceId;
      let annualPriceId = plan.stripeAnnualPriceId;
      let productId = null;

      try {
        const existingProduct = findProductForPlan(products, plan);
        const product =
          existingProduct ??
          (await createStripeProduct({ code: plan.code, name: plan.name }));

        if (product) {
          productId = product.id;
          if (!monthlyPriceId && plan.monthlyPriceCents > 0) {
            const price = await createStripeRecurringPrice({
              amountCents: plan.monthlyPriceCents,
              code: plan.code,
              interval: "month",
              productId: product.id,
            });
            monthlyPriceId = price?.id ?? null;
          }

          if (!annualPriceId && plan.annualPriceCents) {
            const price = await createStripeRecurringPrice({
              amountCents: plan.annualPriceCents,
              code: plan.code,
              interval: "year",
              productId: product.id,
            });
            annualPriceId = price?.id ?? null;
          }
        }
      } catch (error) {
        console.error("Stripe live sync failed", error);
      }

      if (!(monthlyPriceId || annualPriceId)) {
        results.push({
          annualPriceId,
          code: plan.code,
          monthlyPriceId,
          productId,
          status: "skipped" as const,
        });
        continue;
      }

      await db
        .update(planCatalog)
        .set({
          stripeAnnualPriceId: annualPriceId,
          stripeMonthlyPriceId: monthlyPriceId,
        })
        .where(eq(planCatalog.code, plan.code));

      results.push({
        annualPriceId,
        code: plan.code,
        monthlyPriceId,
        productId,
        status: "created" as const,
      });
    }

    return c.json(
      { message: "Stripe catalog sync completed.", results },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/payments/import-plan",
    request: {
      body: jsonContentRequired(
        adminImportStripePlanBodySchema,
        "Imported Stripe price IDs"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminPaymentsOverviewSchema,
        "Updated payment operations overview"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid Stripe price"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin Finance"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json");
    const monthlyPriceId = body.monthlyPriceId?.trim() || null;
    const annualPriceId = body.annualPriceId?.trim() || null;

    const validationMessage = await validateStripePriceImport({
      annualPriceId,
      monthlyPriceId,
    });

    if (validationMessage) {
      return c.json(
        { message: validationMessage },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (isDatabaseConfigured()) {
      await createDb()
        .update(planCatalog)
        .set({
          ...(annualPriceId ? { stripeAnnualPriceId: annualPriceId } : {}),
          ...(monthlyPriceId ? { stripeMonthlyPriceId: monthlyPriceId } : {}),
        })
        .where(eq(planCatalog.code, body.code));
    }

    return c.json(await loadPaymentOverview(), HttpStatusCodes.OK);
  }
);

app.get("/payments/coupons", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }

  if (!getEnvValue("STRIPE_SECRET_KEY")) {
    return c.json(
      {
        coupons: [],
        message: "STRIPE_SECRET_KEY is required to list Stripe coupons.",
        stripeConfigured: false,
      },
      HttpStatusCodes.OK
    );
  }

  const stripeCoupons = await listStripeCoupons().catch(() => null);

  if (!stripeCoupons) {
    return c.json(
      {
        coupons: [],
        message: "Unable to load Stripe coupons.",
        stripeConfigured: true,
      },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return c.json(
    { coupons: stripeCoupons.data, stripeConfigured: true },
    HttpStatusCodes.OK
  );
});

app.post("/payments/coupons", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    amountOff?: number;
    appliesToProducts?: string[];
    currency?: string;
    duration?: "once" | "repeating" | "forever";
    durationInMonths?: number;
    id?: string;
    maxRedemptions?: number;
    metadata?: Record<string, string>;
    name?: string;
    percentOff?: number;
    redeemBy?: number;
  };

  if (!body.name) {
    return c.json(
      { message: "Coupon name is required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  if (!getEnvValue("STRIPE_SECRET_KEY")) {
    return c.json(
      { message: "STRIPE_SECRET_KEY is required to create Stripe coupons." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const createdCoupon = await createStripeCoupon({
    amountOff: body.amountOff,
    appliesToProducts: body.appliesToProducts,
    currency: body.currency ?? "usd",
    duration: body.duration ?? "once",
    durationInMonths: body.durationInMonths,
    id: body.id,
    maxRedemptions: body.maxRedemptions,
    metadata: body.metadata,
    name: body.name,
    percentOff: body.percentOff,
    redeemBy: body.redeemBy,
  }).catch(() => null);

  if (!createdCoupon) {
    return c.json(
      { message: "Stripe coupon creation failed." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return c.json(
    { coupon: createdCoupon, message: "Coupon created successfully." },
    HttpStatusCodes.OK
  );
});

app.delete("/payments/coupons/:id", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const couponId = c.req.param("id");
  if (!couponId) {
    return c.json(
      { message: "Coupon ID is required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  if (!getEnvValue("STRIPE_SECRET_KEY")) {
    return c.json(
      { message: "STRIPE_SECRET_KEY is required to delete Stripe coupons." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const deletedCoupon = await deleteStripeCoupon(couponId).catch(() => null);

  if (!deletedCoupon) {
    return c.json(
      { message: "Stripe coupon deletion failed." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return c.json(
    { id: couponId, message: `Coupon ${couponId} archived/deleted.` },
    HttpStatusCodes.OK
  );
});

app.post("/payments/grant-premium", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }

  if (!isDatabaseConfigured()) {
    return c.json(
      { message: "Database is required to grant premium access." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    planCode?: string;
    referenceId?: string;
    target?: string;
    userId?: string;
  };
  const planCode = body.planCode?.trim() || "soundkit_premium_artist";
  await ensureDefaultPlansSeeded();
  const db = createDb();
  const targetUser = await resolveAdminTargetUser({
    email: body.email,
    target: body.target,
    userId: body.userId,
  });

  if (!targetUser) {
    return c.json(
      { message: "Target user was not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }

  const referenceId = body.referenceId?.trim() || targetUser.id;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  const [plan] = await db
    .select({ entitlements: planCatalog.entitlements })
    .from(planCatalog)
    .where(eq(planCatalog.code, planCode))
    .limit(1);

  const [existing] = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, referenceId),
        eq(subscription.plan, planCode)
      )
    )
    .limit(1);

  const subscriptionId = existing?.id ?? crypto.randomUUID();

  await (existing
    ? db
        .update(subscription)
        .set({
          billingInterval: "year",
          cancelAt: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          endedAt: null,
          periodEnd,
          periodStart: now,
          status: "active",
        })
        .where(eq(subscription.id, existing.id))
    : db.insert(subscription).values({
        billingInterval: "year",
        cancelAtPeriodEnd: false,
        id: subscriptionId,
        periodEnd,
        periodStart: now,
        plan: planCode,
        referenceId,
        seats: 1,
        status: "active",
      }));

  await db
    .delete(subscriptionEntitlements)
    .where(eq(subscriptionEntitlements.subscriptionId, subscriptionId));

  const entitlementRows = Object.entries({
    is_premium: true,
    premium_access: true,
    ...plan?.entitlements,
  }).map(([key, value]) => ({
    entitlementKey: key,
    entitlementValue: String(value),
    id: crypto.randomUUID(),
    subscriptionId,
  }));

  if (entitlementRows.length > 0) {
    await db.insert(subscriptionEntitlements).values(entitlementRows);
  }

  return c.json(
    {
      message: "Premium access granted.",
      planCode,
      referenceId,
      subscriptionId,
      user: targetUser,
    },
    HttpStatusCodes.OK
  );
});

// --- AI Credits & Upsell Endpoint ---
app.post("/payments/issue-credits", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }

  if (!isDatabaseConfigured()) {
    return c.json(
      { message: "Database is required to issue AI credits." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    credits?: number;
    email?: string;
    reason?: string;
    target?: string;
    userId?: string;
  };
  const credits = Number(body.credits ?? 0);

  if (!Number.isInteger(credits) || credits <= 0) {
    return c.json(
      { message: "A positive integer credit count is required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const targetUser = await resolveAdminTargetUser({
    email: body.email,
    target: body.target,
    userId: body.userId,
  });

  if (!targetUser) {
    return c.json(
      { message: "Target user was not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }

  const grantId = crypto.randomUUID();
  const reason = body.reason?.trim() || "Administrative grant";
  await createDb()
    .insert(aiCreditGrants)
    .values({
      amount: credits,
      grantedByUserId: c.get("user")?.id ?? null,
      id: grantId,
      reason,
      source: "admin_grant",
      userId: targetUser.id,
    });

  const balance = await loadAiCreditBalance(targetUser.id);

  return c.json(
    {
      balance,
      creditsIssued: credits,
      grantId,
      message: `Successfully issued ${credits} AI credits to ${targetUser.email}.`,
      reason,
      user: targetUser,
      userId: targetUser.id,
    },
    HttpStatusCodes.OK
  );
});

export default app;
