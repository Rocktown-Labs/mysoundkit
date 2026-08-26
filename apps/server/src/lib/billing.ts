import { createAuth } from "@soundkit/auth";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { planCatalog } from "@soundkit/db/schema/plans";
import { eq } from "drizzle-orm";

import { CONFIGURED_PAID_PLAN_CODES, FREE_PLAN_CODES } from "@/lib/plan-codes";

const FALLBACK_PLANS = [
  {
    annualPriceCents: 0,
    audience: "artist" as const,
    code: "artist_free",
    entitlements: {},
    isActive: true,
    maxSeats: 1,
    monthlyPriceCents: 0,
    name: "SoundKit Free Artist",
    stripeAnnualPriceId: null,
    stripeMonthlyPriceId: null,
  },
  {
    annualPriceCents: 22_899,
    audience: "artist" as const,
    code: "soundkit_premium_artist",
    entitlements: { canCreateLiveBattles: true, canHostLiveStreams: true },
    isActive: true,
    maxSeats: 5,
    monthlyPriceCents: 2299,
    name: "SoundKit Premium Artist",
    stripeAnnualPriceId: null,
    stripeMonthlyPriceId: null,
  },
  {
    annualPriceCents: 0,
    audience: "fan" as const,
    code: "fan_free",
    entitlements: {},
    isActive: true,
    maxSeats: 1,
    monthlyPriceCents: 0,
    name: "SoundKit Free Fan",
    stripeAnnualPriceId: null,
    stripeMonthlyPriceId: null,
  },
  {
    annualPriceCents: 22_899,
    audience: "fan" as const,
    code: "soundkit_premium_fan",
    entitlements: {
      accessExclusiveLiveBattles: true,
      listeningPartiesUnlimited: true,
      voteInBattleRounds: true,
    },
    isActive: true,
    maxSeats: 5,
    monthlyPriceCents: 2299,
    name: "SoundKit Premium Fan",
    stripeAnnualPriceId: null,
    stripeMonthlyPriceId: null,
  },
] as const;
import { billableSeatsForCheckout } from "@/lib/plan-seats";

export const isFreePlan = (planCode: string) => FREE_PLAN_CODES.has(planCode);

export const getConfiguredPlanCodes = () => CONFIGURED_PAID_PLAN_CODES;

export const createPlanCheckout = async ({
  cancelUrl,
  customerType = "organization",
  planCode,
  referenceId,
  request,
  seats,
  successUrl,
}: {
  cancelUrl: string;
  customerType?: "organization" | "user";
  planCode: string;
  referenceId: string;
  request: Request;
  seats?: number;
  successUrl: string;
}) => {
  if (isFreePlan(planCode)) {
    return {
      checkoutUrl: null,
      requiresCheckout: false,
      setupRequired: false,
    };
  }

  if (!getConfiguredPlanCodes().has(planCode)) {
    return {
      checkoutUrl: null,
      requiresCheckout: false,
      setupRequired: true,
    };
  }

  const auth = createAuth();

  if (!("upgradeSubscription" in auth.api)) {
    return {
      checkoutUrl: null,
      requiresCheckout: true,
      setupRequired: true,
    };
  }

  try {
    const upgradeSubscription = auth.api.upgradeSubscription as (input: {
        body: {
          cancelUrl: string;
          customerType: "organization" | "user";
          disableRedirect: boolean;
          plan: string;
          referenceId: string;
          seats?: number;
          successUrl: string;
        };
        headers: Headers;
      }) => Promise<unknown>,
      result = await upgradeSubscription({
        body: {
          cancelUrl,
          customerType,
          disableRedirect: true,
          plan: planCode,
          referenceId,
          seats: billableSeatsForCheckout({ planCode, seats }),
          successUrl,
        },
        headers: request.headers,
      }),
      url =
        typeof result === "object" &&
        result !== null &&
        "url" in result &&
        typeof result.url === "string"
          ? result.url
          : null;

    return {
      checkoutUrl: url,
      requiresCheckout: Boolean(url),
      setupRequired: !url,
    };
  } catch {
    return {
      checkoutUrl: null,
      requiresCheckout: true,
      setupRequired: true,
    };
  }
};

export const getPlanRows = async () => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = createDb(),
    rows = await db.select().from(planCatalog);

  if (rows.length === 0) {
    return [...FALLBACK_PLANS];
  }

  const allowedRows = rows.filter(
      (plan) =>
        FREE_PLAN_CODES.has(plan.code) ||
        CONFIGURED_PAID_PLAN_CODES.has(plan.code)
    ),
    rowsByCode = new Map(allowedRows.map((plan) => [plan.code, plan]));

  return FALLBACK_PLANS.map(
    (fallback) => rowsByCode.get(fallback.code) ?? fallback
  );
};

export const getPlanByCode = async (code: string) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb(),
    [plan] = await db
      .select()
      .from(planCatalog)
      .where(eq(planCatalog.code, code))
      .limit(1);

  return plan ?? null;
};
