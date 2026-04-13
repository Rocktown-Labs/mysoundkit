import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { sampleLibraryOverview, sampleTracks } from "@/lib/sample-data";
import { libraryOverviewSchema, trackSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        libraryOverviewSchema,
        "Library overview"
      ),
    },
    tags: ["Library"],
  }),
  (c) => c.json(sampleLibraryOverview, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/recent",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Recent plays"
      ),
    },
    tags: ["Library"],
  }),
  (c) => c.json(sampleTracks, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/saved",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Saved tracks"
      ),
    },
    tags: ["Library"],
  }),
  (c) => c.json(sampleTracks.slice(0, 1), HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/purchases",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Purchased tracks"
      ),
    },
    tags: ["Library"],
  }),
  (c) => c.json(sampleTracks, HttpStatusCodes.OK)
);

export default app;
