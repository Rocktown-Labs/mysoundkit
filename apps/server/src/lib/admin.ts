import { env } from "@soundkit/env/server";

import type { AuthenticatedUser } from "./types";

const getAdminEmails = (): string[] =>
  ((env as unknown as Record<string, string | undefined>).ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isConfiguredAdminEmail = (
  email: string | null | undefined
): boolean => Boolean(email && getAdminEmails().includes(email.toLowerCase()));

export const isAdminUser = (
  user: AuthenticatedUser | null | undefined
): boolean =>
  Boolean(
    user &&
    (user.role
      ?.split(",")
      .map((role) => role.trim())
      .includes("admin") ||
      isConfiguredAdminEmail(user.email))
  );
