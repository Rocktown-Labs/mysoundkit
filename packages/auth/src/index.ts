import { expo } from "@better-auth/expo";
import { stripe } from "@better-auth/stripe";
import { createDb } from "@soundkit/db";
import { userNotifications } from "@soundkit/db/schema/app";
import { member } from "@soundkit/db/schema/auth";
import * as schema from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, organization } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { Stripe } from "stripe";

import { createStripePlans } from "./plans";
import { verifyTurnstileRequest } from "./turnstile";

const getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  hostFromUrl = (value: string) => {
    try {
      return new URL(value).host;
    } catch {
      return "";
    }
  },
  uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))],
  getAdminEmails = () =>
    getEnvValue("ADMIN_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  getPublicSiteUrl = () =>
    getEnvValue("SOUNDKIT_PUBLIC_URL") ||
    getEnvValue("CORS_ORIGIN") ||
    "https://mysoundkit.com",
  getEmailFrom = () =>
    getEnvValue("SOUNDKIT_EMAIL_FROM") ||
    "SoundKit <noreply@news.mysoundkit.com>",
  getResendApiKey = () => getEnvValue("RESEND_API_KEY"),
  absoluteSiteUrl = (pathOrUrl: string) => {
    if (/^https?:\/\//u.test(pathOrUrl)) {
      return pathOrUrl;
    }

    return `${getPublicSiteUrl().replace(/\/$/u, "")}/${pathOrUrl.replace(/^\//u, "")}`;
  };

interface AuthEmailLink {
  description?: string;
  href: string;
  label: string;
}

interface AuthSubscriptionRow {
  id: string;
  plan?: string | null;
  referenceId?: string | null;
  status?: string | null;
}

const sendAuthNotificationEmail = async ({
    actionUrl,
    body,
    ctaLabel,
    email,
    eyebrow,
    footerNote,
    heading,
    idempotencyKey,
    links,
    previewText,
    recipientName,
    subject,
    tag,
  }: {
    actionUrl: string;
    body: string;
    ctaLabel: string;
    email: string;
    eyebrow: string;
    footerNote: string;
    heading: string;
    idempotencyKey: string;
    links?: AuthEmailLink[];
    previewText: string;
    recipientName: string;
    subject: string;
    tag: string;
  }) => {
    const apiKey = getResendApiKey();

    if (!apiKey) {
      console.info(`${subject} for ${email}: ${actionUrl}`);
      return;
    }

    const publicSiteUrl = getPublicSiteUrl(),
      [{ renderTransactionalNotificationEmail }, { Resend }] =
        await Promise.all([
          import("@soundkit/transactional"),
          import("resend"),
        ]),
      { html, text } = await renderTransactionalNotificationEmail({
        actionUrl,
        assetBaseUrl: publicSiteUrl,
        body,
        ctaLabel,
        eyebrow,
        footerNote,
        heading,
        links,
        previewText,
        recipientName,
        subject,
      }),
      resend = new Resend(apiKey),
      { error } = await resend.emails.send(
        {
          from: getEmailFrom(),
          html,
          subject,
          tags: [{ name: "email_type", value: tag }],
          text,
          to: [email],
        },
        { idempotencyKey }
      );

    if (error) {
      console.warn("Auth email failed", {
        email,
        error: error.message,
        tag,
      });
    }
  },
  sendOrganizationInviteEmail = ({
    email,
    id,
    inviterName,
    organizationName,
  }: {
    email: string;
    id: string;
    inviterName?: string | null;
    organizationName?: string | null;
  }) =>
    sendAuthNotificationEmail({
      actionUrl: `${env.BETTER_AUTH_URL.replace(/\/$/u, "")}/invite/${id}`,
      body: `${inviterName ?? "Someone"} invited you to join ${organizationName ?? "their SoundKit workspace"}. Accept the invite to manage music, releases, and team activity together.`,
      ctaLabel: "Accept invite",
      email,
      eyebrow: "Workspace invite",
      footerNote:
        "You are receiving this because someone invited this email address to a SoundKit workspace.",
      heading: "You are invited to SoundKit",
      idempotencyKey: `org-invite/${id}`,
      previewText: `${inviterName ?? "Someone"} invited you to join ${organizationName ?? "SoundKit"}.`,
      recipientName: "there",
      subject: `Invite to ${organizationName ?? "SoundKit"}`,
      tag: "org_invite",
    }),
  sendPremiumWelcomeEmail = ({
    email,
    name,
    plan,
    subscriptionId,
  }: {
    email: string;
    name?: string | null;
    plan: string;
    subscriptionId: string;
  }) => {
    const isArtistPremium = plan === "soundkit_premium_artist";
    return sendAuthNotificationEmail({
      actionUrl: absoluteSiteUrl(
        isArtistPremium ? "/dashboard/career/payments" : "/"
      ),
      body: isArtistPremium
        ? "Your premium access is active. Set up artist payments with Stripe so fans can purchase your releases and send tips."
        : "Your premium access is active. Head back to SoundKit to explore full listening, video, and live experiences.",
      ctaLabel: isArtistPremium ? "Set up artist payments" : "Explore SoundKit",
      email,
      eyebrow: "Premium active",
      footerNote:
        "You are receiving this because SoundKit Premium is active on your account.",
      heading: "Welcome to SoundKit Premium",
      idempotencyKey: `welcome-premium/${subscriptionId}`,
      links: isArtistPremium
        ? [
            {
              description:
                "Complete Stripe verification so fans can purchase your music and send tips.",
              href: absoluteSiteUrl("/dashboard/career/payments"),
              label: "Set up artist payments",
            },
            {
              description:
                "Add audio, cover art, credits, and release details in one place.",
              href: absoluteSiteUrl("/dashboard/tracks/new"),
              label: "Upload a track",
            },
          ]
        : [],
      previewText: "Your SoundKit Premium access is active.",
      recipientName: name ?? "there",
      subject: "Welcome to SoundKit Premium",
      tag: "welcome_premium",
    });
  },
  sendPasswordResetEmail = ({
    email,
    name,
    url,
  }: {
    email: string;
    name?: string | null;
    url: string;
  }) =>
    sendAuthNotificationEmail({
      actionUrl: url,
      body: "We received a request to reset your SoundKit password. Use the secure link below to choose a new one.",
      ctaLabel: "Reset password",
      email,
      eyebrow: "Account security",
      footerNote:
        "If you did not request this, you can ignore this email and your password will stay the same.",
      heading: "Reset your SoundKit password",
      idempotencyKey: `password-reset/${email}/${url}`,
      previewText: "Use this secure link to reset your SoundKit password.",
      recipientName: name ?? "there",
      subject: "Reset your SoundKit password",
      tag: "password_reset",
    }),
  sendEmailVerificationEmail = ({
    email,
    name,
    url,
  }: {
    email: string;
    name?: string | null;
    url: string;
  }) =>
    sendAuthNotificationEmail({
      actionUrl: url,
      body: "Confirm this email address so SoundKit can keep your account secure and send the account updates you ask for.",
      ctaLabel: "Verify email",
      email,
      eyebrow: "Verify email",
      footerNote:
        "You are receiving this because this email address was used for a SoundKit account.",
      heading: "Verify your SoundKit email",
      idempotencyKey: `email-verification/${email}/${url}`,
      previewText: "Confirm your SoundKit email address.",
      recipientName: name ?? "there",
      subject: "Verify your SoundKit email",
      tag: "email_verification",
    }),
  isPremiumPlan = (plan: string | null | undefined) =>
    Boolean(plan?.startsWith("soundkit_premium_")),
  addPremiumNotification = async ({
    plan,
    subscriptionId,
    userId,
  }: {
    plan: string;
    subscriptionId: string;
    userId: string;
  }) => {
    const isArtistPremium = plan === "soundkit_premium_artist";
    await createDb()
      .insert(userNotifications)
      .values({
        id: `premium_active:${subscriptionId}:${userId}`,
        link: isArtistPremium ? "/dashboard/career/payments" : "/",
        message: isArtistPremium
          ? "Welcome to SoundKit Premium. Set up Stripe payments to start earning."
          : "Welcome to SoundKit Premium. Your Premium listening access is active.",
        title: "Welcome to SoundKit Premium",
        type: "premium_active",
        userId,
      })
      .onConflictDoNothing();
  },
  sendPremiumWelcomeForSubscription = async ({
    id,
    plan,
    referenceId,
    status,
  }: AuthSubscriptionRow) => {
    if (!(id && referenceId && isPremiumPlan(plan))) {
      return;
    }
    const premiumPlan = plan ?? "";

    if (!(status === "active" || status === "trialing")) {
      return;
    }

    const [directUser] = await createDb()
      .select({
        email: schema.user.email,
        name: schema.user.name,
      })
      .from(schema.user)
      .where(eq(schema.user.id, referenceId))
      .limit(1);

    if (directUser) {
      await addPremiumNotification({
        plan: premiumPlan,
        subscriptionId: id,
        userId: referenceId,
      });
      await sendPremiumWelcomeEmail({
        email: directUser.email,
        name: directUser.name,
        plan: premiumPlan,
        subscriptionId: id,
      });
      return;
    }

    const [owner] = await createDb()
      .select({
        email: schema.user.email,
        id: schema.user.id,
        name: schema.user.name,
      })
      .from(member)
      .innerJoin(schema.user, eq(schema.user.id, member.userId))
      .where(
        and(eq(member.organizationId, referenceId), eq(member.role, "owner"))
      )
      .limit(1);

    if (owner) {
      await addPremiumNotification({
        plan: premiumPlan,
        subscriptionId: id,
        userId: owner.id,
      });
      await sendPremiumWelcomeEmail({
        email: owner.email,
        name: owner.name,
        plan: premiumPlan,
        subscriptionId: id,
      });
    }
  },
  createStripeClient = () => {
    const secretKey = getEnvValue("STRIPE_SECRET_KEY");

    if (!secretKey) {
      return null;
    }

    return new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });
  };

