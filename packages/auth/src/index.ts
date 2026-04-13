import { expo } from "@better-auth/expo";
import { createDb } from "@soundkit/db";
import * as schema from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

export const createAuth = () => {
  const db = createDb();
  const isDevelopment = globalThis.process?.env.NODE_ENV === "development";

  return betterAuth({
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
      },
      // uncomment crossSubDomainCookies setting when ready to deploy and replace <your-workers-subdomain> with your actual workers subdomain
      // https://developers.cloudflare.com/workers/wrangler/configuration/#workersdev
      // crossSubDomainCookies: {
      //   enabled: true,
      //   domain: "<your-workers-subdomain>",
      // },
    },
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
        sendInvitationEmail: (data) => Promise.resolve(
            console.log(
              `Organization invite for ${data.email}: ${env.BETTER_AUTH_URL}/invite/${data.id}`
            )
          ),
        teams: {
          enabled: true,
        },
      }),
      expo(),
    ],
    secret: env.BETTER_AUTH_SECRET,
    // uncomment cookieCache setting when ready to deploy to Cloudflare using *.workers.dev domains
    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 60,
    //   },
    // },
    trustedOrigins: [
      env.CORS_ORIGIN,
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
