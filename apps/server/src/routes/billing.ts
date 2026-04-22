import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

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
  (c) => c.json(samplePlans, HttpStatusCodes.OK)
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