export const createAuth = () => {
  const db = createDb(),
    authHost = hostFromUrl(env.BETTER_AUTH_URL),
    siteHost = hostFromUrl(env.CORS_ORIGIN),
    isLocalAuthUrl =
      env.BETTER_AUTH_URL.includes("localhost") ||
      env.BETTER_AUTH_URL.includes("127.0.0.1"),
    isDevelopment =
      globalThis.process?.env.NODE_ENV === "development" || isLocalAuthUrl,
    stripeClient = createStripeClient(),
    stripeWebhookSecret = getEnvValue(
      "STRIPE_BETTER_AUTH_WEBHOOK_SECRET"
    ),
    allowedAuthHosts = uniqueValues([
      authHost,
      siteHost,
      "mysoundkit.com",
      "www.mysoundkit.com",
      "*.mysoundkit.pages.dev",
      "*.pages.dev",
      "*.workers.dev",
      "*.rocktown-labs.workers.dev",
    ]),
    dynamicBaseURL = isDevelopment
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
      subscription: {
        create: {
          after: (subscriptionRow: AuthSubscriptionRow) =>
            sendPremiumWelcomeForSubscription(subscriptionRow),
        },
        update: {
          after: (subscriptionRow: AuthSubscriptionRow) =>
            sendPremiumWelcomeForSubscription(subscriptionRow),
        },
      },
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
      sendResetPassword: ({ user, url }) =>
        sendPasswordResetEmail({
          email: user.email,
          name: user.name,
          url,
        }),
    },
    emailVerification: {
      sendVerificationEmail: ({ user, url }) =>
        sendEmailVerificationEmail({
          email: user.email,
          name: user.name,
          url,
        }),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const actionByPath: Record<string, string> = {
            "/request-password-reset": "forgot_password",
            "/sign-in/email": "login",
            "/sign-up/email": "signup",
          },
          action = actionByPath[ctx.path];
        if (!action) {
          return;
        }

        if (!ctx.request) {
          throw APIError.from("FORBIDDEN", {
            code: "TURNSTILE_FAILED",
            message: "Security verification failed. Please try again.",
          });
        }

        const valid = await verifyTurnstileRequest({
          action,
          request: ctx.request,
        });
        if (!valid) {
          throw APIError.from("FORBIDDEN", {
            code: "TURNSTILE_FAILED",
            message: "Security verification failed. Please try again.",
          });
        }
      }),
    },
    plugins: [
      admin({
        defaultRole: "user",
      }),
      organization({
        allowUserToCreateOrganization: true,
        requireEmailVerificationOnInvitation: false,
        sendInvitationEmail: (data) =>
          sendOrganizationInviteEmail({
            email: data.email,
            id: data.id,
            inviterName: data.inviter?.user?.name,
            organizationName: data.organization?.name,
          }),
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
                getCheckoutSessionParams: () => ({
                  params: {
                    allow_promotion_codes: true,
                    integration_identifier: `soundkit_${crypto
                      .randomUUID()
                      .replaceAll("-", "")
                      .slice(0, 8)}`,
                  },
                }),
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
    socialProviders:
      getEnvValue("GOOGLE_CLIENT_ID") && getEnvValue("GOOGLE_CLIENT_SECRET")
        ? {
            google: {
              clientId: getEnvValue("GOOGLE_CLIENT_ID"),
              clientSecret: getEnvValue("GOOGLE_CLIENT_SECRET"),
            },
          }
        : undefined,
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
