import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { sampleVideos } from "@/lib/sample-data";
import { createVideoBodySchema, videoSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        videoSummarySchema.array(),
        "Videos list"
      ),
    },
    tags: ["Videos"],
  }),
  (c) => c.json(sampleVideos, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(createVideoBodySchema, "Video create payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        videoSummarySchema,
        "Video created"
      ),
    },
    tags: ["Videos"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        id: "video_new",
        muxPlaybackId: null,
        playbackPolicy: "public" as const,
        status: "pending",
        title: body.title,
        videoKind: body.videoKind,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{videoId}",
    request: {
      params: z.object({
        videoId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        videoSummarySchema,
        "Video detail summary"
      ),
    },
    tags: ["Videos"],
  }),
  (c) => {
    const { videoId } = c.req.valid("param");
    const video =
      sampleVideos.find((entry) => entry.id === videoId) ?? sampleVideos[0];
    return c.json(video, HttpStatusCodes.OK);
  }
);

export default app;
