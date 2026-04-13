import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "post",
    path: "/mux",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Mux webhook accepted"
      ),
    },
    tags: ["Webhooks"],
  }),
  (c) => c.json({ message: "Mux webhook accepted" }, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/stripe",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Stripe webhook accepted"
      ),
    },
    tags: ["Webhooks"],
  }),
  (c) => c.json({ message: "Stripe webhook accepted" }, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/battle-service",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Battle service webhook accepted"
      ),
    },
    tags: ["Webhooks"],
  }),
  (c) =>
    c.json({ message: "Battle service webhook accepted" }, HttpStatusCodes.OK)
);

export default app;
