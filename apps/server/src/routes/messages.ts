import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { sampleConversations, sampleMessages } from "@/lib/sample-data";
import {
  conversationSummarySchema,
  createConversationBodySchema,
  createMessageBodySchema,
  messageSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/conversations",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        conversationSummarySchema.array(),
        "Conversation list"
      ),
    },
    tags: ["Messages"],
  }),
  (c) => c.json(sampleConversations, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/conversations",
    request: {
      body: jsonContentRequired(
        createConversationBodySchema,
        "Conversation create payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        conversationSummarySchema,
        "Conversation created"
      ),
    },
    tags: ["Messages"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        conversationType:
          body.participantUserIds.length > 1
            ? ("group" as const)
            : ("direct" as const),
        id: "conv_new",
        title: body.title ?? "New conversation",
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/conversations/{conversationId}/messages",
    request: {
      params: z.object({
        conversationId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageSchema.array(),
        "Conversation messages"
      ),
    },
    tags: ["Messages"],
  }),
  (c) => c.json(sampleMessages, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/conversations/{conversationId}/messages",
    request: {
      body: jsonContentRequired(
        createMessageBodySchema,
        "Message create payload"
      ),
      params: z.object({
        conversationId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(messageSchema, "Message created"),
    },
    tags: ["Messages"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        body: body.body,
        createdAt: new Date().toISOString(),
        id: "msg_new",
        senderId: "current_user",
        status: "sent" as const,
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
