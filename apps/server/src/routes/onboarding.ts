import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfileRoles,
  artistProfiles,
  fanProfiles,
  genres,
  profileLinks,
  userProfiles,
  userGenrePreferences,
} from "@soundkit/db/schema/app";
import { subscription } from "@soundkit/db/schema/auth";
import { and, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { createPlanCheckout, isFreePlan } from "@/lib/billing";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import {
  messageResponseSchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
  onboardingResponseSchema,
  usernameAvailabilityQuerySchema,
  usernameAvailabilityResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { ensureWorkspaceForUser, slugify } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();
const RESERVED_USERNAMES = new Set(["soundkit"]);

type UsernameAvailability =
  | {
      available: true;
      message: string;
      reason: "available";
      username: string;
    }
  | {
      available: false;
      message: string;
      reason: "reserved" | "taken";
      username: string;
    };

const checkUsernameAvailability = async (
  username: string,
  currentUserId?: string
): Promise<UsernameAvailability> => {
  if (RESERVED_USERNAMES.has(username)) {
    return {
      available: false,
      message: "That username is reserved.",
      reason: "reserved",
      username,
    };
  }

  if (!isDatabaseConfigured()) {
    return {
      available: true,
      message: "Username is available.",
      reason: "available",
      username,
    };
  }

  const db = createDb();
  const [existing] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(sql`lower(${userProfiles.username}) = ${username}`)
    .limit(1);

  if (existing && existing.userId !== currentUserId) {
    return {
      available: false,
      message: "That username is already taken.",
      reason: "taken",
      username,
    };
  }

  return {
    available: true,
    message: "Username is available.",
    reason: "available",
    username,
  };
};

const ensureGenre = async (name: string) => {
  const db = createDb();
  const slug = slugify(name);
  const [existing] = await db
    .select({ id: genres.id })
    .from(genres)
    .where(eq(genres.slug, slug))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const genreId = crypto.randomUUID();
  await db.insert(genres).values({
    id: genreId,
    name,
    slug,
  });

  return genreId;
};

const ensureFreeSubscription = async ({
  planCode,
  referenceId,
}: {
  planCode: string;
  referenceId: string;
}) => {
  if (!isFreePlan(planCode)) {
    return;
  }

  const db = createDb();
  const [existing] = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, referenceId),
        eq(subscription.plan, planCode),
        eq(subscription.status, "active")
      )
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(subscription).values({
    id: crypto.randomUUID(),
    plan: planCode,
    referenceId,
    status: "active",
  });
};

const onboardingUrls = (request: Request) => {
  const url = new URL(request.url);
  const { origin } = url;

  return {
    cancelUrl: `${origin}/signup`,
    successUrl: `${origin}/dashboard`,
  };
};

