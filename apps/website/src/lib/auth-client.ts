import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { API_AUTH_URL } from "./api";

export const authClient = createAuthClient({
  baseURL: API_AUTH_URL,
  plugins: [adminClient()],
});
