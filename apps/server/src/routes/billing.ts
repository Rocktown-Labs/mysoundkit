import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  createPlanCheckout as checkoutForPlan,
  getPlanRows as getCatalogPlans,
} from "@/lib/billing";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { samplePlans, sampleWorkspace } from "@/lib/sample-data";
import {
  entitlementSummarySchema,
  messageResponseSchema,
  planSchema,
  workspaceSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const subscriptionSummarySchema = z.object({
  activePlanCode: z.string().nullable(),
  entitlements: entitlementSummarySchema,
  status: z.string().nullable(),
  workspace: workspaceSummarySchema.nullable(),
});

app.openapi(
  createRoute({
    method: "get",
    path: "/plans",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(planSchema.array(), "Plan catalog"),
    },
    tags: ["Billing"],
  }),
  async (c) => {
    const plans = await getCatalogPlans();

    if (plans.length === 0) {
      return c.json(samplePlans, HttpStatusCodes.OK);
    }

    return c.json(
      plans.map((plan) => ({
        adsEnabled: plan.adsEnabled,
        audience: plan.audience,
        canViewLiveBattles: plan.canViewLiveBattles,
        canVoteLiveBattles: plan.canVoteLiveBattles,
        code: plan.code,
        featureLimits: plan.featureLimits ?? null,
        maxSeats: plan.maxSeats ?? null,
        monthlyPrice: Number(plan.monthlyPrice),
        name: plan.name,
        stripeAnnualPriceId: plan.stripeAnnualPriceId ?? null,
        stripeMonthlyPriceId: plan.stripeMonthlyPriceId ?? null,
        supportsWorkspaceSeats: plan.supportsWorkspaceSeats,
      })),
      HttpStatusCodes.OK
    );
  }
);

const checkoutBodySchema = z.object({
  cancelUrl: z.url(),
  planCode: z.string(),
  referenceId: z.string().optional(),
  seats: z.number().int().positive().optional(),
  successUrl: z.url(),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/checkout",
    request: {
      body: jsonContentRequired(checkoutBodySchema, "Checkout payload"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          checkoutUrl: z.string().url().nullable(),
          requiresCheckout: z.boolean(),
          setupRequired: z.boolean(),
        }),
        "Checkout status"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Billing"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const body = c.req.valid("json");
    const session = c.get("session");
    const referenceId =
      body.referenceId ??
      (isAuthenticatedSession(session)
        ? (session.activeOrganizationId ?? user.id)
        : user.id);
    const checkout = await checkoutForPlan({
      cancelUrl: body.cancelUrl,
      planCode: body.planCode,
      referenceId,
      request: c.req.raw,
      seats: body.seats,
      successUrl: body.successUrl,
    });

    return c.json(checkout, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/subscription",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        subscriptionSummarySchema,
        "Current subscription summary"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Billing"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

    return c.json(
      {
        activePlanCode: entitlements.activePlanCode,
        entitlements,
        status: entitlements.status,
        workspace: entitlements.referenceId ? sampleWorkspace : null,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
