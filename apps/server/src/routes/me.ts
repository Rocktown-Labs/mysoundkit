import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { sampleUser, sampleWorkspace } from "@/lib/sample-data";
import {
  meResponseSchema,
  messageResponseSchema,
  workspaceSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        meResponseSchema,
        "Current user profile"
      ),
    },
    tags: ["Me"],
  }),
  (c) =>
    c.json(
      {
        activeWorkspace: sampleWorkspace,
        user: sampleUser,
      },
      HttpStatusCodes.OK
    )
);

app.openapi(
  createRoute({
    method: "get",
    path: "/workspaces",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        workspaceSummarySchema.array(),
        "Current user workspaces"
      ),
    },
    tags: ["Me"],
  }),
  (c) => c.json([sampleWorkspace], HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/profile",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Profile updated"
      ),
    },
    tags: ["Me"],
  }),
  (c) =>
    c.json({ message: "Profile update route is ready" }, HttpStatusCodes.OK)
);

export default app;
