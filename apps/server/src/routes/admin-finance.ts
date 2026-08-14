import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userNotifications, userProfiles } from "@soundkit/db/schema/app";
import { subscription, user } from "@soundkit/db/schema/auth";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import {
  planCatalog,
  subscriptionEntitlements,
} from "@soundkit/db/schema/plans";
import { env } from "@soundkit/env/server";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAdminUser } from "@/lib/admin";
import { enqueueTransactionalEmail } from "@/lib/email-delivery";
import {
  adminFinanceSummarySchema,
  adminImportStripePlanBodySchema,
  adminPaymentsOverviewSchema,
  adminSyncStripePlansBodySchema,
  adminSyncStripePlansResponseSchema,
  messageResponseSchema,
} from "@/lib/schemas";
import {
  archiveStripePromotionCode,
  createStripeCoupon,
  createStripeProduct,
  createStripePromotionCode,
  createStripeRecurringPrice,
  listStripePromotionCodes,
  listStripePrices,
  listStripeProducts,
  retrieveStripePrice,
} from "@/lib/stripe";
import type { StripePriceSummary, StripeProductSummary } from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();
const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const planEnvKeys: Record<
  string,
  { annual: string | null; monthly: string | null }
> = {
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
    annualPriceCents: 22_899,
    audience: "artist",
    code: "soundkit_premium_artist",
    entitlements: {
      canCreateLiveBattles: true,
      canHostLiveStreams: true,
    },
    isActive: true,
    monthlyPriceCents: 2299,
    name: "SoundKit Premium Artist",
    stripeAnnualPriceId: "",
    stripeMonthlyPriceId: "",
  },
  {
    annualPriceCents: 22_899,
    audience: "fan",
    code: "soundkit_premium_fan",
    entitlements: {
      accessExclusiveLiveBattles: true,
      listeningPartiesUnlimited: true,
      voteInBattleRounds: true,
    },
    isActive: true,
    monthlyPriceCents: 2299,
    name: "SoundKit Premium Fan",
    stripeAnnualPriceId: "",
    stripeMonthlyPriceId: "",
  },
];

