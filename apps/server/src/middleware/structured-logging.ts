import { createMiddleware } from "hono/factory";

import { serializeErrorForLog } from "@/lib/errors";
import type { AppEnv } from "@/lib/types";

type LogLevel = "error" | "info" | "warn";

const REQUEST_ID_HEADER = "x-request-id";

const writeLog = (level: LogLevel, payload: Record<string, unknown>) => {
  const entry = {
    level,
    service: "soundkit-api",
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logInfo = (payload: Record<string, unknown>) =>
  writeLog("info", payload);

export const logWarn = (payload: Record<string, unknown>) =>
  writeLog("warn", payload);

export const logError = (payload: Record<string, unknown>) =>
  writeLog("error", payload);

export const structuredLoggingMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const startedAt = Date.now();
    const requestId = c.req.header(REQUEST_ID_HEADER) ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.header(REQUEST_ID_HEADER, requestId);

    try {
      await next();

      logInfo({
        durationMs: Date.now() - startedAt,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        requestId,
        status: c.res.status,
        userId: c.get("user")?.id ?? null,
      });
    } catch (error) {
      logError({
        durationMs: Date.now() - startedAt,
        error: serializeErrorForLog(error),
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        requestId,
        userId: c.get("user")?.id ?? null,
      });

      throw error;
    }
  }
);
