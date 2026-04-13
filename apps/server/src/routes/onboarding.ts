import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  messageResponseSchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "post",
    path: "/artist",
    request: {
      body: jsonContentRequired(
        onboardingArtistBodySchema,
        "Artist onboarding payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        messageResponseSchema,
        "Artist onboarding saved"
      ),
    },
    tags: ["Onboarding"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      { message: `Artist onboarding captured for ${body.username}` },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/fan",
    request: {
      body: jsonContentRequired(
        onboardingFanBodySchema,
        "Fan onboarding payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        messageResponseSchema,
        "Fan onboarding saved"
      ),
    },
    tags: ["Onboarding"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      { message: `Fan onboarding captured for ${body.username}` },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
