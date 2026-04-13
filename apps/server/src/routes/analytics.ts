import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { sampleAnalyticsOverview } from "@/lib/sample-data";
import { analyticsOverviewSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        analyticsOverviewSchema,
        "Analytics overview"
      ),
    },
    tags: ["Analytics"],
  }),
  (c) => c.json(sampleAnalyticsOverview, HttpStatusCodes.OK)
);

export default app;