app.openapi(
  createRoute({
    method: "get",
    path: "/username-availability",
    request: {
      query: usernameAvailabilityQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        usernameAvailabilityResponseSchema,
        "Username availability"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const { username } = c.req.valid("query");
    const user = c.get("user");
    const availability = await checkUsernameAvailability(
      username,
      isAuthenticatedUser(user) ? user.id : undefined
    );

    return c.json(availability, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/artist",
    request: {
      body: jsonContentRequired(
        onboardingArtistBodySchema,
        "Artist onboarding payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        onboardingResponseSchema,
        "Artist onboarding saved"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Username unavailable"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    if (!(isAuthenticatedUser(user) || !isDatabaseConfigured())) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const usernameAvailability = await checkUsernameAvailability(
      body.username,
      isAuthenticatedUser(user) ? user.id : undefined
    );

    if (!usernameAvailability.available) {
      return c.json(
        { message: usernameAvailability.message },
        HttpStatusCodes.CONFLICT
      );
    }

    if (isAuthenticatedUser(user) && isDatabaseConfigured()) {
      const db = createDb();
      const now = new Date();
      const genreId = await ensureGenre(body.primaryGenre);
      const workspaceId = await ensureWorkspaceForUser({
        accountType: "artist",
        displayName: user.name ?? body.username,
        user,
      });

      await db
        .insert(userProfiles)
        .values({
          accountType: "artist",
          city: body.city,
          displayName: user.name ?? body.username,
          onboardingCompletedAt: now,
          state: body.state,
          updatedAt: now,
          userId: user.id,
          username: body.username,
        })
        .onConflictDoUpdate({
          set: {
            accountType: "artist",
            city: body.city,
            onboardingCompletedAt: now,
            state: body.state,
            updatedAt: now,
            username: body.username,
          },
          target: userProfiles.userId,
        });

      await db
        .insert(artistProfiles)
        .values({
          primaryGenreId: genreId,
          primaryOrganizationId: workspaceId,
          stageName: user.name ?? body.username,
          updatedAt: now,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
            primaryGenreId: genreId,
            primaryOrganizationId: workspaceId,
            stageName: user.name ?? body.username,
            updatedAt: now,
          },
          target: artistProfiles.userId,
        });

      await db
        .delete(artistProfileRoles)
        .where(eq(artistProfileRoles.userId, user.id));

      await db.insert(artistProfileRoles).values(
        body.roles.map((role) => ({
          role,
          userId: user.id,
        }))
      );

      const linkInputs = [
        ["instagram", body.instagramHandle],
        ["tiktok", body.tiktokHandle],
        ["twitter", body.twitterHandle],
        ["spotify", body.spotifyUrl],
        ["apple_music", body.appleMusicUrl],
        ["youtube", body.youtubeUrl],
      ] as const;

      await db.delete(profileLinks).where(eq(profileLinks.userId, user.id));

      const links = linkInputs
        .filter(([, value]) => Boolean(value))
        .map(([platform, value], index) => ({
          handle: value?.startsWith("http") ? null : value,
          id: crypto.randomUUID(),
          platform,
          sortOrder: index,
          url: value?.startsWith("http")
            ? value
            : `https://${platform}.com/${value}`,
          userId: user.id,
        }));

      if (links.length > 0) {
        await db.insert(profileLinks).values(links);
      }

      await ensureFreeSubscription({
        planCode: body.selectedPlanCode,
        referenceId: workspaceId,
      });

      const checkout = await createPlanCheckout({
        ...onboardingUrls(c.req.raw),
        planCode: body.selectedPlanCode,
        referenceId: workspaceId,
        request: c.req.raw,
        seats: Math.max(1, body.teamInviteEmails.length + 1),
      });

      return c.json(
        {
          checkoutUrl: checkout.checkoutUrl,
          message: `Artist onboarding captured for ${body.username}`,
          requiresCheckout: Boolean(checkout.requiresCheckout),
          setupRequired: Boolean(checkout.setupRequired),
          workspaceId,
        },
        HttpStatusCodes.CREATED
      );
    }

    return c.json(
      {
        checkoutUrl: null,
        message: `Artist onboarding captured for ${body.username}`,
        requiresCheckout: false,
        setupRequired: true,
        workspaceId: null,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/fan",
    request: {
      body: jsonContentRequired(
        onboardingFanBodySchema,
        "Fan onboarding payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        onboardingResponseSchema,
        "Fan onboarding saved"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Username unavailable"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    if (!(isAuthenticatedUser(user) || !isDatabaseConfigured())) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const usernameAvailability = await checkUsernameAvailability(
      body.username,
      isAuthenticatedUser(user) ? user.id : undefined
    );

    if (!usernameAvailability.available) {
      return c.json(
        { message: usernameAvailability.message },
        HttpStatusCodes.CONFLICT
      );
    }

    if (isAuthenticatedUser(user) && isDatabaseConfigured()) {
      const db = createDb();
      const now = new Date();
      const workspaceId = await ensureWorkspaceForUser({
        accountType: "fan",
        displayName: user.name ?? body.username,
        user,
      });

      await db
        .insert(userProfiles)
        .values({
          accountType: "fan",
          city: body.city,
          displayName: user.name ?? body.username,
          onboardingCompletedAt: now,
          state: body.state,
          updatedAt: now,
          userId: user.id,
          username: body.username,
        })
        .onConflictDoUpdate({
          set: {
            accountType: "fan",
            city: body.city,
            onboardingCompletedAt: now,
            state: body.state,
            updatedAt: now,
            username: body.username,
          },
          target: userProfiles.userId,
        });

      await db
        .insert(fanProfiles)
        .values({
          updatedAt: now,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
            updatedAt: now,
          },
          target: fanProfiles.userId,
        });

      await db
        .delete(userGenrePreferences)
        .where(eq(userGenrePreferences.userId, user.id));

      const genreIds = [];
      for (const genre of body.genrePreferences) {
        genreIds.push(await ensureGenre(genre));
      }

      await db.insert(userGenrePreferences).values(
        genreIds.map((genreId) => ({
          genreId,
          userId: user.id,
        }))
      );

      await ensureFreeSubscription({
        planCode: body.selectedPlanCode,
        referenceId: workspaceId,
      });

      const checkout = await createPlanCheckout({
        ...onboardingUrls(c.req.raw),
        planCode: body.selectedPlanCode,
        referenceId: workspaceId,
        request: c.req.raw,
        seats: 1,
      });

      return c.json(
        {
          checkoutUrl: checkout.checkoutUrl,
          message: `Fan onboarding captured for ${body.username}`,
          requiresCheckout: Boolean(checkout.requiresCheckout),
          setupRequired: Boolean(checkout.setupRequired),
          workspaceId,
        },
        HttpStatusCodes.CREATED
      );
    }

    return c.json(
      {
        checkoutUrl: null,
        message: `Fan onboarding captured for ${body.username}`,
        requiresCheckout: false,
        setupRequired: true,
        workspaceId: null,
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
