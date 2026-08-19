import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { env } from "@soundkit/env/server";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import type { AppEnv } from "@/lib/types";

const getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  app = new OpenAPIHono<AppEnv>(),
  authCapabilitiesSchema = z.object({ google: z.boolean() });

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
