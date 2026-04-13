import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { samplePlans, sampleWorkspace } from "@/lib/sample-data";
import { planSchema, workspaceSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const subscriptionSummarySchema = z.object({
  activePlanCode: z.string().nullable(),
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
    },
    tags: ["Billing"],
  }),
  (c) =>
    c.json(
      {
        activePlanCode: "artist_team",
        status: "active",
        workspace: sampleWorkspace,
      },
      HttpStatusCodes.OK
    )
);

export default app;
