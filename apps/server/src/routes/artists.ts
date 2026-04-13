import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { sampleArtists } from "@/lib/sample-data";
import { artistSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistSummarySchema.array(),
        "Artists list"
      ),
    },
    tags: ["Artists"],
  }),
  (c) => c.json(sampleArtists, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{username}",
    request: {
      params: z.object({
        username: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistSummarySchema,
        "Artist profile summary"
      ),
    },
    tags: ["Artists"],
  }),
  (c) => {
    const { username } = c.req.valid("param");
    const artist =
      sampleArtists.find((entry) => entry.username === username) ??
      sampleArtists[0];
    return c.json(artist, HttpStatusCodes.OK);
  }
);

export default app;
