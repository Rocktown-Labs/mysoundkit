import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { API_AUTH_URL } from "./api";

export const authClient = createAuthClient({
  baseURL: API_AUTH_URL,
  plugins: [
    expoClient({
      scheme: Constants.expoConfig?.scheme as string,
      storage: SecureStore,
      storagePrefix: Constants.expoConfig?.scheme as string,
    }),
  ],
});
