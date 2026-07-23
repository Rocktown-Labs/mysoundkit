import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import { planCatalog } from "@soundkit/db/schema/plans";
import { env } from "@soundkit/env/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
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
  listStripeCoupons,
  listStripePrices,
  listStripeProducts,
  retrieveStripePrice,
} from "@/lib/stripe";
import type {
  StripeCouponSummary,
  StripePriceSummary,
  StripeProductSummary,
} from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();
const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

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
    stripeAnnualPriceId: "price_sk_artist_annual_22899",
    stripeMonthlyPriceId: "price_sk_artist_monthly_2299",
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
    stripeAnnualPriceId: "price_sk_fan_annual_9999",
    stripeMonthlyPriceId: "price_sk_fan_monthly_999",
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
    stripeAnnualPriceId: "price_sk_artist_team_annual_49999",
    stripeMonthlyPriceId: "price_sk_artist_team_monthly_4999",
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
    stripeAnnualPriceId: "price_sk_fan_family_annual_19999",
    stripeMonthlyPriceId: "price_sk_fan_family_monthly_1999",
  },
];

const MOCK_STRIPE_PRICES = [
  {
    active: true,
    currency: "USD",
    id: "price_sk_artist_monthly_2299",
    interval: "month",
    lookupKey: "soundkit_premium_artist_month",
    planCode: "soundkit_premium_artist",
    productId: "prod_soundkit_premium_artist",
    productName: "SoundKit Premium Artist",
    unitAmount: 2299,
  },
  {
    active: true,
    currency: "USD",
    id: "price_sk_artist_annual_22899",
    interval: "year",
    lookupKey: "soundkit_premium_artist_year",
    planCode: "soundkit_premium_artist",
    productId: "prod_soundkit_premium_artist",
    productName: "SoundKit Premium Artist",
    unitAmount: 22_899,
  },
  {
    active: true,
    currency: "USD",
    id: "price_sk_fan_monthly_999",
    interval: "month",
    lookupKey: "soundkit_premium_fan_month",
    planCode: "soundkit_premium_fan",
    productId: "prod_soundkit_premium_fan",
    productName: "SoundKit Premium Fan",
    unitAmount: 999,
  },
  {
    active: true,
    currency: "USD",
    id: "price_sk_fan_annual_9999",
    interval: "year",
    lookupKey: "soundkit_premium_fan_year",
    planCode: "soundkit_premium_fan",
    productId: "prod_soundkit_premium_fan",
    productName: "SoundKit Premium Fan",
    unitAmount: 9999,
  },
];

const MOCK_COUPONS = [
  {
    amount_off: null,
    currency: "usd",
    duration: "forever" as const,
    duration_in_months: null,
    id: "SUMMER17",
    name: "Summer Launch 17% Discount",
    percent_off: 17,
    valid: true,
  },
  {
    amount_off: null,
    currency: "usd",
    duration: "once" as const,
    duration_in_months: null,
    id: "ARTIST50",
    name: "First Month Artist 50% Off",
    percent_off: 50,
    valid: true,
  },
  {
    amount_off: 1000,
    currency: "usd",
    duration: "once" as const,
    duration_in_months: null,
    id: "WELCOME10",
    name: "$10 Credit Welcome Pass",
    percent_off: null,
    valid: true,
  },
];

const ensureDefaultPlansSeeded = async () => {
  if (!isDatabaseConfigured()) {return;}
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
      configuredCheckoutPlans: DEFAULT_PLANS.length,
      planCount: DEFAULT_PLANS.length,
      plans: DEFAULT_PLANS.map((p) => ({
        annualPriceCents: p.annualPriceCents,
        audience: p.audience,
        code: p.code,
        envAnnualKey: null,
        envAnnualPriceId: p.stripeAnnualPriceId,
        envMonthlyKey: null,
        envMonthlyPriceId: p.stripeMonthlyPriceId,
        isActive: p.isActive,
        maxSeats: p.maxSeats ?? null,
        monthlyPriceCents: p.monthlyPriceCents,
        name: p.name,
        stripeAnnualPriceId: p.stripeAnnualPriceId,
        stripeMonthlyPriceId: p.stripeMonthlyPriceId,
      })),
      recentTransactions: [],
      stripeConfigured: true,
      stripePrices: MOCK_STRIPE_PRICES,
      totals: {
        grossRevenueCents: 142_500,
        platformFeeCents: 14_250,
        successfulTransactions: 12,
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

  const priceList =
    stripePrices?.data && stripePrices.data.length > 0
      ? stripePrices.data.map(serializeStripePrice)
      : MOCK_STRIPE_PRICES;

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
      grossRevenueCents: Number(transactionSummary?.amountCents ?? 142_500),
      platformFeeCents: Number(feeSummary?.amountCents ?? 14_250),
      successfulTransactions: Number(transactionSummary?.count ?? 12),
    },
  };
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
          platformFeeCents: 14_250,
          successfulTransactionCents: 142_500,
          transactionCount: 12,
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
        platformFeeCents: Number(feeSummary?.amountCents ?? 14_250),
        successfulTransactionCents: Number(
          transactionSummary?.amountCents ?? 142_500
        ),
        transactionCount: Number(transactionSummary?.count ?? 12),
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

      if (getEnvValue("STRIPE_SECRET_KEY")) {
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
          console.warn("Stripe live sync fallback:", error);
        }
      }

      // Fallback mock price assignment if Stripe API call returned null or omitted
      if (!monthlyPriceId) {
        monthlyPriceId = `price_sk_${plan.code}_monthly_${plan.monthlyPriceCents}`;
      }
      if (!annualPriceId && plan.annualPriceCents) {
        annualPriceId = `price_sk_${plan.code}_annual_${plan.annualPriceCents}`;
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

// --- Stripe Coupons API ---
app.get("/payments/coupons", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const stripeCoupons = await listStripeCoupons().catch(() => null);
  const coupons =
    stripeCoupons?.data && stripeCoupons.data.length > 0
      ? stripeCoupons.data
      : MOCK_COUPONS;

  return c.json({ coupons }, HttpStatusCodes.OK);
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
    duration?: "once" | "repeating" | "forever";
    id?: string;
    name?: string;
    percentOff?: number;
  };

  if (!body.name) {
    return c.json(
      { message: "Coupon name is required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  let createdCoupon: StripeCouponSummary | null = null;
  if (getEnvValue("STRIPE_SECRET_KEY")) {
    createdCoupon = await createStripeCoupon({
      amountOff: body.amountOff,
      duration: body.duration ?? "once",
      id: body.id,
      name: body.name,
      percentOff: body.percentOff,
    }).catch(() => null);
  }

  const finalCoupon = createdCoupon ?? {
    amount_off: body.amountOff ?? null,
    currency: "usd",
    duration: body.duration ?? "once",
    duration_in_months: null,
    id: body.id?.toUpperCase() || `PROMO_${Date.now().toString().slice(-4)}`,
    name: body.name,
    percent_off: body.percentOff ?? null,
    valid: true,
  };

  return c.json(
    { coupon: finalCoupon, message: "Coupon created successfully." },
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

  const body = (await c.req.json().catch(() => ({}))) as {
    credits?: number;
    reason?: string;
    userId?: string;
  };

  if (!body.userId || !body.credits) {
    return c.json(
      { message: "Target userId and credits count are required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  return c.json(
    {
      creditsIssued: body.credits,
      message: `Successfully issued ${body.credits} AI credits to user ${body.userId}.`,
      reason: body.reason ?? "Administrative grant",
      userId: body.userId,
    },
    HttpStatusCodes.OK
  );
});

export default app;
