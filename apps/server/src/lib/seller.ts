import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sellerAccounts } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { and, eq, or } from "drizzle-orm";

import { stripeRequest } from "@/lib/stripe";
import type { AuthenticatedUser } from "@/lib/types";

const STRIPE_V2_VERSION = "2026-07-29.dahlia",
  getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  stripeErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  stripeV2Request = async <T>({
    body,
    method = "POST",
    path,
  }: {
    body?: Record<string, unknown>;
    method?: "GET" | "POST";
    path: string;
  }): Promise<T | null> => {
    const secretKey = getEnvValue("STRIPE_SECRET_KEY");
    if (!secretKey) {
      return null;
    }

    const response = await fetch(`https://api.stripe.com/v2${path}`, {
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Stripe-Version": STRIPE_V2_VERSION,
      },
      method,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300),
        requestId = response.headers.get("request-id");
      throw new Error(
        `Stripe Connect request failed (${response.status})${
          requestId ? ` (request ${requestId})` : ""
        }: ${detail}`
      );
    }
    return (await response.json()) as T;
  };

interface StripeV2AccountResponse {
  configuration?: {
    recipient?: {
      capabilities?: {
        stripe_balance?: {
          stripe_transfers?: {
            status?: string;
            status_details?: { code?: string }[];
          };
        };
      };
    };
  };
  id: string;
  requirements?: {
    entries?: { field?: string; requested_reasons?: { code?: string }[] }[];
  };
}

interface StripeV2AccountLinkResponse {
  url: string;
}

const serializeAccountStatus = (account: StripeV2AccountResponse) => {
  const transferCapability =
      account.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers,
    transfersActive = transferCapability?.status === "active",
    requirementsDue = [
      ...(account.requirements?.entries
        ?.map((entry) => entry.field)
        .filter(Boolean) ?? []),
      ...(transferCapability?.status_details
        ?.map((detail) => detail.code)
        .filter(Boolean) ?? []),
    ] as string[];

  return {
    chargesEnabled: transfersActive,
    detailsSubmitted: requirementsDue.length === 0,
    onboardingStatus: transfersActive
      ? ("enabled" as const)
      : (requirementsDue.length > 0
        ? ("restricted" as const)
        : ("pending" as const)),
    payoutsEnabled: transfersActive,
    requirementsDue,
  };
};

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

  const db = createDb(),
    [seller] = await db
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

export const refreshSellerAccount = async ({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId: string;
}) => {
  const seller = await getSellerAccount({ organizationId, userId });
  if (!seller) {
    return null;
  }

  const stripeAccount = await stripeV2Request<StripeV2AccountResponse>({
    method: "GET",
    path: `/core/accounts/${encodeURIComponent(seller.stripeAccountId)}?include%5B%5D=configuration.recipient&include%5B%5D=requirements`,
  }).catch(() => null);
  if (!stripeAccount) {
    return seller;
  }

  const status = serializeAccountStatus(stripeAccount),
    [updated] = await createDb()
      .update(sellerAccounts)
      .set(status)
      .where(eq(sellerAccounts.id, seller.id))
      .returning();
  return updated ?? seller;
};

