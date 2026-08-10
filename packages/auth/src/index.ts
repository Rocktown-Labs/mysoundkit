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

const getPublicSiteUrl = () =>
  getEnvValue("SOUNDKIT_PUBLIC_URL") ||
  getEnvValue("CORS_ORIGIN") ||
  "https://mysoundkit.com";

const getEmailFrom = () =>
  getEnvValue("SOUNDKIT_EMAIL_FROM") ||
  "SoundKit <noreply@news.mysoundkit.com>";

const getResendApiKey = () => getEnvValue("RESEND_API_KEY");

const absoluteSiteUrl = (pathOrUrl: string) => {
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

  const publicSiteUrl = getPublicSiteUrl();
  const [{ renderTransactionalNotificationEmail }, { Resend }] =
    await Promise.all([import("@soundkit/transactional"), import("resend")]);
  const { html, text } = await renderTransactionalNotificationEmail({
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
  });
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(
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
};

const sendOrganizationInviteEmail = ({
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
  });

const sendWelcomeEmail = ({
  email,
  name,
  userId,
}: {
  email: string;
  name?: string | null;
  userId: string;
}) =>
  sendAuthNotificationEmail({
    actionUrl: absoluteSiteUrl("/dashboard/tracks/new"),
    body: "Your SoundKit account is ready. Start by adding the music, videos, and collaboration opportunities you want people to hear, watch, or join.",
    ctaLabel: "Upload your first track",
    email,
    eyebrow: "Welcome",
    footerNote:
      "You are receiving this because you created a SoundKit account.",
    heading: "Welcome to SoundKit",
    idempotencyKey: `welcome/${userId}`,
    links: [
      {
        description:
          "Add audio, cover art, credits, and release details in one place.",
        href: absoluteSiteUrl("/dashboard/tracks/new"),
        label: "Upload your first track",
      },
      {
        description:
          "Group multiple songs, assets, and notes into a release workspace.",
        href: absoluteSiteUrl("/dashboard/projects/new"),
        label: "Create a project",
      },
      {
        description:
          "Share visuals, performances, or music videos with your audience.",
        href: absoluteSiteUrl("/dashboard/videos/new"),
        label: "Upload a video",
      },
      {
        description:
          "Find hooks, verses, and collaboration openings from other artists.",
        href: absoluteSiteUrl("/dashboard/open-verses"),
        label: "Browse open verses",
      },
    ],
    previewText: "Your SoundKit account is ready. Start with your first track.",
    recipientName: name ?? "there",
    subject: "Welcome to SoundKit",
    tag: "welcome",
  });

const sendPremiumWelcomeEmail = ({
  email,
  name,
  subscriptionId,
}: {
  email: string;
  name?: string | null;
  subscriptionId: string;
}) =>
  sendAuthNotificationEmail({
    actionUrl: absoluteSiteUrl("/dashboard/live"),
    body: "Your premium access is active. You can keep building your catalog, publish videos and open verses, join live rooms, and participate in battles when you are ready.",
    ctaLabel: "Open live dashboard",
    email,
    eyebrow: "Premium active",
    footerNote:
      "You are receiving this because SoundKit Premium is active on your account.",
    heading: "Welcome to SoundKit Premium",
    idempotencyKey: `welcome-premium/${subscriptionId}`,
    links: [
      {
        description:
          "Add audio, cover art, credits, and release details in one place.",
        href: absoluteSiteUrl("/dashboard/tracks/new"),
        label: "Upload a track",
      },
      {
        description:
          "Group multiple songs, assets, and notes into a release workspace.",
        href: absoluteSiteUrl("/dashboard/projects/new"),
        label: "Create a project",
      },
      {
        description:
          "Share visuals, performances, or music videos with your audience.",
        href: absoluteSiteUrl("/dashboard/videos/new"),
        label: "Upload a video",
      },
      {
        description:
          "Post a track section for other artists to write and submit to.",
        href: absoluteSiteUrl("/dashboard/open-verses/new"),
        label: "Create an open verse",
      },
      {
        description:
          "Choose the songs you want ready when a live battle starts.",
        href: absoluteSiteUrl("/dashboard/live/my-kit"),
        label: "Build your battle kit",
      },
      {
        description:
          "Watch live battles, parties, and streams from the SoundKit community.",
        href: absoluteSiteUrl("/live/battles"),
        label: "Watch live battles",
      },
      {
        description:
          "Send or respond to battle challenges when you are ready to compete.",
        href: absoluteSiteUrl("/dashboard/live/challenge"),
        label: "Open battle challenges",
      },
    ],
    previewText:
      "Your premium access is active. Build your catalog and open the live tools when you are ready.",
    recipientName: name ?? "there",
    subject: "Welcome to SoundKit Premium",
    tag: "welcome_premium",
  });

const sendPasswordResetEmail = ({
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
  });

const sendEmailVerificationEmail = ({
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
  });

const isPremiumPlan = (plan: string | null | undefined) =>
  Boolean(plan?.startsWith("soundkit_premium_"));

const sendPremiumWelcomeForSubscription = async ({
  id,
  plan,
  referenceId,
  status,
}: AuthSubscriptionRow) => {
  if (!(id && referenceId && isPremiumPlan(plan))) {
    return;
  }

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
    await sendPremiumWelcomeEmail({
      email: directUser.email,
      name: directUser.name,
      subscriptionId: id,
    });
    return;
  }

  const [owner] = await createDb()
    .select({
      email: schema.user.email,
      name: schema.user.name,
    })
    .from(member)
    .innerJoin(schema.user, eq(schema.user.id, member.userId))
    .where(
      and(eq(member.organizationId, referenceId), eq(member.role, "owner"))
    )
    .limit(1);

  if (owner) {
    await sendPremiumWelcomeEmail({
      email: owner.email,
      name: owner.name,
      subscriptionId: id,
    });
  }
};

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
          after: (user) =>
            sendWelcomeEmail({
              email: user.email,
              name: user.name,
              userId: user.id,
            }),
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
