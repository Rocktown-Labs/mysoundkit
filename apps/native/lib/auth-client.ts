import { expoClient } from "@better-auth/expo/client";
import { nativeSessionScope } from "@soundkit/env/session-scope";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { API_AUTH_URL } from "./api";

export const authClient = createAuthClient({
  baseURL: API_AUTH_URL,
  fetchOptions: {
    onRequest(context) {
      const scheme = (Constants.expoConfig?.scheme as string) || "soundkit";
      context.headers.set("expo-origin", `${scheme}://`);
    },
    plugins: [
      {
        hooks: {
          onRequest(context) {
            const scheme =
              (Constants.expoConfig?.scheme as string) || "soundkit";
            context.headers.set("expo-origin", `${scheme}://`);
          },
        },
        id: "soundkit-expo-canonical-origin-fetch",
        name: "soundkit-expo-canonical-origin-fetch",
      },
    ],
  },
  plugins: [
    expoClient({
      scheme: (Constants.expoConfig?.scheme as string) || "soundkit",
      storage: SecureStore,
      ...nativeSessionScope(
        API_AUTH_URL,
        (Constants.expoConfig?.scheme as string) || "soundkit"
      ),
    }),
  ],
});
