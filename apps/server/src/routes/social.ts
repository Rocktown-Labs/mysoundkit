import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { sampleComments } from "@/lib/sample-data";
import {
  commentSchema,
  createCommentBodySchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "post",
    path: "/posts/{postId}/likes",
    request: {
      params: z.object({
        postId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(messageResponseSchema, "Like applied"),
    },
    tags: ["Social"],
  }),
  (c) => c.json({ message: "Like applied" }, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/posts/{postId}/comments",
    request: {
      params: z.object({
        postId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(commentSchema.array(), "Post comments"),
    },
    tags: ["Social"],
  }),
  (c) => c.json(sampleComments, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/posts/{postId}/comments",
    request: {
      body: jsonContentRequired(
        createCommentBodySchema,
        "Comment create payload"
      ),
      params: z.object({
        postId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(commentSchema, "Comment created"),
    },
    tags: ["Social"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        body: body.body,
        createdAt: new Date().toISOString(),
        id: "comment_new",
        userId: "current_user",
        username: "you",
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
