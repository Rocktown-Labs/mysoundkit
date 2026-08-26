import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import {
  createSellerAccountLinkBodySchema,
  messageResponseSchema,
  sellerOnboardingResponseSchema,
  sellerStatusSchema,
} from "@/lib/schemas";
import {
  createSellerAccountLink,
  createSellerAccountSession,
  refreshSellerAccount,
} from "@/lib/seller";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  resolvePremiumArtist = async (c: Context<AppEnv>) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return null;
    }
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(c.get("session"))
        ? c.get("session")
        : null,
      user,
    });
    return entitlements.activePlanCode === "soundkit_premium_artist" &&
      entitlements.isPremium
      ? user
      : null;
  };

app.post("/account-session", async (c) => {
  if (!isAuthenticatedUser(c.get("user"))) {
    return c.json(unauthorizedMessage, 401);
  }
  const user = await resolvePremiumArtist(c);
  if (!user) {
    return c.json({ message: "Artist Premium is required." }, 403);
  }
  const session = c.get("session"),
    organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
  let accountSession: Awaited<ReturnType<typeof createSellerAccountSession>>;
  try {
    accountSession = await createSellerAccountSession({
      organizationId,
      userId: user.id,
    });
  } catch (error) {
    console.error("Stripe Connect account session creation failed", {
      error: error instanceof Error ? error.message : String(error),
      userId: user.id,
    });
    return c.json(
      { message: "Stripe Connect is temporarily unavailable." },
      503
    );
  }
  if (!accountSession?.client_secret) {
    return c.json({ message: "Complete Stripe onboarding first." }, 409);
  }
  return c.json({ clientSecret: accountSession.client_secret }, 200);
});

app.openapi(
  createRoute({
    method: "get",
    path: "/status",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        sellerStatusSchema,
        "Seller account status"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Seller"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      account = await refreshSellerAccount({
        organizationId,
        userId: user.id,
      });

    return c.json(
      {
        accountLinkUrl: null,
        chargesEnabled: account?.chargesEnabled ?? false,
        detailsSubmitted: account?.detailsSubmitted ?? false,
        onboardingStatus: account?.onboardingStatus ?? "not_started",
        payoutsEnabled: account?.payoutsEnabled ?? false,
        stripeAccountId: account?.stripeAccountId ?? null,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/account-link",
    request: {
      body: jsonContentRequired(
        createSellerAccountLinkBodySchema,
        "Seller account link payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        sellerOnboardingResponseSchema,
        "Seller onboarding link"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Stripe Connect is not configured"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Artist Premium required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Seller"],
  }),
  async (c) => {
    if (!isAuthenticatedUser(c.get("user"))) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const user = await resolvePremiumArtist(c);

    if (!user) {
      return c.json(
        { message: "Artist Premium is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      accountLink = await createSellerAccountLink({
        organizationId,
        refreshUrl:
          body.refreshUrl ??
          new URL("/dashboard/career/payments", c.req.url).toString(),
        returnUrl:
          body.returnUrl ?? new URL("/dashboard", c.req.url).toString(),
        user,
      });

    if (!accountLink.accountLinkUrl) {
      return c.json(
        {
          message:
            accountLink.message ??
            "Stripe Connect credentials are not configured yet.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    return c.json(
      {
        accountLinkUrl: accountLink.accountLinkUrl,
        onboardingStatus: accountLink.onboardingStatus,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
