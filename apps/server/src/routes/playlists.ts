import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { samplePlaylists } from "@/lib/sample-data";
import { createPlaylistBodySchema, playlistSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        playlistSchema.array(),
        "Playlists list"
      ),
    },
    tags: ["Playlists"],
  }),
  (c) => c.json(samplePlaylists, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(
        createPlaylistBodySchema,
        "Playlist create payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        playlistSchema,
        "Playlist created"
      ),
    },
    tags: ["Playlists"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        description: body.description ?? null,
        id: "playlist_new",
        isPublic: body.isPublic,
        title: body.title,
        trackCount: 0,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{playlistId}",
    request: {
      params: z.object({
        playlistId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(playlistSchema, "Playlist detail"),
    },
    tags: ["Playlists"],
  }),
  (c) => {
    const { playlistId } = c.req.valid("param");
    const playlist =
      samplePlaylists.find((entry) => entry.id === playlistId) ??
      samplePlaylists[0];
    return c.json(playlist, HttpStatusCodes.OK);
  }
);

export default app;
