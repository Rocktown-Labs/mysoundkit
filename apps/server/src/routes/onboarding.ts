import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfileRoles,
  artistProfiles,
  fanProfiles,
  userProfiles,
} from "@soundkit/db/schema/app";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import {
  messageResponseSchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

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
        messageResponseSchema,
        "Artist onboarding saved"
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
    const body = c.req.valid("json");

    if (!(isAuthenticatedUser(user) || !isDatabaseConfigured())) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (isAuthenticatedUser(user) && isDatabaseConfigured()) {
      const db = createDb();
      const now = new Date();

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
          stageName: user.name ?? body.username,
          updatedAt: now,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
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
    }

    return c.json(
      { message: `Artist onboarding captured for ${body.username}` },
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
        messageResponseSchema,
        "Fan onboarding saved"
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
    const body = c.req.valid("json");

    if (!(isAuthenticatedUser(user) || !isDatabaseConfigured())) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (isAuthenticatedUser(user) && isDatabaseConfigured()) {
      const db = createDb();
      const now = new Date();

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
    }

    return c.json(
      { message: `Fan onboarding captured for ${body.username}` },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
