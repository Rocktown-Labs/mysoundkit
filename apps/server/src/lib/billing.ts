import { createAuth } from "@soundkit/auth";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { planCatalog } from "@soundkit/db/schema/plans";
import { eq } from "drizzle-orm";

import { CONFIGURED_PAID_PLAN_CODES, FREE_PLAN_CODES } from "@/lib/plan-codes";
import { billableSeatsForCheckout } from "@/lib/plan-seats";

export const isFreePlan = (planCode: string) => FREE_PLAN_CODES.has(planCode);

export const getConfiguredPlanCodes = () => CONFIGURED_PAID_PLAN_CODES;

export const createPlanCheckout = async ({
  cancelUrl,
  planCode,
  referenceId,
  request,
  seats,
  successUrl,
}: {
  cancelUrl: string;
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
        customerType: "organization";
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
        customerType: "organization",
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
    return [];
  }

  return rows;
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
