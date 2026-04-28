import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  unauthorizedMessage,
} from "@/lib/entitlements";
import {
  createSellerAccountLinkBodySchema,
  messageResponseSchema,
  sellerOnboardingResponseSchema,
  sellerStatusSchema,
} from "@/lib/schemas";
import { createSellerAccountLink, getSellerAccount } from "@/lib/seller";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

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

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const account = await getSellerAccount({ organizationId, userId: user.id });

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

    const body = c.req.valid("json");
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const accountLink = await createSellerAccountLink({
      organizationId,
      refreshUrl:
        body.refreshUrl ??
        new URL("/dashboard/settings/payouts", c.req.url).toString(),
      returnUrl: body.returnUrl ?? new URL("/dashboard", c.req.url).toString(),
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
