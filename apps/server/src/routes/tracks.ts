import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { sampleTracks } from "@/lib/sample-data";
import { createTrackBodySchema, trackSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Tracks list"
      ),
    },
    tags: ["Tracks"],
  }),
  (c) => c.json(sampleTracks, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(createTrackBodySchema, "Track create payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        trackSummarySchema,
        "Track created"
      ),
    },
    tags: ["Tracks"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        artistName: "Current Artist",
        duration: "0:00",
        genre: body.genre,
        id: "track_new",
        isForSale: body.isForSale,
        plays: 0,
        price: body.price ?? null,
        releaseAt: body.releaseAt ?? null,
        releaseStrategy: body.releaseStrategy,
        slug: body.title.toLowerCase().replaceAll(" ", "-"),
        title: body.title,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{trackId}",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema,
        "Track detail summary"
      ),
    },
    tags: ["Tracks"],
  }),
  (c) => {
    const { trackId } = c.req.valid("param");
    const track =
      sampleTracks.find((entry) => entry.id === trackId) ?? sampleTracks[0];
    return c.json(track, HttpStatusCodes.OK);
  }
);

export default app;
