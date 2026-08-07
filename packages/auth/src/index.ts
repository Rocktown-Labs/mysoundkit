import { expo } from "@better-auth/expo";
import { stripe } from "@better-auth/stripe";
import { createDb } from "@soundkit/db";
import { member } from "@soundkit/db/schema/auth";
import * as schema from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { Stripe } from "stripe";

import { createStripePlans } from "./plans";

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const hostFromUrl = (value: string) => {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
};

const uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))];

const getAdminEmails = () =>
  getEnvValue("ADMIN_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const createStripeClient = () => {
  const secretKey = getEnvValue("STRIPE_SECRET_KEY");

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover",
  });
};

export const createAuth = () => {
  const db = createDb();
  const authHost = hostFromUrl(env.BETTER_AUTH_URL);
  const siteHost = hostFromUrl(env.CORS_ORIGIN);
  const isLocalAuthUrl =
    env.BETTER_AUTH_URL.includes("localhost") ||
    env.BETTER_AUTH_URL.includes("127.0.0.1");
  const isDevelopment =
    globalThis.process?.env.NODE_ENV === "development" || isLocalAuthUrl;
  const stripeClient = createStripeClient();
  const stripeWebhookSecret = getEnvValue("STRIPE_WEBHOOK_SECRET");
  const allowedAuthHosts = uniqueValues([
    authHost,
    siteHost,
    "mysoundkit.com",
    "www.mysoundkit.com",
    "*.mysoundkit.pages.dev",
    "*.pages.dev",
    "*.workers.dev",
    "*.rocktown-labs.workers.dev",
  ]);
  const dynamicBaseURL = isDevelopment
    ? env.BETTER_AUTH_URL
    : {
        allowedHosts: allowedAuthHosts,
        fallback: env.BETTER_AUTH_URL,
        protocol: "https" as const,
      };

  return betterAuth({
    advanced: {
      crossSubDomainCookies: {
        domain: "mysoundkit.com",
        enabled: !isDevelopment,
      },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: !isDevelopment,
      },
    },
    basePath: "/auth",
    baseURL: dynamicBaseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    databaseHooks: {
      user: {
        create: {
          before: (user) =>
            Promise.resolve({
              data: {
                ...user,
                role: getAdminEmails().includes(user.email.toLowerCase())
                  ? "admin"
                  : "user",
              },
            }),
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      admin({
        defaultRole: "user",
      }),
      organization({
        allowUserToCreateOrganization: true,
        requireEmailVerificationOnInvitation: false,
        sendInvitationEmail: (data) =>
          Promise.resolve(
            console.log(
              `Organization invite for ${data.email}: ${env.BETTER_AUTH_URL}/invite/${data.id}`
            )
          ),
        teams: {
          enabled: true,
        },
      }),
      ...(stripeClient && stripeWebhookSecret
        ? [
            stripe({
              createCustomerOnSignUp: true,
              organization: {
                enabled: true,
                getCustomerCreateParams: (org) =>
                  Promise.resolve({
                    metadata: {
                      organizationId: org.id,
                      source: "soundkit",
                    },
                    name: org.name,
                  }),
              },
              stripeClient,
              stripeWebhookSecret,
              subscription: {
                authorizeReference: async ({ action, referenceId, user }) => {
                  if (!referenceId) {
                    return false;
                  }

                  if (referenceId === user.id) {
                    return true;
                  }

                  const [membership] = await db
                    .select({ role: member.role })
                    .from(member)
                    .where(
                      and(
                        eq(member.organizationId, referenceId),
                        eq(member.userId, user.id)
                      )
                    );

                  if (!membership) {
                    return false;
                  }

                  if (
                    action === "upgrade-subscription" ||
                    action === "cancel-subscription" ||
                    action === "restore-subscription" ||
                    action === "billing-portal"
                  ) {
                    return membership.role === "owner";
                  }

                  return true;
                },
                enabled: true,
                plans: createStripePlans,
              },
            }),
          ]
        : []),
      expo(),
    ],
    rateLimit: {
      customRules: {
        "/forget-password": {
          max: 3,
          window: 60,
        },
        "/sign-in/email": {
          max: 5,
          window: 60,
        },
        "/sign-up/email": {
          max: 5,
          window: 60,
        },
      },
      enabled: true,
      max: 100,
      window: 60,
    },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.CORS_ORIGIN,
      env.BETTER_AUTH_URL,
      "https://mysoundkit.com",
      "https://www.mysoundkit.com",
      "https://*.mysoundkit.pages.dev",
      "https://*.pages.dev",
      "https://*.workers.dev",
      "https://*.rocktown-labs.workers.dev",
      "soundkit://",
      ...(isDevelopment
        ? [
            "exp://",
            "exp://**",
            "exp://192.168.*.*:*/**",
            "http://localhost:8081",
          ]
        : []),
    ],
  });
};
