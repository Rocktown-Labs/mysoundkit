import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    EXPO_PUBLIC_SERVER_URL: z.url(),
    EXPO_PUBLIC_WEB_URL: z.url().optional(),
  },
  clientPrefix: "EXPO_PUBLIC_",
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
});
