import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    VITE_ENABLE_MERCH: z.enum(["true", "false"]).default("false"),
    VITE_MEDIA_URL: z.url().optional(),
    VITE_RADAR_PUBLISHABLE_KEY: z.string().optional(),
    VITE_SENTRY_DSN: z.url().optional(),
    VITE_SENTRY_ENVIRONMENT: z.string().default("development"),
    VITE_SERVER_URL: z.url(),
    VITE_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
    VITE_TURNSTILE_SITE_KEY: z.string().optional(),
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv: import.meta.env,
});
