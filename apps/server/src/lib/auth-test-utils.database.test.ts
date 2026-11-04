/* oxlint-disable one-var, sort-vars -- Guarded local integration setup and cleanup. */
import { createAuth } from "@soundkit/auth";
import { createDb, runWithDatabaseScope } from "@soundkit/db";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";

// A separate test-only instance preserves the real auth options without adding
// privileged test helpers to production or widening its public type surface.
const createTestAuth = () => {
  const { options } = createAuth();
  return betterAuth({ ...options, plugins: [...options.plugins, testUtils()] });
};

const url = process.env.SOUNDKIT_TEST_DATABASE_URL;
afterEach(() => vi.unstubAllEnvs());
it.runIf(Boolean(url) && process.env.SOUNDKIT_DISABLE_DB_TESTS !== "true")(
  "uses real Better Auth test helpers with scoped signed staging cookies",
  async () => {
    if (!url) {
      throw new Error("Explicit local auth test database required");
    }
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(
      new URL(url).hostname
    );
    vi.stubEnv("DATABASE_URL", url);
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "soundkit-local-test-utils-secret-not-a-deploy-credential"
    );
    vi.stubEnv("BETTER_AUTH_URL", "https://api.staging.soundkit.bio");
    vi.stubEnv("CORS_ORIGIN", "https://staging.soundkit.bio");
    vi.stubEnv("SOUNDKIT_BIO_URL", "https://bio.staging.soundkit.bio");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_BETTER_AUTH_WEBHOOK_SECRET", "");
    vi.stubEnv("RESEND_API_KEY", "");
    await runWithDatabaseScope(async () => {
      const auth = createTestAuth(),
        context = await auth.$context,
        user = await context.test.saveUser(
          context.test.createUser({
            email: `auth-utils-${crypto.randomUUID()}@example.test`,
            name: "Synthetic Auth Fixture",
          })
        );
      try {
        const login = await context.test.login({ userId: user.id }),
          session = await auth.api.getSession({ headers: login.headers }),
          cookies = await context.test.getCookies({
            domain: "staging.soundkit.bio",
            userId: user.id,
          }),
          sessionCookie = cookies.find((cookie) =>
            cookie.name.endsWith(".session_token")
          );
        expect(session?.user.id).toBe(user.id);
        expect(auth.options.advanced.crossSubDomainCookies).toEqual({
          domain: "staging.soundkit.bio",
          enabled: true,
        });
        expect(login.headers.get("cookie")).toContain(
          "__Secure-soundkit-staging.session_token="
        );
        expect(sessionCookie).toMatchObject({
          domain: "staging.soundkit.bio",
          httpOnly: true,
          name: "__Secure-soundkit-staging.session_token",
          secure: true,
        });
        const production = new Headers(login.headers);
        production.set(
          "cookie",
          (login.headers.get("cookie") ?? "").replace(
            "__Secure-soundkit-staging.",
            "__Secure-better-auth."
          )
        );
        expect(await auth.api.getSession({ headers: production })).toBeNull();
        const unsigned = new Headers({
          cookie: `__Secure-soundkit-staging.session_token=${login.token}`,
        });
        expect(await auth.api.getSession({ headers: unsigned })).toBeNull();
      } finally {
        await createDb().execute(
          sql`SELECT soundkit_analytics.erase_account(${user.id})`
        );
        await context.test.deleteUser(user.id);
      }
    });
  }
);