export const isSellerEnabled = async ({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId: string;
}) => {
  try {
    const seller = await refreshSellerAccount({ organizationId, userId });
    return Boolean(
      seller?.onboardingStatus === "enabled" && seller.chargesEnabled
    );
  } catch {
    return false;
  }
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

  const db = createDb(),
    existingSeller = await getSellerAccount({
      organizationId,
      userId: user.id,
    });
  let stripeAccountId = existingSeller?.stripeAccountId ?? null;

  if (!stripeAccountId) {
    const account = await stripeV2Request<StripeV2AccountResponse>({
      body: {
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: { stripe_transfers: { requested: true } },
            },
          },
        },
        contact_email: user.email ?? undefined,
        dashboard: "express",
        defaults: {
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        display_name: user.name ?? "SoundKit artist",
        identity: { country: "us" },
        include: ["configuration.recipient", "identity", "requirements"],
      },
      path: "/core/accounts",
    }).catch((error) => {
      console.error("Stripe v2 account creation failed", {
        error: stripeErrorMessage(error),
        stripeAccountId,
      });
      return null;
    });

    if (account) {
      stripeAccountId = account.id;
      await db.insert(sellerAccounts).values({
        ...serializeAccountStatus(account),
        id: crypto.randomUUID(),
        metadata: { stripeAccountApi: "v2" },
        organizationId,
        stripeAccountId,
        userId: user.id,
      });
    } else {
      // Fallback to standard V1 Express Accounts API
      const v1Params = new URLSearchParams();
      v1Params.append("type", "express");
      v1Params.append("country", "US");
      if (user.email) {
        v1Params.append("email", user.email);
      }
      v1Params.append("capabilities[transfers][requested]", "true");
      v1Params.append("capabilities[card_payments][requested]", "true");
      v1Params.append("business_type", "individual");
      v1Params.append("metadata[soundkit_user_id]", user.id);

      const v1Account = await stripeRequest<{
        charges_enabled?: boolean;
        details_submitted?: boolean;
        id: string;
        payouts_enabled?: boolean;
      }>({
        method: "POST",
        params: v1Params,
        path: "/accounts",
      }).catch((error) => {
        console.error("Stripe v1 account creation failed", {
          error: stripeErrorMessage(error),
          stripeAccountId,
        });
        return null;
      });

      if (v1Account) {
        stripeAccountId = v1Account.id;
        await db.insert(sellerAccounts).values({
          chargesEnabled: Boolean(v1Account.charges_enabled),
          detailsSubmitted: Boolean(v1Account.details_submitted),
          id: crypto.randomUUID(),
          metadata: { stripeAccountApi: "v1" },
          onboardingStatus: v1Account.charges_enabled ? "enabled" : "pending",
          organizationId,
          payoutsEnabled: Boolean(v1Account.payouts_enabled),
          requirementsDue: [],
          stripeAccountId,
          userId: user.id,
        });
      }
    }

    if (!stripeAccountId) {
      return {
        accountLinkUrl: null,
        message: "Stripe Connect account creation is not configured yet.",
        onboardingStatus: existingSeller?.onboardingStatus ?? "not_started",
        setupRequired: true,
      };
    }
  }

  let accountLink = await stripeV2Request<StripeV2AccountLinkResponse>({
    body: {
      account: stripeAccountId,
      use_case: {
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: refreshUrl,
          return_url: returnUrl,
        },
        type: "account_onboarding",
      },
    },
    path: "/core/account_links",
  }).catch((error) => {
    console.error("Stripe v2 account link creation failed", {
      error: stripeErrorMessage(error),
      stripeAccountId,
    });
    return null;
  });

  if (!accountLink && stripeAccountId) {
    const linkParams = new URLSearchParams();
    linkParams.append("account", stripeAccountId);
    linkParams.append("refresh_url", refreshUrl);
    linkParams.append("return_url", returnUrl);
    linkParams.append("type", "account_onboarding");

    const v1Link = await stripeRequest<{ url: string }>({
      method: "POST",
      params: linkParams,
      path: "/account_links",
    }).catch((error) => {
      console.error("Stripe v1 account link creation failed", {
        error: stripeErrorMessage(error),
        stripeAccountId,
      });
      return null;
    });

    if (v1Link?.url) {
      accountLink = { url: v1Link.url };
    }
  }

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

export const createSellerAccountSession = async ({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId: string;
}) => {
  const seller = await refreshSellerAccount({ organizationId, userId });
  if (!seller?.stripeAccountId) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("account", seller.stripeAccountId);
  for (const component of [
    "account_management",
    "notification_banner",
    "payments",
    "payouts",
    "payout_reconciliation_report",
  ]) {
    params.set(`components[${component}][enabled]`, "true");
  }
  params.set("components[payments][features][dispute_management]", "true");
  params.set("components[payments][features][refund_management]", "true");

  return stripeRequest<{ client_secret: string }>({
    params,
    path: "/account_sessions",
  });
};
