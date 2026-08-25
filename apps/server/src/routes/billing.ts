import { createAuth } from "@soundkit/auth";
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
import {
  entitlementSummarySchema,
  messageResponseSchema,
  planSchema,
  workspaceSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  customerTypeSchema = z.enum(["organization", "user"]),
  subscriptionSummarySchema = z.object({
    activePlanCode: z.string().nullable(),
    entitlements: entitlementSummarySchema,
    status: z.string().nullable(),
    workspace: workspaceSummarySchema.nullable(),
  }),
  portalBodySchema = z.object({
    customerType: customerTypeSchema.default("user"),
    referenceId: z.string().optional(),
    returnUrl: z.url(),
  }),
  portalResponseSchema = z.object({
    portalUrl: z.string().url().nullable(),
    setupRequired: z.boolean(),
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

    return c.json(
      plans.map((plan) => ({
        annualPriceCents: plan.annualPriceCents,
        audience: plan.audience,
        code: plan.code,
        entitlements: plan.entitlements,
        maxSeats: plan.maxSeats ?? null,
        monthlyPriceCents: plan.monthlyPriceCents,
        name: plan.name,
      })),
      HttpStatusCodes.OK
    );
  }
);

const checkoutBodySchema = z.object({
  cancelUrl: z.url(),
  customerType: customerTypeSchema.default("organization"),
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

    const body = c.req.valid("json"),
      session = c.get("session"),
      referenceId =
        body.referenceId ??
        (body.customerType === "organization" && isAuthenticatedSession(session)
          ? (session.activeOrganizationId ?? user.id)
          : user.id),
      checkout = await checkoutForPlan({
        cancelUrl: body.cancelUrl,
        customerType: body.customerType,
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
    method: "post",
    path: "/portal",
    request: {
      body: jsonContentRequired(portalBodySchema, "Billing portal payload"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        portalResponseSchema,
        "Billing portal status"
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

    const body = c.req.valid("json"),
      session = c.get("session"),
      referenceId =
        body.referenceId ??
        (body.customerType === "organization" && isAuthenticatedSession(session)
          ? (session.activeOrganizationId ?? user.id)
          : user.id),
      auth = createAuth();

    if (!("createBillingPortal" in auth.api)) {
      return c.json(
        { portalUrl: null, setupRequired: true },
        HttpStatusCodes.OK
      );
    }

    try {
      const createBillingPortal = auth.api.createBillingPortal as (input: {
          body: {
            customerType: "organization" | "user";
            disableRedirect: boolean;
            referenceId: string;
            returnUrl: string;
          };
          headers: Headers;
        }) => Promise<unknown>,
        result = await createBillingPortal({
          body: {
            customerType: body.customerType,
            disableRedirect: true,
            referenceId,
            returnUrl: body.returnUrl,
          },
          headers: c.req.raw.headers,
        }),
        portalUrl =
          typeof result === "object" &&
          result !== null &&
          "url" in result &&
          typeof result.url === "string"
            ? result.url
            : null;

      return c.json(
        { portalUrl, setupRequired: !portalUrl },
        HttpStatusCodes.OK
      );
    } catch {
      return c.json(
        { portalUrl: null, setupRequired: true },
        HttpStatusCodes.OK
      );
    }
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

    const session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });

    return c.json(
      {
        activePlanCode: entitlements.activePlanCode,
        entitlements,
        status: entitlements.status,
        workspace: null,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
