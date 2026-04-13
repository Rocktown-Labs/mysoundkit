import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { sampleBattles } from "@/lib/sample-data";
import {
  battleSummarySchema,
  createChallengeBodySchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleSummarySchema.array(),
        "Battles feed"
      ),
    },
    tags: ["Battles"],
  }),
  (c) => c.json(sampleBattles, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{battleId}",
    request: {
      params: z.object({
        battleId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        battleSummarySchema,
        "Battle detail summary"
      ),
    },
    tags: ["Battles"],
  }),
  (c) => {
    const { battleId } = c.req.valid("param");
    const battle =
      sampleBattles.find((entry) => entry.id === battleId) ?? sampleBattles[0];
    return c.json(battle, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/challenge",
    request: {
      body: jsonContentRequired(
        createChallengeBodySchema,
        "Battle challenge payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        messageResponseSchema,
        "Battle challenge created"
      ),
    },
    tags: ["Battles"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      { message: `Challenge created for ${body.opponentUsername}` },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
