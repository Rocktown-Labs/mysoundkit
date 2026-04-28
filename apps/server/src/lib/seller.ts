import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sellerAccounts } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { and, eq, or } from "drizzle-orm";

import type { AuthenticatedUser } from "@/lib/types";

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const stripeFetch = async <T>({
  body,
  method = "POST",
  path,
}: {
  body?: URLSearchParams;
  method?: "GET" | "POST";
  path: string;
}) => {
  const secretKey = getEnvValue("STRIPE_SECRET_KEY");

  if (!secretKey) {
    return null;
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    body,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method,
  });

  if (!response.ok) {
    throw new Error(`Stripe request failed with ${response.status}`);
  }

  return (await response.json()) as T;
};

interface StripeAccountResponse {
  charges_enabled?: boolean;
  details_submitted?: boolean;
  id: string;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[];
  };
}

interface StripeAccountLinkResponse {
  url: string;
}

export const getSellerAccount = async ({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();
  const [seller] = await db
    .select()
    .from(sellerAccounts)
    .where(
      organizationId
        ? or(
            eq(sellerAccounts.organizationId, organizationId),
            and(
              eq(sellerAccounts.userId, userId),
              eq(sellerAccounts.organizationId, organizationId)
            )
          )
        : eq(sellerAccounts.userId, userId)
    )
    .limit(1);

  return seller ?? null;
};

export const isSellerEnabled = async ({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId: string;
}) => {
  const seller = await getSellerAccount({ organizationId, userId });

  return seller?.onboardingStatus === "enabled" && seller.chargesEnabled;
};

export const createSellerAccountLink = async ({
  organizationId,
  refreshUrl,
  returnUrl,
  user,
}: {
  organizationId: string | null;
  refreshUrl: string;
  returnUrl: string;
  user: AuthenticatedUser;
}) => {
  if (!isDatabaseConfigured()) {
    return {
      accountLinkUrl: null,
      message: "Database configuration is required before seller onboarding.",
      onboardingStatus: "not_started" as const,
      setupRequired: true,
    };
  }

  const db = createDb();
  const existingSeller = await getSellerAccount({
    organizationId,
    userId: user.id,
  });

  let stripeAccountId = existingSeller?.stripeAccountId ?? null;

  if (!stripeAccountId) {
    const account = await stripeFetch<StripeAccountResponse>({
      body: new URLSearchParams({
        "business_profile[url]": "https://mysoundkit.com",
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        country: "US",
        email: user.email ?? "",
        type: "express",
      }),
      path: "/accounts",
    });

    if (!account) {
      return {
        accountLinkUrl: null,
        message: "Stripe Connect credentials are not configured yet.",
        onboardingStatus: existingSeller?.onboardingStatus ?? "not_started",
        setupRequired: true,
      };
    }

    stripeAccountId = account.id;

    await db.insert(sellerAccounts).values({
      chargesEnabled: Boolean(account.charges_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      id: crypto.randomUUID(),
      onboardingStatus: "pending",
      organizationId,
      payoutsEnabled: Boolean(account.payouts_enabled),
      requirementsDue: account.requirements?.currently_due ?? [],
      stripeAccountId,
      userId: user.id,
    });
  }

  const accountLink = await stripeFetch<StripeAccountLinkResponse>({
    body: new URLSearchParams({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    }),
    path: "/account_links",
  });

  if (!accountLink) {
    return {
      accountLinkUrl: null,
      message: "Stripe Connect account-link creation is not configured yet.",
      onboardingStatus: existingSeller?.onboardingStatus ?? "pending",
      setupRequired: true,
    };
  }

  return {
    accountLinkUrl: accountLink.url,
    onboardingStatus: existingSeller?.onboardingStatus ?? "pending",
    setupRequired: false,
  };
};
