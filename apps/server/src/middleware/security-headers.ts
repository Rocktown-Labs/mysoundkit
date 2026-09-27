import { createMiddleware } from "hono/factory";

import type { AppEnv } from "@/lib/types";

const YEAR_SECONDS = 31_536_000;

export const securityHeadersMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    await next();

    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (c.req.url.startsWith("https://")) {
      c.header(
        "Strict-Transport-Security",
        `max-age=${YEAR_SECONDS}; includeSubDomains; preload`
      );
    }
  }
);
