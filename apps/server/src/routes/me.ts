import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userProfiles, workspaceProfiles } from "@soundkit/db/schema/app";
import { member, organization } from "@soundkit/db/schema/auth";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import {
  entitlementSummarySchema,
  meResponseSchema,
  messageResponseSchema,
  profileUpdateBodySchema,
  workspaceSummarySchema,
} from "@/lib/schemas";
import type { AppEnv, AuthenticatedUser } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const getUserSummary = async (user: AuthenticatedUser) => {
  if (!isDatabaseConfigured()) {
    return {
      accountType: "artist" as const,
      displayName: user.name ?? user.email ?? "SoundKit User",
      id: user.id,
      onboardingCompletedAt: null,
      username: user.email?.split("@")[0] ?? "soundkit-user",
    };
  }

  const db = createDb();
  const [profile] = await db
    .select({
      accountType: userProfiles.accountType,
      displayName: userProfiles.displayName,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
      username: userProfiles.username,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  if (!profile) {
    return {
      accountType: "artist" as const,
      displayName: user.name ?? user.email ?? "SoundKit User",
      id: user.id,
      onboardingCompletedAt: null,
      username: user.email?.split("@")[0] ?? "soundkit-user",
    };
  }

  return {
    accountType: profile.accountType,
    displayName: profile.displayName ?? user.name ?? profile.username,
    id: user.id,
    onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
    username: profile.username,
  };
};

const getActiveWorkspace = async ({
  activeOrganizationId,
  userId,
}: {
  activeOrganizationId: string | null;
  userId: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();
  const workspaceQuery = db
    .select({
      id: organization.id,
      name: organization.name,
      role: member.role,
      slug: organization.slug,
      workspaceType: workspaceProfiles.workspaceType,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .innerJoin(
      workspaceProfiles,
      eq(workspaceProfiles.organizationId, organization.id)
    )
    .where(eq(member.userId, userId));

  const workspaces = await workspaceQuery;
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeOrganizationId) ??
    workspaces[0];

  return activeWorkspace ?? null;
};

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        meResponseSchema,
        "Current user profile"
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
    const activeOrganizationId = isAuthenticatedSession(session)
      ? (session.activeOrganizationId ?? null)
      : null;

    return c.json(
      {
        activeWorkspace: await getActiveWorkspace({
          activeOrganizationId,
          userId: user.id,
        }),
        user: await getUserSummary(user),
      },
      HttpStatusCodes.OK
    );
  }
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

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const db = createDb();
    const workspaces = await db
      .select({
        id: organization.id,
        name: organization.name,
        role: member.role,
        slug: organization.slug,
        workspaceType: workspaceProfiles.workspaceType,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .innerJoin(
        workspaceProfiles,
        eq(workspaceProfiles.organizationId, organization.id)
      )
      .where(eq(member.userId, user.id));

    return c.json(workspaces, HttpStatusCodes.OK);
  }
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
