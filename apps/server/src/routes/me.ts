import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userProfiles } from "@soundkit/db/schema/app";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { sampleUser, sampleWorkspace } from "@/lib/sample-data";
import {
  entitlementSummarySchema,
  meResponseSchema,
  messageResponseSchema,
  profileUpdateBodySchema,
  workspaceSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        meResponseSchema,
        "Current user profile"
      ),
    },
    tags: ["Me"],
  }),
  (c) =>
    c.json(
      {
        activeWorkspace: sampleWorkspace,
        user: sampleUser,
      },
      HttpStatusCodes.OK
    )
);

app.openapi(
  createRoute({
    method: "get",
    path: "/workspaces",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        workspaceSummarySchema.array(),
        "Current user workspaces"
      ),
    },
    tags: ["Me"],
  }),
  (c) => c.json([sampleWorkspace], HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/profile",
    request: {
      body: jsonContentRequired(
        profileUpdateBodySchema,
        "Profile update payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Profile updated"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Me"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const body = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          message:
            "Profile update accepted, but the database is not configured in this environment yet.",
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const [updatedProfile] = await db
      .update(userProfiles)
      .set(body)
      .where(eq(userProfiles.userId, user.id))
      .returning({
        userId: userProfiles.userId,
      });

    if (!updatedProfile) {
      return c.json(
        {
          message:
            "No user profile exists yet for this account. Finish onboarding before saving profile media.",
        },
        HttpStatusCodes.OK
      );
    }

    return c.json({ message: "Profile updated." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/entitlements",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        entitlementSummarySchema,
        "Current user entitlements"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Me"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

    return c.json(entitlements, HttpStatusCodes.OK);
  }
);

export default app;
