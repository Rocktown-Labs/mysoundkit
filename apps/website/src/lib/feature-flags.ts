import { env } from "@soundkit/env/web";

export const featureFlags = {
  merch: env.VITE_ENABLE_MERCH === "true",
} as const;
