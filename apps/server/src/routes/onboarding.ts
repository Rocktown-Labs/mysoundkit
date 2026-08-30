import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfileRoles,
  artistProfiles,
  fanProfiles,
  genres,
  onboardingEmailReminders,
  onboardingProgress,
  profileLinks,
  userFollows,
  userProfiles,
  userGenrePreferences,
} from "@soundkit/db/schema/app";
import { subscription } from "@soundkit/db/schema/auth";
import { and, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { indexSearchEntity } from "@/lib/audio-processing";
import { createPlanCheckout, isFreePlan } from "@/lib/billing";
import { getPublicSiteUrl, sendTransactionalEmail } from "@/lib/email";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { notifyFollowCreated } from "@/lib/follow-notifications";
import { canonicalGenreName, canonicalGenreSlug } from "@/lib/genre-catalog";
import { canCompleteArtistOnboarding } from "@/lib/onboarding-domain";
import { assertPlanSeatCount, maxIncludedSeatsForPlan } from "@/lib/plan-seats";
import { normalizeProfileLinks } from "@/lib/profile-links";
import {
  creatorEligibilityBodySchema,
  messageResponseSchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
  onboardingResponseSchema,
  onboardingStateSchema,
  updateOnboardingStateBodySchema,
  usernameAvailabilityQuerySchema,
  usernameAvailabilityResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { claimUploadIntent, completeUploadIntent } from "@/lib/upload-intents";
import { ensureWorkspaceForUser } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  loadOnboardingState = async (userId: string) => {
    if (!isDatabaseConfigured()) {
      return null;
    }
    const db = createDb(),
      [state] = await db
        .select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId))
        .limit(1);
    return state ?? null;
  },
  serializeOnboardingState = (
    state: typeof onboardingProgress.$inferSelect
  ) => ({
    completedAt: state.completedAt?.toISOString() ?? null,
    creatorEligibility: state.creatorEligibility,
    creatorEligibilityLocked: Boolean(state.creatorEligibilityLockedAt),
    currentStep: state.currentStep,
    exitedAt: state.exitedAt?.toISOString() ?? null,
    intendedAccountType: state.intendedAccountType,
    lastActivityAt: state.lastActivityAt.toISOString(),
    marketingOptIn: state.marketingOptIn,
    rightsAttested: Boolean(state.rightsAttestedAt),
    selectedPlanCode: state.selectedPlanCode,
    startedAt: state.startedAt.toISOString(),
    userId: state.userId,
  }),
  RESERVED_USERNAMES = new Set(["soundkit"]);

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

    const db = createDb(),
      [existing] = await db
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
  },
  ensureGenre = async (name: string) => {
    const db = createDb(),
      canonicalName = canonicalGenreName(name),
      slug = canonicalGenreSlug(name),
      [existing] = await db
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
      name: canonicalName,
      slug,
    });

    return genreId;
  },
  ensureFreeSubscription = async ({
    planCode,
    referenceId,
  }: {
    planCode: string;
    referenceId: string;
  }) => {
    if (!isFreePlan(planCode)) {
      return;
    }

    const db = createDb(),
      [existing] = await db
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
  },
  onboardingUrls = (
    request: Request,
    accountType: "artist" | "fan",
    returnPath?: string
  ) => {
    const fallbackOrigin = new URL(request.url).origin,
      siteOrigin = getPublicSiteUrl().replace(/\/$/u, "") || fallbackOrigin,
      safeReturnPath =
        returnPath?.startsWith("/") && !returnPath.startsWith("//")
          ? returnPath
          : (accountType === "artist"
            ? "/dashboard"
            : "/");

    return {
      cancelUrl: `${siteOrigin}/signup`,
      successUrl: `${siteOrigin}${safeReturnPath}`,
    };
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/state",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        onboardingStateSchema.nullable(),
        "Current onboarding progress"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const state = await loadOnboardingState(user.id);
    return c.json(
      state ? serializeOnboardingState(state) : null,
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/state",
    request: {
      body: jsonContentRequired(
        updateOnboardingStateBodySchema,
        "Onboarding progress"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        onboardingStateSchema,
        "Onboarding progress saved"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Onboarding intent is locked"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Onboarding persistence requires a configured database." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const body = c.req.valid("json"),
      db = createDb(),
      current = await loadOnboardingState(user.id);
    if (
      current?.creatorEligibility === "major_label_affiliated" &&
      body.intendedAccountType === "artist"
    ) {
      return c.json(
        { message: "This account is locked to Fan onboarding." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const now = new Date(),
      intendedAccountType =
        body.intendedAccountType ?? current?.intendedAccountType ?? "fan",
      creatorEligibility =
        body.creatorEligibility ?? current?.creatorEligibility ?? null,
      marketingOptIn = body.marketingOptIn ?? current?.marketingOptIn ?? false;
    await db
      .insert(onboardingProgress)
      .values({
        creatorEligibility,
        currentStep: body.currentStep ?? current?.currentStep ?? 1,
        intendedAccountType,
        lastActivityAt: now,
        marketingOptIn,
        marketingOptInAt: marketingOptIn
          ? (current?.marketingOptInAt ?? now)
          : null,
        marketingOptInSource:
          body.marketingOptInSource ?? current?.marketingOptInSource ?? null,
        marketingOptInVersion:
          body.marketingOptInVersion ?? current?.marketingOptInVersion ?? null,
        selectedPlanCode:
          body.selectedPlanCode ?? current?.selectedPlanCode ?? null,
        startedAt: current?.startedAt ?? now,
        userId: user.id,
      })
      .onConflictDoUpdate({
        set: {
          creatorEligibility,
          currentStep: body.currentStep ?? current?.currentStep ?? 1,
          intendedAccountType,
          lastActivityAt: now,
          marketingOptIn,
          marketingOptInAt: marketingOptIn
            ? (current?.marketingOptInAt ?? now)
            : null,
          marketingOptInSource:
            body.marketingOptInSource ?? current?.marketingOptInSource ?? null,
          marketingOptInVersion:
            body.marketingOptInVersion ??
            current?.marketingOptInVersion ??
            null,
          selectedPlanCode:
            body.selectedPlanCode ?? current?.selectedPlanCode ?? null,
        },
        target: onboardingProgress.userId,
      });
    const saved = await loadOnboardingState(user.id);
    return c.json(
      serializeOnboardingState(saved as typeof onboardingProgress.$inferSelect),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/eligibility",
    request: {
      body: jsonContentRequired(
        creatorEligibilityBodySchema,
        "Creator eligibility declaration"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        onboardingStateSchema,
        "Eligibility saved"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Eligibility locked"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Eligibility persistence requires a configured database." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const { eligibility } = c.req.valid("json"),
      current = await loadOnboardingState(user.id);
    if (
      current?.creatorEligibilityLockedAt &&
      current.creatorEligibility !== eligibility
    ) {
      return c.json(
        { message: "Creator eligibility is already locked for this account." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const now = new Date(),
      intendedAccountType =
        eligibility === "major_label_affiliated" ? "fan" : "artist";
    await createDb()
      .insert(onboardingProgress)
      .values({
        creatorEligibility: eligibility,
        creatorEligibilityDeclaredAt: now,
        creatorEligibilityLockedAt:
          eligibility === "major_label_affiliated" ? now : null,
        intendedAccountType,
        lastActivityAt: now,
        startedAt: current?.startedAt ?? now,
        userId: user.id,
      })
      .onConflictDoUpdate({
        set: {
          creatorEligibility: eligibility,
          creatorEligibilityDeclaredAt:
            current?.creatorEligibilityDeclaredAt ?? now,
          creatorEligibilityLockedAt:
            eligibility === "major_label_affiliated"
              ? (current?.creatorEligibilityLockedAt ?? now)
              : current?.creatorEligibilityLockedAt,
          intendedAccountType,
          lastActivityAt: now,
        },
        target: onboardingProgress.userId,
      });
    const saved = await loadOnboardingState(user.id);
    return c.json(
      serializeOnboardingState(saved as typeof onboardingProgress.$inferSelect),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/exit",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        onboardingStateSchema,
        "Onboarding exited"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Onboarding persistence requires a configured database." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const now = new Date();
    await createDb()
      .update(onboardingProgress)
      .set({ exitedAt: now, lastActivityAt: now })
      .where(eq(onboardingProgress.userId, user.id));
    const saved = await loadOnboardingState(user.id);
    return c.json(
      serializeOnboardingState(saved as typeof onboardingProgress.$inferSelect),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/state",
    responses: {
      [HttpStatusCodes.NO_CONTENT]: {
        description: "Onboarding progress deleted",
      },
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.body(null, HttpStatusCodes.NO_CONTENT);
    }

    const db = createDb();
    await db
      .delete(onboardingEmailReminders)
      .where(eq(onboardingEmailReminders.userId, user.id));
    await db
      .delete(onboardingProgress)
      .where(eq(onboardingProgress.userId, user.id));

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }
);

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
    const { username } = c.req.valid("query"),
      user = c.get("user"),
      availability = await checkUsernameAvailability(
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
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Plan seat limit exceeded"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Artist eligibility is locked"
      ),
    },
    tags: ["Onboarding"],
  }),
  async (c) => {
    const user = c.get("user"),
      body = c.req.valid("json");

    if (!(isAuthenticatedUser(user) || !isDatabaseConfigured())) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (isAuthenticatedUser(user) && isDatabaseConfigured()) {
      const progress = await loadOnboardingState(user.id);
      if (progress?.creatorEligibility === "major_label_affiliated") {
        return c.json(
          { message: "This account is locked to Fan onboarding." },
          HttpStatusCodes.FORBIDDEN
        );
      }
      if (body.creatorEligibility === "major_label_affiliated") {
        return c.json(
          { message: "Major-label-controlled catalogs must continue as Fan." },
          HttpStatusCodes.FORBIDDEN
        );
      }
      if (
        !canCompleteArtistOnboarding({
          savedEligibility: progress?.creatorEligibility,
          submittedEligibility: body.creatorEligibility,
        })
      ) {
        return c.json(
          {
            message:
              "Declare independent creator eligibility before completing Artist onboarding.",
          },
          HttpStatusCodes.FORBIDDEN
        );
      }
      if (!body.rightsAttested) {
        return c.json(
          {
            message:
              "Confirm your upload and monetization rights before finishing.",
          },
          HttpStatusCodes.BAD_REQUEST
        );
      }
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
      const requestedSeats = 1;

      try {
        assertPlanSeatCount({
          planCode: body.selectedPlanCode,
          seats: requestedSeats,
        });
      } catch {
        const maxSeats = maxIncludedSeatsForPlan(body.selectedPlanCode);

        return c.json(
          {
            message: `${body.selectedPlanCode} supports up to ${maxSeats} seats. Remove invitees or choose a larger plan.`,
          },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      if (
        body.avatarObjectKey &&
        !body.avatarObjectKey.startsWith(`profiles/${user.id}/`)
      ) {
        return c.json(
          { message: "Profile media does not belong to this user." },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      if (body.avatarObjectKey) {
        await claimUploadIntent({
          entityId: user.id,
          entityType: "profile",
          objectKey: body.avatarObjectKey,
          userId: user.id,
        });
      }

      const db = createDb(),
        now = new Date(),
        genreId = await ensureGenre(body.primaryGenre),
        avatar =
          body.avatarObjectKey && body.avatarUrl
            ? {
                avatarObjectKey: body.avatarObjectKey,
                avatarUrl: body.avatarUrl,
              }
            : {},
        workspaceId = await ensureWorkspaceForUser({
          accountType: "artist",
          displayName: body.songwriterLegalName?.trim() || body.username,
          user,
        });

      await db
        .insert(userProfiles)
        .values({
          accountType: "artist",
          ...avatar,
          city: body.city,
          country: body.country,
          displayName: body.songwriterLegalName?.trim() || body.username,
          mediaLayout: body.mediaLayout,
          onboardingCompletedAt: now,
          state: body.state,
          updatedAt: now,
          userId: user.id,
          username: body.username,
        })
        .onConflictDoUpdate({
          set: {
            accountType: "artist",
            ...avatar,
            city: body.city,
            country: body.country,
            mediaLayout: body.mediaLayout,
            onboardingCompletedAt: now,
            state: body.state,
            updatedAt: now,
            username: body.username,
          },
          target: userProfiles.userId,
        });

      if (body.avatarObjectKey) {
        await completeUploadIntent({
          entityId: user.id,
          entityType: "profile",
          objectKey: body.avatarObjectKey,
          userId: user.id,
        });
      }

      await db
        .insert(artistProfiles)
        .values({
          primaryGenreId: genreId,
          primaryOrganizationId: workspaceId,
          proAffiliation: body.proAffiliation,
          proMemberId: body.proMemberId ?? null,
          songwriterLegalName: body.songwriterLegalName ?? null,
          stageName: body.songwriterLegalName?.trim() || body.username,
          updatedAt: now,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
            primaryGenreId: genreId,
            primaryOrganizationId: workspaceId,
            proAffiliation: body.proAffiliation,
            proMemberId: body.proMemberId ?? null,
            songwriterLegalName: body.songwriterLegalName ?? null,
            stageName: body.songwriterLegalName?.trim() || body.username,
            updatedAt: now,
          },
          target: artistProfiles.userId,
        });

      await indexSearchEntity({
        entityId: user.id,
        entityType: "artist",
        organizationId: workspaceId,
        text: [
          user.name,
          body.username,
          body.primaryGenre,
          body.city,
          body.state,
        ]
          .filter(Boolean)
          .join("\n"),
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

      const linkInputs = normalizeProfileLinks([
        { platform: "instagram", value: body.instagramHandle },
        { platform: "tiktok", value: body.tiktokHandle },
        { platform: "twitter", value: body.twitterHandle },
        { platform: "spotify", value: body.spotifyUrl },
        { platform: "apple_music", value: body.appleMusicUrl },
        { platform: "youtube", value: body.youtubeUrl },
      ]);

      await db.delete(profileLinks).where(eq(profileLinks.userId, user.id));

      const links = linkInputs.map((link, index) => ({
        handle: link.handle,
        id: crypto.randomUUID(),
        platform: link.platform,
        sortOrder: index,
        url: link.url,
        userId: user.id,
      }));

      if (links.length > 0) {
        await db.insert(profileLinks).values(links);
      }

      await db
        .insert(onboardingProgress)
        .values({
          completedAt: now,
          creatorEligibility: "independent",
          creatorEligibilityDeclaredAt: now,
          currentStep: 8,
          intendedAccountType: "artist",
          lastActivityAt: now,
          rightsAttestationVersion: body.rightsAttestationVersion ?? "2026-01",
          rightsAttestedAt: now,
          selectedPlanCode: body.selectedPlanCode,
          startedAt: now,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
            completedAt: now,
            currentStep: 8,
            intendedAccountType: "artist",
            lastActivityAt: now,
            rightsAttestationVersion:
              body.rightsAttestationVersion ?? "2026-01",
            rightsAttestedAt: now,
            selectedPlanCode: body.selectedPlanCode,
          },
          target: onboardingProgress.userId,
        });

      await sendTransactionalEmail({
        idempotencyKey: `welcome/onboarding/${user.id}`,
        payload: {
          actionUrl: `${getPublicSiteUrl()}/dashboard/tracks/new`,
          body: "Your artist profile is ready. Upload your first track, share your profile, and start building your direct fan community.",
          ctaLabel: "Upload your first track",
          eyebrow: "Artist welcome",
          heading: "Welcome to SoundKit, artist",
          previewText:
            "Your artist profile is ready. Start with your first track.",
          recipientName: body.songwriterLegalName ?? body.username,
          subject: "Your SoundKit artist profile is ready",
        },
        recipientEmail: user.email ?? "",
        template: "welcome",
      });

      await ensureFreeSubscription({
        planCode: body.selectedPlanCode,
        referenceId: workspaceId,
      });

      const checkout = await createPlanCheckout({
        ...onboardingUrls(c.req.raw, "artist"),
        planCode: body.selectedPlanCode,
        referenceId: workspaceId,
        request: c.req.raw,
        seats: requestedSeats,
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
    const user = c.get("user"),
      body = c.req.valid("json");

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
      const db = createDb(),
        now = new Date(),
        workspaceId = await ensureWorkspaceForUser({
          accountType: "fan",
          displayName: body.username,
          user,
        });

      await db
        .insert(userProfiles)
        .values({
          accountType: "fan",
          city: body.city,
          country: body.country,
          displayName: body.username,
          mediaLayout: body.mediaLayout,
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
            country: body.country,
            mediaLayout: body.mediaLayout,
            onboardingCompletedAt: now,
            state: body.state,
            updatedAt: now,
            username: body.username,
          },
          target: userProfiles.userId,
        });

      const referrerUsername = body.referrerUsername?.trim().toLowerCase();
      if (referrerUsername && referrerUsername !== body.username) {
        const [referrer] = await db
          .select({
            accountType: userProfiles.accountType,
            userId: userProfiles.userId,
          })
          .from(userProfiles)
          .where(eq(userProfiles.username, referrerUsername))
          .limit(1);

        if (referrer?.accountType === "artist") {
          const [createdFollow] = await db
            .insert(userFollows)
            .values({
              followerUserId: user.id,
              targetUserId: referrer.userId,
            })
            .onConflictDoNothing()
            .returning({ followerUserId: userFollows.followerUserId });

          if (createdFollow) {
            await notifyFollowCreated({
              actorAccountType: "fan",
              actorName: body.username,
              actorUserId: user.id,
              actorUsername: body.username,
              emailQueue: c.env.EMAIL_DELIVERY_QUEUE,
              recipientUserId: referrer.userId,
            });
          }
        }
      }

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
        [...new Set(genreIds)].map((genreId) => ({
          genreId,
          userId: user.id,
        }))
      );

      await db
        .insert(onboardingProgress)
        .values({
          completedAt: now,
          currentStep: 4,
          intendedAccountType: "fan",
          lastActivityAt: now,
          selectedPlanCode: body.selectedPlanCode,
          startedAt: now,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
            completedAt: now,
            currentStep: 4,
            intendedAccountType: "fan",
            lastActivityAt: now,
            selectedPlanCode: body.selectedPlanCode,
          },
          target: onboardingProgress.userId,
        });

      await sendTransactionalEmail({
        idempotencyKey: `welcome/onboarding/${user.id}`,
        payload: {
          actionUrl: `${getPublicSiteUrl()}/`,
          body: "Your SoundKit listener profile is ready. Discover music, follow artists, and build your library.",
          ctaLabel: "Explore SoundKit",
          eyebrow: "Fan welcome",
          heading: "Welcome to SoundKit",
          previewText:
            "Your listener profile is ready. Discover something new.",
          recipientName: body.username,
          subject: "Your SoundKit listener profile is ready",
        },
        recipientEmail: user.email ?? "",
        template: "welcome",
      });

      await ensureFreeSubscription({
        planCode: body.selectedPlanCode,
        referenceId: workspaceId,
      });

      const checkout = await createPlanCheckout({
        ...onboardingUrls(c.req.raw, "fan", body.returnPath),
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
