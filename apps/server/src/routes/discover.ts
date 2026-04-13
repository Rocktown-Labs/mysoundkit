import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { sampleArtists, sampleBattles, sampleTracks } from "@/lib/sample-data";
import {
  artistSummarySchema,
  battleSummarySchema,
  trackSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const discoverHomeSchema = z.object({
  featuredArtists: artistSummarySchema.array(),
  featuredBattles: battleSummarySchema.array(),
  featuredTracks: trackSummarySchema.array(),
});

app.openapi(
  createRoute({
    method: "get",
    path: "/home",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        discoverHomeSchema,
        "Discovery landing data"
      ),
    },
    tags: ["Discover"],
  }),
  (c) =>
    c.json(
      {
        featuredArtists: sampleArtists,
        featuredBattles: sampleBattles,
        featuredTracks: sampleTracks,
      },
      HttpStatusCodes.OK
    )
);

export default app;