const ensureDefaultPlansSeeded = async () => {
  if (!isDatabaseConfigured()) {
    return;
  }
  const db = createDb();
  await db
    .delete(planCatalog)
    .where(inArray(planCatalog.code, ["artist_team", "fan_family"]));
  for (const plan of DEFAULT_PLANS) {
    await db
      .insert(planCatalog)
      .values(plan)
      .onConflictDoUpdate({
        set: {
          annualPriceCents: plan.annualPriceCents,
          entitlements: plan.entitlements,
          isActive: true,
          monthlyPriceCents: plan.monthlyPriceCents,
          name: plan.name,
        },
        target: planCatalog.code,
      });
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

const discardMismatchedPriceIds = async ({
  annualPriceCents,
  annualPriceId,
  monthlyPriceCents,
  monthlyPriceId,
}: {
  annualPriceCents: number | null;
  annualPriceId: string | null;
  monthlyPriceCents: number;
  monthlyPriceId: string | null;
}) => {
  const [monthlyPrice, annualPrice] = await Promise.all([
    monthlyPriceId ? retrieveStripePrice(monthlyPriceId) : null,
    annualPriceId ? retrieveStripePrice(annualPriceId) : null,
  ]);

  return {
    annualPriceId:
      annualPriceCents && annualPrice?.unit_amount === annualPriceCents
        ? annualPriceId
        : null,
    monthlyPriceId:
      monthlyPrice?.unit_amount === monthlyPriceCents ? monthlyPriceId : null,
  };
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
      .where(
        inArray(
          planCatalog.code,
          DEFAULT_PLANS.map((plan) => plan.code)
        )
      )
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

app.get("/payments/users", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }
  if (!isDatabaseConfigured()) {
    return c.json({ users: [] }, HttpStatusCodes.OK);
  }

  const query = c.req.query("q")?.trim() ?? "";
  const searchTerm = `%${query}%`;
  const db = createDb();
  const users = await db
    .select({
      accountType: userProfiles.accountType,
      banned: user.banned,
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
      role: user.role,
      username: userProfiles.username,
    })
    .from(user)
    .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
    .where(
      query
        ? or(
            ilike(user.email, searchTerm),
            ilike(user.name, searchTerm),
            ilike(userProfiles.username, searchTerm)
          )
        : undefined
    )
    .orderBy(desc(user.createdAt))
    .limit(100);
  const userIds = users.map((item) => item.id);
  const activeSubscriptions = userIds.length
    ? await db
        .select({
          plan: subscription.plan,
          referenceId: subscription.referenceId,
          status: subscription.status,
        })
        .from(subscription)
        .where(
          and(
            inArray(subscription.referenceId, userIds),
            inArray(subscription.status, ["active", "trialing"])
          )
        )
    : [];
  const premiumByUser = new Map(
    activeSubscriptions.map((item) => [item.referenceId, item])
  );

  return c.json(
    {
      users: users.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        premiumPlan: premiumByUser.get(item.id)?.plan ?? null,
        premiumStatus: premiumByUser.get(item.id)?.status ?? null,
      })),
    },
    HttpStatusCodes.OK
  );
});

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
        ({ annualPriceId, monthlyPriceId } = await discardMismatchedPriceIds({
          annualPriceCents: plan.annualPriceCents,
          annualPriceId,
          monthlyPriceCents: plan.monthlyPriceCents,
          monthlyPriceId,
        }));

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

  const stripeCoupons = await listStripePromotionCodes().catch(() => null);

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
    {
      coupons: stripeCoupons.data.map((promotionCode) => ({
        active: promotionCode.active,
        code: promotionCode.code,
        coupon:
          typeof promotionCode.promotion.coupon === "string"
            ? {
                duration: "once" as const,
                id: promotionCode.promotion.coupon,
                name: promotionCode.code,
              }
            : promotionCode.promotion.coupon,
        id: promotionCode.id,
        max_redemptions: promotionCode.max_redemptions ?? null,
        times_redeemed: promotionCode.times_redeemed,
      })),
      stripeConfigured: true,
    },
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
    code?: string;
    maxRedemptions?: number;
    metadata?: Record<string, string>;
    name?: string;
    percentOff?: number;
    redeemBy?: number;
  };

  if (!(body.name?.trim() && body.code?.trim())) {
    return c.json(
      { message: "Coupon name and promo code are required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  if (
    !Number.isFinite(body.percentOff) ||
    (body.percentOff ?? 0) <= 0 ||
    (body.percentOff ?? 0) > 100
  ) {
    return c.json(
      { message: "Percentage discount must be between 1 and 100." },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  if (
    body.maxRedemptions !== undefined &&
    (!Number.isInteger(body.maxRedemptions) || body.maxRedemptions <= 0)
  ) {
    return c.json(
      { message: "Maximum redemptions must be a positive whole number." },
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
    metadata: body.metadata,
    name: body.name.trim(),
    percentOff: body.percentOff,
    redeemBy: body.redeemBy,
  }).catch(() => null);

  if (!createdCoupon) {
    return c.json(
      { message: "Stripe coupon creation failed." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const promotionCode = await createStripePromotionCode({
    code: body.code.trim().toUpperCase(),
    couponId: createdCoupon.id,
    maxRedemptions: body.maxRedemptions,
  }).catch(() => null);

  if (!promotionCode) {
    return c.json(
      {
        message:
          "Coupon was created, but its promotion code could not be created.",
      },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return c.json(
    {
      coupon: promotionCode,
      message: `Promo code ${promotionCode.code} created successfully.`,
    },
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

  const deletedCoupon = await archiveStripePromotionCode(couponId).catch(
    () => null
  );

  if (!deletedCoupon) {
    return c.json(
      { message: "Stripe coupon deletion failed." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return c.json(
    { id: couponId, message: `Promotion code ${couponId} archived.` },
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
    planCode?: string;
    userIds?: string[];
  };
  const premiumPlanCodes = [
    "soundkit_premium_artist",
    "soundkit_premium_fan",
  ] as const;
  const planCode = body.planCode?.trim() || "soundkit_premium_artist";
  if (
    !premiumPlanCodes.includes(planCode as (typeof premiumPlanCodes)[number])
  ) {
    return c.json(
      { message: "Select the artist or fan SoundKit Premium plan." },
      HttpStatusCodes.BAD_REQUEST
    );
  }
  const userIds = [...new Set(body.userIds)].slice(0, 50);
  if (userIds.length === 0) {
    return c.json(
      { message: "Select at least one user." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  await ensureDefaultPlansSeeded();
  const db = createDb();
  const targets = await db
    .select({
      accountType: userProfiles.accountType,
      email: user.email,
      id: user.id,
      name: user.name,
    })
    .from(user)
    .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
    .where(inArray(user.id, userIds));
  if (targets.length !== userIds.length) {
    return c.json(
      { message: "One or more selected users could not be found." },
      HttpStatusCodes.NOT_FOUND
    );
  }

  const [plan] = await db
    .select({ entitlements: planCatalog.entitlements, name: planCatalog.name })
    .from(planCatalog)
    .where(eq(planCatalog.code, planCode))
    .limit(1);
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  for (const target of targets) {
    await db
      .update(subscription)
      .set({ endedAt: now, status: "ended" })
      .where(
        and(
          eq(subscription.referenceId, target.id),
          inArray(subscription.plan, [...premiumPlanCodes])
        )
      );
    const [existing] = await db
      .select({ id: subscription.id })
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, target.id),
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
          referenceId: target.id,
          seats: 1,
          status: "active",
        }));

    await db
      .delete(subscriptionEntitlements)
      .where(eq(subscriptionEntitlements.subscriptionId, subscriptionId));
    await db.insert(subscriptionEntitlements).values(
      Object.entries({
        is_premium: true,
        premium_access: true,
        ...plan?.entitlements,
      }).map(([key, value]) => ({
        entitlementKey: key,
        entitlementValue: String(value),
        id: crypto.randomUUID(),
        subscriptionId,
      }))
    );
    const premiumLandingPath =
      target.accountType === "artist" ? "/dashboard/career/payments" : "/";
    await db
      .insert(userNotifications)
      .values({
        id: `premium_grant:${subscriptionId}:${now.toISOString()}`,
        link: premiumLandingPath,
        message: `You've been selected for ${plan?.name ?? "SoundKit Premium"}. Welcome to Premium!`,
        title: "Welcome to SoundKit Premium",
        type: "premium_granted",
        userId: target.id,
      })
      .onConflictDoNothing();
    await enqueueTransactionalEmail({
      actionPath: premiumLandingPath,
      idempotencyKey: `premium_grant:${subscriptionId}:${now.toISOString()}`,
      payload: {
        body: `You've been selected to receive ${plan?.name ?? "SoundKit Premium"}. Your Premium access is active now and will remain available for one year.`,
        ctaLabel: "Explore Premium",
        eyebrow: "SoundKit Premium",
        footerNote:
          "This account-access email was sent because a SoundKit administrator granted Premium to your account.",
        heading: "Welcome to SoundKit Premium",
        previewText: "Your complimentary SoundKit Premium access is active.",
        subject: "You've been selected for SoundKit Premium",
      },
      queue: c.env.EMAIL_DELIVERY_QUEUE,
      recipientEmail: target.email,
      recipientName: target.name ?? "there",
      template: "welcome_premium",
      userId: target.id,
    });
  }

  return c.json(
    {
      grantedCount: targets.length,
      message: `Premium access granted to ${targets.length} user${targets.length === 1 ? "" : "s"}.`,
      planCode,
      users: targets,
    },
    HttpStatusCodes.OK
  );
});

export default app;
