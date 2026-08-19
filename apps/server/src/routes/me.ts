import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createAuth } from "@soundkit/auth";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  notificationSettings,
  profileLinks,
  userProfiles,
  workspaceProfiles,
} from "@soundkit/db/schema/app";
import {
  invitation,
  member,
  organization,
  subscription,
  user as authUser,
} from "@soundkit/db/schema/auth";
import { planCatalog } from "@soundkit/db/schema/plans";
import { and, desc, eq, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { maxIncludedSeatsForPlan } from "@/lib/plan-seats";
import { normalizeProfileLinks } from "@/lib/profile-links";
import {
  createWorkspaceInvitationBodySchema,
  entitlementSummarySchema,
  meResponseSchema,
  messageResponseSchema,
  notificationSettingsSchema,
  profileUpdateBodySchema,
  updateNotificationSettingsBodySchema,
  workspaceDetailSchema,
  workspaceSummarySchema,
} from "@/lib/schemas";
import type {
  AppEnv,
  AuthenticatedSession,
  AuthenticatedUser,
} from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";
import {
  canManageWorkspace,
  hasWorkspaceCapacity,
} from "@/lib/workspace-domain";

const app = new OpenAPIHono<AppEnv>(),
  getDefaultUserSummary = (user: AuthenticatedUser) => ({
    accountType: "artist" as const,
    avatarUrl: null,
    bio: null,
    city: null,
    displayName: user.name ?? user.email ?? "SoundKit User",
    headerUrl: null,
    id: user.id,
    links: {},
    mediaLayout: "cards" as const,
    onboardingCompletedAt: null,
    proAffiliation: null,
    proMemberId: null,
    role: user.role ?? null,
    songwriterLegalName: null,
    stageName: user.name ?? null,
    state: null,
    username: user.email?.split("@")[0] ?? "soundkit-user",
  }),
  formatPlatformKey = (platform: string) => {
    if (platform === "apple_music") {
      return "appleMusic";
    }
    if (platform === "personal_site") {
      return "personalSite";
    }
    return platform;
  },
  getUserSummary = async (user: AuthenticatedUser) => {
    if (!isDatabaseConfigured()) {
      return getDefaultUserSummary(user);
    }

    const db = createDb(),
      [profile] = await db
        .select({
          accountType: userProfiles.accountType,
          avatarUrl: userProfiles.avatarUrl,
          bio: userProfiles.bio,
          city: userProfiles.city,
          displayName: userProfiles.displayName,
          headerUrl: userProfiles.headerUrl,
          mediaLayout: userProfiles.mediaLayout,
          onboardingCompletedAt: userProfiles.onboardingCompletedAt,
          proAffiliation: artistProfiles.proAffiliation,
          proMemberId: artistProfiles.proMemberId,
          songwriterLegalName: artistProfiles.songwriterLegalName,
          stageName: artistProfiles.stageName,
          state: userProfiles.state,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .leftJoin(
          artistProfiles,
          eq(artistProfiles.userId, userProfiles.userId)
        )
        .where(eq(userProfiles.userId, user.id))
        .limit(1);

    if (!profile) {
      return getDefaultUserSummary(user);
    }

    const links = await db
        .select({
          platform: profileLinks.platform,
          url: profileLinks.url,
        })
        .from(profileLinks)
        .where(eq(profileLinks.userId, user.id)),
      profileLinkMap = Object.fromEntries(
        links.map((link) => [formatPlatformKey(link.platform), link.url])
      );

    return {
      accountType: profile.accountType,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      city: profile.city,
      displayName: profile.displayName ?? user.name ?? profile.username,
      headerUrl: profile.headerUrl,
      id: user.id,
      links: profileLinkMap,
      mediaLayout:
        profile.mediaLayout === "list" ? ("list" as const) : ("cards" as const),
      onboardingCompletedAt:
        profile.onboardingCompletedAt?.toISOString() ?? null,
      proAffiliation: profile.proAffiliation,
      proMemberId: profile.proMemberId,
      role: user.role ?? null,
      songwriterLegalName: profile.songwriterLegalName,
      stageName:
        profile.stageName ??
        profile.displayName ??
        user.name ??
        profile.username,
      state: profile.state,
      username: profile.username,
    };
  },
  getActiveWorkspace = async ({
    activeOrganizationId,
    userId,
  }: {
    activeOrganizationId: string | null;
    userId: string;
  }) => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const db = createDb(),
      workspaceQuery = db
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
        .where(eq(member.userId, userId)),
      workspaces = await workspaceQuery,
      activeWorkspace =
        workspaces.find((workspace) => workspace.id === activeOrganizationId) ??
        workspaces[0];

    return activeWorkspace ?? null;
  },
  defaultNotificationSettings = {
    emailCollaborations: true,
    emailComments: true,
    emailFollowers: true,
    emailSales: true,
    emailTrackProcessing: true,
    pushMentions: true,
    pushMessages: true,
    pushReleases: true,
  },
  getNotificationSettings = async (userId: string) => {
    if (!isDatabaseConfigured()) {
      return defaultNotificationSettings;
    }

    const db = createDb(),
      [settings] = await db
        .select({
          emailCollaborations: notificationSettings.emailCollaborations,
          emailComments: notificationSettings.emailComments,
          emailFollowers: notificationSettings.emailFollowers,
          emailSales: notificationSettings.emailSales,
          emailTrackProcessing: notificationSettings.emailTrackProcessing,
          pushMentions: notificationSettings.pushMentions,
          pushMessages: notificationSettings.pushMessages,
          pushReleases: notificationSettings.pushReleases,
        })
        .from(notificationSettings)
        .where(eq(notificationSettings.userId, userId))
        .limit(1);

    return settings ?? defaultNotificationSettings;
  },
  loadWorkspaceDetail = async ({
    session,
    user,
  }: {
    session: AuthenticatedSession | null;
    user: AuthenticatedUser;
  }) => {
    if (!isDatabaseConfigured()) {
      return {
        activeWorkspace: null,
        invitations: [],
        members: [],
        seats: { total: 1, used: 0 },
      };
    }

    const organizationId = await resolveActiveOrganizationId({ session, user });
    if (!organizationId) {
      return {
        activeWorkspace: null,
        invitations: [],
        members: [],
        seats: { total: 1, used: 0 },
      };
    }

    const db = createDb(),
      [workspace, members, invitations, plan] = await Promise.all([
        db
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
          .where(
            and(
              eq(member.organizationId, organizationId),
              eq(member.userId, user.id)
            )
          )
          .limit(1),
        db
          .select({
            avatarUrl: userProfiles.avatarUrl,
            createdAt: member.createdAt,
            email: authUser.email,
            id: member.id,
            image: authUser.image,
            name: authUser.name,
            role: member.role,
            userId: member.userId,
            username: userProfiles.username,
          })
          .from(member)
          .innerJoin(authUser, eq(authUser.id, member.userId))
          .leftJoin(userProfiles, eq(userProfiles.userId, member.userId))
          .where(eq(member.organizationId, organizationId))
          .orderBy(desc(member.createdAt)),
        db
          .select({
            createdAt: invitation.createdAt,
            email: invitation.email,
            expiresAt: invitation.expiresAt,
            id: invitation.id,
            role: invitation.role,
            status: invitation.status,
          })
          .from(invitation)
          .where(
            and(
              eq(invitation.organizationId, organizationId),
              eq(invitation.status, "pending")
            )
          )
          .orderBy(desc(invitation.createdAt)),
        db
          .select({
            maxSeats: planCatalog.maxSeats,
            plan: subscription.plan,
            seats: subscription.seats,
          })
          .from(subscription)
          .leftJoin(planCatalog, eq(subscription.plan, planCatalog.code))
          .where(
            and(
              eq(subscription.referenceId, organizationId),
              or(
                eq(subscription.status, "active"),
                eq(subscription.status, "trialing")
              )
            )
          )
          .orderBy(desc(subscription.updatedAt))
          .limit(1),
      ]),
      activeWorkspace = workspace[0] ?? null,
      planCode = plan[0]?.plan ?? null,
      totalSeats = Math.max(
        1,
        planCode?.startsWith("soundkit_premium_")
          ? maxIncludedSeatsForPlan(planCode)
          : (plan[0]?.seats ??
              plan[0]?.maxSeats ??
              (planCode ? maxIncludedSeatsForPlan(planCode) : 1))
      );
    return {
      activeWorkspace,
      invitations: invitations.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        expiresAt: item.expiresAt.toISOString(),
      })),
      members: members.map((item) => ({
        avatarUrl: item.avatarUrl ?? item.image ?? null,
        createdAt: item.createdAt.toISOString(),
        email: item.email,
        id: item.id,
        isOwner: item.role === "owner",
        name: item.name,
        role: item.role,
        userId: item.userId,
        username: item.username,
      })),
      seats: { total: totalSeats, used: members.length },
    };
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

    const session = c.get("session"),
      activeOrganizationId = isAuthenticatedSession(session)
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

