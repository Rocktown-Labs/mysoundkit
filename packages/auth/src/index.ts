import { expo } from "@better-auth/expo";
import { stripe } from "@better-auth/stripe";
import { createDb } from "@soundkit/db";
import { member } from "@soundkit/db/schema/auth";
import * as schema from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { Stripe } from "stripe";

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const createStripeClient = () => {
  const secretKey = getEnvValue("STRIPE_SECRET_KEY");

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover",
  });
};

const createStripePlans = () =>
  [
    {
      annualDiscountPriceId: getEnvValue("STRIPE_ARTIST_LITE_ANNUAL_PRICE_ID"),
      group: "artist",
      limits: { tracks: 25, videos: 3 },
      name: "artist_lite_ads",
      priceId: getEnvValue("STRIPE_ARTIST_LITE_MONTHLY_PRICE_ID"),
    },
    {
      annualDiscountPriceId: getEnvValue("STRIPE_ARTIST_TEAM_ANNUAL_PRICE_ID"),
      group: "artist",
      limits: { members: 10, tracks: 250, videos: 25 },
      name: "artist_team",
      priceId: getEnvValue("STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID"),
    },
    {
      annualDiscountPriceId: getEnvValue("STRIPE_FAN_LITE_ANNUAL_PRICE_ID"),
      group: "fan",
      limits: { familyMembers: 1 },
      name: "fan_lite_ads",
      priceId: getEnvValue("STRIPE_FAN_LITE_MONTHLY_PRICE_ID"),
    },
    {
      annualDiscountPriceId: getEnvValue("STRIPE_FAN_FAMILY_ANNUAL_PRICE_ID"),
      group: "fan",
      limits: { familyMembers: 5 },
      name: "fan_family",
      priceId: getEnvValue("STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID"),
    },
  ].filter((plan) => plan.priceId);

export const createAuth = () => {
  const db = createDb();
  const isLocalAuthUrl =
    env.BETTER_AUTH_URL.includes("localhost") ||
    env.BETTER_AUTH_URL.includes("127.0.0.1");
  const isDevelopment =
    globalThis.process?.env.NODE_ENV === "development" || isLocalAuthUrl;
  const stripeClient = createStripeClient();
  const stripeWebhookSecret = getEnvValue("STRIPE_WEBHOOK_SECRET");

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
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
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
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.CORS_ORIGIN,
      env.BETTER_AUTH_URL,
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
