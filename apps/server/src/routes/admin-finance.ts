import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
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
  adminImportStripePlanBodySchema,
  adminPaymentsOverviewSchema,
  adminSyncStripePlansBodySchema,
  adminSyncStripePlansResponseSchema,
  messageResponseSchema,
} from "@/lib/schemas";
import {
  createStripeProduct,
  createStripeRecurringPrice,
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
  artist_premium: {
    annual: "STRIPE_ARTIST_PREMIUM_ANNUAL_PRICE_ID",
    monthly: "STRIPE_ARTIST_PREMIUM_MONTHLY_PRICE_ID",
  },
  artist_team: {
    annual: null,
    monthly: "STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID",
  },
  fan_family: {
    annual: null,
    monthly: "STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID",
  },
  listener_premium: {
    annual: "STRIPE_LISTENER_PREMIUM_ANNUAL_PRICE_ID",
    monthly: "STRIPE_LISTENER_PREMIUM_MONTHLY_PRICE_ID",
  },
};

const summarySchema = z.object({
  platformFeeCents: z.number().int(),
  successfulTransactionCents: z.number().int(),
  transactionCount: z.number().int(),
});

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

const serializePlan = (plan: typeof planCatalog.$inferSelect) => {
  const envKeys = planEnvKeys[plan.code] ?? { annual: null, monthly: null };

  return {
    annualPriceCents: plan.annualPriceCents,
    audience: plan.audience,
    code: plan.code,
    envAnnualKey: envKeys.annual,
    envAnnualPriceId: envKeys.annual
      ? getEnvValue(envKeys.annual) || null
      : null,
    envMonthlyKey: envKeys.monthly,
    envMonthlyPriceId: envKeys.monthly
      ? getEnvValue(envKeys.monthly) || null
      : null,
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

  return null;
};

const loadPaymentOverview = async () => {
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

  return {
    configuredCheckoutPlans: serializedPlans.filter(
      (plan) => plan.envMonthlyPriceId
    ).length,
    planCount: plans.length,
    plans: serializedPlans,
    recentTransactions: recentTransactions.map((transaction) => ({
      ...transaction,
      createdAt: transaction.createdAt.toISOString(),
    })),
    stripeConfigured: Boolean(getEnvValue("STRIPE_SECRET_KEY")),
    stripePrices: stripePrices?.data.map(serializeStripePrice) ?? [],
    totals: {
      grossRevenueCents: Number(transactionSummary?.amountCents ?? 0),
      platformFeeCents: Number(feeSummary?.amountCents ?? 0),
      successfulTransactions: Number(transactionSummary?.count ?? 0),
    },
  };
};

app.openapi(
  createRoute({
    method: "get",
    path: "/summary",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(summarySchema, "Finance summary"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Admin required"
      ),
    },
    tags: ["Admin Finance"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAdminUser(user)) {
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
      .from(transactions);
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
        "Admin payment operations overview"
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
      body: jsonContentRequired(
        adminSyncStripePlansBodySchema,
        "Plans to sync with Stripe"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminSyncStripePlansResponseSchema,
        "Stripe sync result"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Stripe unavailable"
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

    if (!(isDatabaseConfigured() && getEnvValue("STRIPE_SECRET_KEY"))) {
      return c.json(
        { message: "Stripe and the database must be configured first." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const body = c.req.valid("json");
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
    const productList = await listStripeProducts();
    const products = productList?.data ?? [];
    const results = [];

    for (const plan of plans) {
      if (plan.monthlyPriceCents <= 0) {
        results.push({
          annualPriceId: plan.stripeAnnualPriceId,
          code: plan.code,
          monthlyPriceId: plan.stripeMonthlyPriceId,
          productId: null,
          status: "skipped" as const,
        });
        continue;
      }

      const existingProduct = findProductForPlan(products, plan);
      const product =
        existingProduct ??
        (await createStripeProduct({ code: plan.code, name: plan.name }));

      if (!product) {
        throw new Error("Stripe product creation returned no product.");
      }

      let monthlyPriceId = plan.stripeMonthlyPriceId;
      let annualPriceId = plan.stripeAnnualPriceId;

      if (!monthlyPriceId) {
        const price = await createStripeRecurringPrice({
          amountCents: plan.monthlyPriceCents,
          code: plan.code,
          interval: "month",
          productId: product.id,
        });
        monthlyPriceId = price?.id ?? null;
      }

      if (plan.annualPriceCents && !annualPriceId) {
        const price = await createStripeRecurringPrice({
          amountCents: plan.annualPriceCents,
          code: plan.code,
          interval: "year",
          productId: product.id,
        });
        annualPriceId = price?.id ?? null;
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
        productId: product.id,
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
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Stripe unavailable"
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

    if (!(isDatabaseConfigured() && getEnvValue("STRIPE_SECRET_KEY"))) {
      return c.json(
        { message: "Stripe and the database must be configured first." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
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

    await createDb()
      .update(planCatalog)
      .set({
        ...(annualPriceId ? { stripeAnnualPriceId: annualPriceId } : {}),
        ...(monthlyPriceId ? { stripeMonthlyPriceId: monthlyPriceId } : {}),
      })
      .where(eq(planCatalog.code, body.code));

    return c.json(await loadPaymentOverview(), HttpStatusCodes.OK);
  }
);

export default app;
