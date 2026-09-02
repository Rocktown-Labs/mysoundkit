/* eslint-disable one-var, sort-vars */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { env } from "@soundkit/env/server";
import { getSessionCookie } from "better-auth/cookies";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import type { AppEnv } from "@/lib/types";

const getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  getBioOrigin = () => {
    try {
      return new URL(getEnvValue("SOUNDKIT_BIO_URL") || "https://soundkit.bio")
        .origin;
    } catch {
      return null;
    }
  },
  app = new OpenAPIHono<AppEnv>(),
  authCapabilitiesSchema = z.object({ google: z.boolean() }),
  handoffErrorSchema = z.object({ message: z.string() }),
  handoffTokenBodySchema = z.object({ targetOrigin: z.url() }),
  handoffTokenResponseSchema = z.object({ token: z.string().min(1) });

app.openapi(
  createRoute({
    method: "post",
    path: "/handoff-token",
    request: {
      body: jsonContentRequired(
        handoffTokenBodySchema,
        "Cross-domain auth handoff request"
      ),
    },
    responses: {
      200: jsonContent(
        handoffTokenResponseSchema,
        "Cross-domain auth handoff token"
      ),
      401: jsonContent(handoffErrorSchema, "Authentication required"),
      403: jsonContent(handoffErrorSchema, "Origin not allowed"),
    },
    tags: ["Auth"],
  }),
  (c) => {
    const targetOrigin = new URL(c.req.valid("json").targetOrigin).origin,
      bioOrigin = getBioOrigin(),
      user = c.get("user"),
      token = getSessionCookie(c.req.raw);

    if (!bioOrigin || targetOrigin !== bioOrigin) {
      return c.json({ message: "This handoff origin is not allowed." }, 403);
    }

    if (!(user && token)) {
      return c.json({ message: "Authentication is required." }, 401);
    }

    return c.json({ token }, 200);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/capabilities",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        authCapabilitiesSchema,
        "Available authentication providers"
      ),
    },
    tags: ["Auth"],
  }),
  (c) =>
    c.json(
      {
        google: Boolean(
          getEnvValue("GOOGLE_CLIENT_ID") && getEnvValue("GOOGLE_CLIENT_SECRET")
        ),
      },
      HttpStatusCodes.OK
    )
);

export default app;