const workspaceSummaryArraySchema = workspaceSummarySchema.array();

app.openapi(
  createRoute({
    method: "get",
    path: "/workspaces",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        workspaceSummaryArraySchema,
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

    const db = createDb(),
      workspaces = await db
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
    method: "get",
    path: "/workspace",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        workspaceDetailSchema,
        "Workspace details"
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
    return c.json(
      await loadWorkspaceDetail({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/workspace/invitations",
    request: {
      body: jsonContentRequired(
        createWorkspaceInvitationBodySchema,
        "Workspace invitation"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        workspaceDetailSchema,
        "Workspace invitation created"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Workspace invitation rejected"
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
      return c.json(
        { message: "Workspace invitations require a configured database." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
    if (!organizationId) {
      return c.json(
        { message: "An active workspace is required." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const db = createDb(),
      [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, user.id)
          )
        )
        .limit(1);
    if (!membership || !canManageWorkspace(membership.role)) {
      return c.json(
        { message: "Only workspace managers can invite members." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const detail = await loadWorkspaceDetail({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    if (
      !hasWorkspaceCapacity({
        memberCount: detail.seats.used,
        pendingInvitationCount: detail.invitations.length,
        totalSeats: detail.seats.total,
      })
    ) {
      return c.json(
        { message: "There are no workspace seats available." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    try {
      await createAuth().api.createInvitation({
        body: { email: body.email, organizationId, role: body.role },
        headers: c.req.raw.headers,
      });
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Unable to create workspace invitation.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    return c.json(
      await loadWorkspaceDetail({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/workspace/invitations/{invitationId}",
    request: { params: z.object({ invitationId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        workspaceDetailSchema,
        "Invitation revoked"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Invitation not found"
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
    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
    if (!organizationId) {
      return c.json(
        { message: "An active workspace is required." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    try {
      await createAuth().api.cancelInvitation({
        body: { invitationId: c.req.valid("param").invitationId },
        headers: c.req.raw.headers,
      });
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Unable to revoke invitation.",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }
    return c.json(
      await loadWorkspaceDetail({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/workspace/members/{memberId}",
    request: { params: z.object({ memberId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        workspaceDetailSchema,
        "Member removed"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Member not found"
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
    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
    if (!organizationId) {
      return c.json(
        { message: "An active workspace is required." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    try {
      await createAuth().api.removeMember({
        body: {
          memberIdOrEmail: c.req.valid("param").memberId,
          organizationId,
        },
        headers: c.req.raw.headers,
      });
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Unable to remove workspace member.",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }
    return c.json(
      await loadWorkspaceDetail({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/workspace",
    request: {
      body: jsonContent(
        z.object({ name: z.string().trim().min(1).max(100) }),
        "Workspace name update"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        workspaceSummarySchema,
        "Updated workspace"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Me"],
  }),
  async (c) => {
    const user = c.get("user"),
      { name } = c.req.valid("json");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          id: "ws_default",
          name,
          role: "owner",
          slug: "my-workspace",
          workspaceType: "artist_team" as const,
        },
        HttpStatusCodes.OK
      );
    }

    const session = c.get("session"),
      activeOrgId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });

    if (!activeOrgId) {
      return c.json(
        { message: "An active workspace is required." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = createDb(),
      [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, activeOrgId),
            eq(member.userId, user.id)
          )
        )
        .limit(1);

    if (!membership || !canManageWorkspace(membership.role)) {
      return c.json(
        { message: "You do not have permission to rename this workspace." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    await db
      .update(organization)
      .set({ name })
      .where(eq(organization.id, activeOrgId));

    const [updatedWorkspace] = await db
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
      .where(
        and(eq(member.organizationId, activeOrgId), eq(member.userId, user.id))
      )
      .limit(1);

    if (!updatedWorkspace) {
      return c.json(
        { message: "Workspace not found." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    return c.json(updatedWorkspace, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/notification-settings",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        notificationSettingsSchema,
        "Notification settings"
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

    return c.json(await getNotificationSettings(user.id), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/notification-settings",
    request: {
      body: jsonContentRequired(
        updateNotificationSettingsBodySchema,
        "Notification settings update payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        notificationSettingsSchema,
        "Updated notification settings"
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
      return c.json(defaultNotificationSettings, HttpStatusCodes.OK);
    }

    const body = c.req.valid("json"),
      db = createDb();

    await db
      .insert(notificationSettings)
      .values({
        ...defaultNotificationSettings,
        ...body,
        userId: user.id,
      })
      .onConflictDoUpdate({
        set: {
          ...body,
          updatedAt: new Date(),
        },
        target: notificationSettings.userId,
      });

    return c.json(await getNotificationSettings(user.id), HttpStatusCodes.OK);
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

    const db = createDb(),
      {
        links,
        proAffiliation,
        proMemberId,
        songwriterLegalName,
        stageName,
        ...userProfileBody
      } = body;

    if (Object.keys(userProfileBody).length > 0) {
      await db
        .update(userProfiles)
        .set(userProfileBody)
        .where(eq(userProfiles.userId, user.id));
    }

    const artistProfileBody = {
      ...(proAffiliation === undefined ? {} : { proAffiliation }),
      ...(proMemberId === undefined ? {} : { proMemberId }),
      ...(songwriterLegalName === undefined ? {} : { songwriterLegalName }),
      ...(stageName === undefined ? {} : { stageName }),
    };

    if (Object.keys(artistProfileBody).length > 0) {
      await db
        .insert(artistProfiles)
        .values({
          ...artistProfileBody,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: artistProfileBody,
          target: artistProfiles.userId,
        });
    }

    if (links) {
      const normalizedLinks = normalizeProfileLinks([
        { platform: "spotify", value: links.spotify },
        { platform: "apple_music", value: links.appleMusic },
        { platform: "youtube", value: links.youtube },
        { platform: "instagram", value: links.instagram },
        { platform: "twitter", value: links.twitter },
        { platform: "tiktok", value: links.tiktok },
        { platform: "soundcloud", value: links.soundcloud },
        { platform: "personal_site", value: links.personalSite },
      ]);

      await db.delete(profileLinks).where(eq(profileLinks.userId, user.id));

      if (normalizedLinks.length > 0) {
        await db.insert(profileLinks).values(
          normalizedLinks.map((link, index) => ({
            handle: link.handle,
            id: crypto.randomUUID(),
            platform: link.platform,
            sortOrder: index,
            url: link.url,
            userId: user.id,
          }))
        );
      }
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

    const session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });

    return c.json(entitlements, HttpStatusCodes.OK);
  }
);

export default app;
