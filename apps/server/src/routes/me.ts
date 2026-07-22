import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  userProfiles,
  workspaceProfiles,
} from "@soundkit/db/schema/app";
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
      avatarUrl: null,
      bio: null,
      city: null,
      displayName: user.name ?? user.email ?? "SoundKit User",
      headerUrl: null,
      id: user.id,
      onboardingCompletedAt: null,
      role: user.role ?? null,
      stageName: user.name ?? null,
      state: null,
      username: user.email?.split("@")[0] ?? "soundkit-user",
    };
  }

  const db = createDb();
  const [profile] = await db
    .select({
      accountType: userProfiles.accountType,
      avatarUrl: userProfiles.avatarUrl,
      bio: userProfiles.bio,
      city: userProfiles.city,
      displayName: userProfiles.displayName,
      headerUrl: userProfiles.headerUrl,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
      stageName: artistProfiles.stageName,
      state: userProfiles.state,
      username: userProfiles.username,
    })
    .from(userProfiles)
    .leftJoin(artistProfiles, eq(artistProfiles.userId, userProfiles.userId))
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  if (!profile) {
    return {
      accountType: "artist" as const,
      avatarUrl: null,
      bio: null,
      city: null,
      displayName: user.name ?? user.email ?? "SoundKit User",
      headerUrl: null,
      id: user.id,
      onboardingCompletedAt: null,
      role: user.role ?? null,
      state: null,
      username: user.email?.split("@")[0] ?? "soundkit-user",
    };
  }

  return {
    accountType: profile.accountType,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    city: profile.city,
    displayName: profile.displayName ?? user.name ?? profile.username,
    headerUrl: profile.headerUrl,
    id: user.id,
    onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
    role: user.role ?? null,
    stageName: profile.stageName ?? profile.displayName ?? user.name ?? profile.username,
    state: profile.state,
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
    const { stageName, ...userProfileBody } = body;

    if (Object.keys(userProfileBody).length > 0) {
      await db
        .update(userProfiles)
        .set(userProfileBody)
        .where(eq(userProfiles.userId, user.id));
    }

    if (stageName !== undefined) {
      await db
        .insert(artistProfiles)
        .values({
          stageName,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: { stageName },
          target: artistProfiles.userId,
        });
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
