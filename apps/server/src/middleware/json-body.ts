import { createMiddleware } from "hono/factory";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { AppError, jsonError } from "@/lib/errors";
import type { AppEnv } from "@/lib/types";

const JSON_BODY_METHODS = new Set(["PATCH", "POST", "PUT"]);

export const jsonBodyMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const contentType = c.req.header("content-type")?.toLowerCase() ?? "";
  const hasJsonBody =
    JSON_BODY_METHODS.has(c.req.method) &&
    contentType.includes("application/json");

  if (!hasJsonBody) {
    await next();
    return;
  }

  try {
    await c.req.json();
  } catch (error) {
    return jsonError(
      c,
      new AppError({
        cause: error,
        code: "bad_request",
        message: "Invalid request payload.",
        status: HttpStatusCodes.BAD_REQUEST,
      })
    );
  }

  await next();
});
