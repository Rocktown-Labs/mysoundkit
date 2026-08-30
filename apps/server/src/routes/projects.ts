/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  listeningParties,
  projectAssets,
  projectCollaborators,
  projectPreSaves,
  projectTracks,
  projects,
  purchases,
  trackCollaborators,
  mediaProcessingJobs,
  trackAssets,
  tracks,
  userFollows,
  userProfiles,
} from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { indexSearchEntity } from "@/lib/audio-processing";
import {
  buildProjectDetail,
  buildProjectSummary,
  ownedProjectWhere,
} from "@/lib/dashboard-mappers";
import { getDatabaseSchemaCapabilities } from "@/lib/database-schema-capabilities";
import { notifyCollaboratorInviteEmail } from "@/lib/email-events";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { ensureGenreId } from "@/lib/genre-persistence";
import {
  MEDIA_PIPELINE_VERSION,
  PROJECT_EXPORT_PIPELINE_VERSION,
} from "@/lib/media-pipeline";
import {
  ensureMediaProcessingWorkflow,
  ensureProjectExportWorkflow,
} from "@/lib/media-processing-jobs";
import { notify } from "@/lib/notifications";
import {
  genreSlugFromExploreFilter,
  profileRegionCondition,
  resolveExploreRegion,
} from "@/lib/public-explore";
import {
  getProjectReleaseReadiness,
  publishProjectIfMediaReady,
} from "@/lib/release-notifications";
import { sampleProjects } from "@/lib/sample-data";
import {
  createProjectBodySchema,
  messageResponseSchema,
  projectWorkspaceAssetBodySchema,
  projectLibraryAssetBodySchema,
  projectDashboardDetailSchema,
  projectSummarySchema,
  publicExploreQuerySchema,
  updateProjectBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { claimUploadIntent, completeUploadIntent } from "@/lib/upload-intents";
import { resolveActiveOrganizationId, uniqueSlug } from "@/lib/workspace";
import { logError } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>();

app.post("/:projectId/pre-save", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json({ message: "Authentication is required." }, 401);
  }
  const projectId = c.req.param("projectId");
  if (isDatabaseConfigured()) {
    await createDb()
      .insert(projectPreSaves)
      .values({
        projectId,
        userId: user.id,
      })
      .onConflictDoNothing();
  }
  return c.json({ isPreSaved: true, projectId }, 200);
});

const publicProjectExploreQuerySchema = publicExploreQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  type: z.enum(["album", "ep", "mixtape", "single"]).optional(),
});

type ProjectSummary = z.infer<typeof projectSummarySchema>;
type PublicProjectExploreQuery = z.infer<
  typeof publicProjectExploreQuerySchema
>;

const projectOrderBy = (sort?: string) => {
    if (sort === "title-asc") {
      return asc(projects.title);
    }

    if (sort === "title-desc") {
      return desc(projects.title);
    }

    if (sort === "date-asc") {
      return asc(projects.updatedAt);
    }

    return desc(projects.updatedAt);
  },
  projectMatchesRegion = (
    project: ProjectSummary,
    region: ReturnType<typeof resolveExploreRegion>,
    regionSlug: string | null
  ) => {
    if (region.kind === "global") {
      return true;
    }

    if (region.kind === "unknown") {
      return false;
    }

    if (region.kind === "state") {
      return project.regionSlug === regionSlug;
    }

    if (region.kind === "country") {
      return (
        region.name === "United States" &&
        project.regionSlug?.startsWith("us-") === true
      );
    }

    return (
      region.scope === "north-america" &&
      project.regionSlug?.startsWith("us-") === true
    );
  },
  projectMatchesExploreFilters = (
    project: ProjectSummary,
    query: PublicProjectExploreQuery,
    regionAlreadyFiltered = false
  ) => {
    const genreSlug = genreSlugFromExploreFilter(query.genre),
      region = resolveExploreRegion(query),
      regionSlug =
        region.kind === "state"
          ? `us-${region.abbreviation.toLowerCase()}`
          : null,
      q = query.q?.toLowerCase();

    if (
      genreSlug &&
      genreSlugFromExploreFilter(project.genre ?? "") !== genreSlug
    ) {
      return false;
    }

    if (
      !regionAlreadyFiltered &&
      !projectMatchesRegion(project, region, regionSlug)
    ) {
      return false;
    }

    if (q) {
      return [
        project.title,
        project.description ?? "",
        project.genre ?? "",
        project.projectType,
      ].some((value) => value.toLowerCase().includes(q));
    }

    return true;
  },
  getUploadBucketName = () =>
    (env as unknown as { UPLOAD_BUCKET_NAME?: string }).UPLOAD_BUCKET_NAME ??
    null;

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        projectSummarySchema.array(),
        "Projects list"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isDatabaseConfigured()) {
      return c.json(sampleProjects, HttpStatusCodes.OK);
    }

    const db = createDb(),
      organizationId = isAuthenticatedUser(user)
        ? await resolveActiveOrganizationId({
            session: isAuthenticatedSession(c.get("session"))
              ? c.get("session")
              : null,
            user,
          })
        : null;
    let projectVisibilityWhere = eq(projects.isPublic, true);

    if (isAuthenticatedUser(user)) {
      const collaboratorRows = await db
          .select({ projectId: projectCollaborators.projectId })
          .from(projectCollaborators)
          .where(
            and(
              eq(projectCollaborators.collaboratorUserId, user.id),
              eq(projectCollaborators.invitationStatus, "accepted")
            )
          ),
        collaboratorProjectIds = collaboratorRows
          .map((r) => r.projectId)
          .filter(Boolean),
        ownerCondition = organizationId
          ? (or(
              eq(projects.ownerUserId, user.id),
              eq(projects.organizationId, organizationId)
            ) ?? eq(projects.ownerUserId, user.id))
          : eq(projects.ownerUserId, user.id);

      projectVisibilityWhere =
        collaboratorProjectIds.length > 0
          ? (or(ownerCondition, inArray(projects.id, collaboratorProjectIds)) ??
            ownerCondition)
          : ownerCondition;
    }

    const rows = await db
        .select()
        .from(projects)
        .where(projectVisibilityWhere)
        .orderBy(desc(projects.updatedAt))
        .limit(100),
      summaries = [];

    for (const row of rows) {
      summaries.push(await buildProjectSummary(row));
    }

    return c.json(summaries, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/public",
    request: {
      query: publicProjectExploreQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        projectSummarySchema.array(),
        "Public projects list"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const query = c.req.valid("query");

    if (!isDatabaseConfigured()) {
      return c.json(
        sampleProjects
          .filter((project) => project.isPublic)
          .filter((project) => {
            if (query.type && project.projectType !== query.type) {
              return false;
            }

            if (query.forSale && !project.isForSale) {
              return false;
            }

            return projectMatchesExploreFilters(project, query);
          })
          .slice(0, query.limit),
        HttpStatusCodes.OK
      );
    }

    const regionCondition = profileRegionCondition(query),
      publicProjectConditions = [eq(projects.isPublic, true)];

    if (query.type) {
      publicProjectConditions.push(eq(projects.projectType, query.type));
    }

    if (query.forSale) {
      publicProjectConditions.push(eq(projects.isForSale, true));
    }

    if (query.q) {
      publicProjectConditions.push(
        sql`lower(${projects.title}) like ${`%${query.q.toLowerCase()}%`}`
      );
    }

    if (regionCondition) {
      publicProjectConditions.push(regionCondition);
    }

    const rows = await createDb()
        .select({ project: projects })
        .from(projects)
        .leftJoin(userProfiles, eq(userProfiles.userId, projects.ownerUserId))
        .where(and(...publicProjectConditions))
        .orderBy(projectOrderBy(query.sort))
        .limit(100),
      summaries = [];

    for (const { project } of rows) {
      const summary = await buildProjectSummary(project);

      if (projectMatchesExploreFilters(summary, query, true)) {
        summaries.push(summary);
      }
    }

    return c.json(summaries.slice(0, query.limit), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/public/{projectId}",
    request: {
      params: z.object({
        projectId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        projectDashboardDetailSchema,
        "Public project detail"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const { projectId: projectLookup } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      const project = sampleProjects.find(
        (entry) =>
          (entry.id === projectLookup || entry.slug === projectLookup) &&
          entry.isPublic
      );

      if (!project) {
        return c.json(
          { message: "Project not found." },
          HttpStatusCodes.NOT_FOUND
        );
      }

      return c.json(
        {
          ...project,
          assets: [],
          collaborators: [],
          tracks: [],
        },
        HttpStatusCodes.OK
      );
    }

    const [project] = await createDb()
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.isPublic, true),
          or(eq(projects.id, projectLookup), eq(projects.slug, projectLookup))
        )
      )
      .limit(1);

    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(await buildProjectDetail(project), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(
        createProjectBodySchema,
        "Project create payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        projectSummarySchema,
        "Project created"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid project media"
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        messageResponseSchema,
        "Internal server error"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
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
          collaboratorCount:
            body.collaborators.length || body.collaboratorNames.length,
          coverArtUrl: null,
          description: body.description ?? null,
          exclusiveUntil: body.exclusiveUntil ?? null,
          exportVersion: 1,
          id: "project_new",
          isForSale: body.isForSale,
          isPublic: body.isPublic,
          listeningAccess: body.listeningAccess,
          progress: 25,
          projectType: body.projectType,
          releaseDate: body.releaseDate ?? null,
          slug: body.title.toLowerCase().replaceAll(" ", "-"),
          status: "draft" as const,
          streamingLinks: body.streamingLinks ?? {},
          title: body.title,
          trackCount: body.trackIds.length + body.newTracks.length,
        },
        HttpStatusCodes.CREATED
      );
    }

    const hasInvalidTrackObject = body.newTracks.some(
        (track) =>
          track.assetId && !track.assetId.startsWith(`tracks/${user.id}/`)
      ),
      hasInvalidProjectObject = body.assetIds.some(
        (objectKey) =>
          !objectKey.startsWith(`projects/${user.id}/`) &&
          !objectKey.startsWith(`uploads/${user.id}/`)
      );
    if (hasInvalidTrackObject || hasInvalidProjectObject) {
      return c.json(
        { message: "An uploaded object does not belong to this user." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    try {
      const session = c.get("session"),
        organizationId = await resolveActiveOrganizationId({
          session: isAuthenticatedSession(session) ? session : null,
          user,
        }),
        db = createDb(),
        projectId = crypto.randomUUID(),
        now = new Date(),
        hasNewTracks = body.newTracks.length > 0,
        projectGenreId = body.genre
          ? await ensureGenreId(body.genre)
          : body.newTracks[0]?.genre
            ? await ensureGenreId(body.newTracks[0].genre)
            : null;
      const projectStatus =
          body.status ??
          (body.releaseDate
            ? "scheduled"
            : body.isPublic
              ? "released"
              : "draft"),
        [project] = await db
          .insert(projects)
          .values({
            createdAt: now,
            description: body.description ?? null,
            exclusiveUntil: body.exclusiveUntil
              ? new Date(body.exclusiveUntil)
              : null,
            genreId: projectGenreId,
            id: projectId,
            isForSale: body.isForSale,
            isPublic: false,
            listeningAccess: body.listeningAccess,
            organizationId,
            ownerUserId: user.id,
            priceCents: body.isForSale ? (body.priceCents ?? null) : null,
            projectType: body.projectType,
            releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
            slug: uniqueSlug(body.title),
            status: projectStatus,
            title: body.title,
            updatedAt: now,
          })
          .returning();

      await indexSearchEntity({
        entityId: projectId,
        entityType: "project",
        organizationId,
        text: [body.title, body.description, body.genre]
          .filter(Boolean)
          .join("\n"),
      });

      const existingTrackIds = body.trackIds,
        newTrackIds: string[] = [];

      for (const newTrack of body.newTracks) {
        const trackId = crypto.randomUUID(),
          genreId = await ensureGenreId(newTrack.genre);
        await db.insert(tracks).values({
          catalogItemType: "single",
          downloadsAllowed: newTrack.downloadsAllowed,
          downloadsRequireFirstPlay: newTrack.downloadsRequireFirstPlay,
          downloadsRequirePurchase: newTrack.downloadsRequirePurchase,
          exclusiveUntil: body.exclusiveUntil
            ? new Date(body.exclusiveUntil)
            : null,
          genreId,
          id: trackId,
          isForSale: body.isForSale,
          isPublic: false,
          isrc: newTrack.isrc ?? null,
          listeningAccess: body.listeningAccess,
          organizationId,
          ownerUserId: user.id,
          productionStatus: "demo",
          releaseStrategy: "private",
          slug: uniqueSlug(newTrack.title),
          streamingLinks: newTrack.streamingLinks,
          title: newTrack.title,
        });

        if (newTrack.assetId) {
          await claimUploadIntent({
            entityId: trackId,
            entityType: "track_asset",
            objectKey: newTrack.assetId,
            userId: user.id,
          });
          await db.insert(trackAssets).values({
            assetKind: "master",
            bucketName: getUploadBucketName(),
            durationMs: newTrack.durationMs ?? null,
            id: crypto.randomUUID(),
            metadata: {
              durationMs: newTrack.durationMs ?? null,
              originalFileName: newTrack.fileName ?? newTrack.title,
            },
            mimeType: newTrack.mimeType ?? null,
            objectKey: newTrack.assetId,
            sizeBytes: newTrack.sizeBytes ?? null,
            status: "uploaded",
            storageProvider: "r2",
            trackId,
            uploaderUserId: user.id,
          });
          await completeUploadIntent({
            entityId: trackId,
            entityType: "track_asset",
            objectKey: newTrack.assetId,
            userId: user.id,
          });
        }

        newTrackIds.push(trackId);
      }

      const projectTrackRows = [...existingTrackIds, ...newTrackIds].map(
        (trackId, index) => ({
          position: index,
          projectId,
          trackId,
        })
      );

      if (projectTrackRows.length > 0) {
        await db.insert(projectTracks).values(projectTrackRows);
      }

      if (body.assetIds.length > 0) {
        for (const objectKey of body.assetIds) {
          await claimUploadIntent({
            entityId: projectId,
            entityType: "project_asset",
            objectKey,
            userId: user.id,
          });
        }
        await db.insert(projectAssets).values(
          body.assetIds.map((objectKey) => ({
            assetKind: "cover_art" as const,
            bucketName: getUploadBucketName(),
            id: crypto.randomUUID(),
            mimeType: "image/*",
            objectKey,
            projectId,
            sizeBytes: null,
            status: "uploaded" as const,
            storageProvider: "r2" as const,
            uploaderUserId: user.id,
          }))
        );
        for (const objectKey of body.assetIds) {
          await completeUploadIntent({
            entityId: projectId,
            entityType: "project_asset",
            objectKey,
            userId: user.id,
          });
        }
      }

      if (body.collaborators.length > 0) {
        const collaboratorRows = body.collaborators.map((collaborator) => ({
          canDelete: false,
          canEdit: true,
          canUpload: true,
          collaboratorRole: collaborator.role,
          collaboratorUserId: collaborator.userId ?? null,
          createdAt: now,
          id: crypto.randomUUID(),
          invitationStatus: collaborator.userId
            ? ("accepted" as const)
            : ("pending" as const),
          inviteEmail: collaborator.inviteEmail ?? null,
          invitedByUserId: user.id,
          projectId,
        }));

        await db.insert(projectCollaborators).values(collaboratorRows);

        for (const collaborator of collaboratorRows) {
          if (collaborator.collaboratorUserId) {
            await notify(
              {
                actorUserId: user.id,
                data: {
                  actionPath: `/dashboard/projects/${projectId}`,
                  actorName: user.name ?? "Someone",
                  workTitle: body.title,
                  workType: "project",
                },
                entity: { id: projectId, type: "project" },
                eventId: collaborator.id,
                recipientUserId: collaborator.collaboratorUserId,
                type: "collaboration.invited",
              },
              { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
            );
          } else if (
            collaborator.inviteEmail &&
            collaborator.inviteEmail.toLowerCase() !==
              (user.email ?? "").toLowerCase()
          ) {
            await notifyCollaboratorInviteEmail({
              actionPath: `/dashboard/projects/${projectId}`,
              inviteEmail: collaborator.inviteEmail,
              inviteId: collaborator.id,
              inviterName: user.name ?? "Someone",
              queue: c.env.EMAIL_DELIVERY_QUEUE,
              workTitle: body.title,
              workType: "project",
            });
          }
        }
      }

      const projectCreditRows = body.collaborators
        .filter(
          (collaborator) =>
            collaborator.userId && collaborator.userId !== user.id
        )
        .flatMap((collaborator) =>
          newTrackIds.flatMap((trackId) => {
            const baseRow = {
              canDelete: false,
              canEdit: true,
              canUpload: true,
              collaboratorRole: collaborator.role,
              collaboratorUserId: collaborator.userId,
              id: crypto.randomUUID(),
              invitationStatus: "accepted" as const,
              invitedByUserId: user.id,
              trackId,
            };

            if (
              collaborator.alsoCreditAsWriter &&
              collaborator.role !== "songwriter"
            ) {
              return [
                baseRow,
                {
                  ...baseRow,
                  collaboratorRole: "songwriter" as const,
                  id: crypto.randomUUID(),
                },
              ];
            }

            return [baseRow];
          })
        );
      if (projectCreditRows.length > 0) {
        await db.insert(trackCollaborators).values(projectCreditRows);
      }

      if (!project) {
        throw new Error("Failed to create project.");
      }

      if (
        projectStatus === "scheduled" &&
        project.projectType !== "single" &&
        project.releaseDate &&
        project.releaseDate.getTime() > Date.now()
      ) {
        const entitlements = await resolveEntitlements({
          session: isAuthenticatedSession(session) ? session : null,
          user,
        });
        if (entitlements.isPremium) {
          const [releaseParty] = await db
            .insert(listeningParties)
            .values({
              description: `Join ${user.name ?? "the artist"} for the first listen.`,
              genreId: projectGenreId,
              hostUserId: user.id,
              id: crypto.randomUUID(),
              liveRoomId: crypto.randomUUID(),
              organizationId,
              playbackMode: "programmed_release",
              projectId,
              scheduledStartAt: project.releaseDate,
              title: `${project.title} Release Party`,
            })
            .returning();
          if (releaseParty) {
            const [artistFollowers, profileFollowers] = await Promise.all([
                db
                  .select({ userId: artistFollows.followerUserId })
                  .from(artistFollows)
                  .where(eq(artistFollows.artistUserId, user.id)),
                db
                  .select({ userId: userFollows.followerUserId })
                  .from(userFollows)
                  .where(eq(userFollows.targetUserId, user.id)),
              ]),
              followerIds = [
                ...new Set([
                  ...artistFollowers.map((entry) => entry.userId),
                  ...profileFollowers.map((entry) => entry.userId),
                ]),
              ];
            for (const followerId of followerIds) {
              const experienceId = releaseParty.liveRoomId ?? releaseParty.id;
              await notify(
                {
                  actorUserId: user.id,
                  data: {
                    artistName: user.name ?? "An artist you follow",
                    experienceId,
                    experienceTitle: releaseParty.title,
                    href: `/live/parties/${experienceId}`,
                    kind: "party",
                  },
                  entity: { id: releaseParty.id, type: "listening_party" },
                  eventId: releaseParty.id,
                  recipientUserId: followerId,
                  type: "live.scheduled",
                },
                { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
              );
            }
          }
        }
      }

      if (body.isPublic && !hasNewTracks) {
        await publishProjectIfMediaReady({ projectId: project.id });
      }
      const [currentProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id))
        .limit(1);
      return c.json(
        await buildProjectSummary(currentProject ?? project),
        HttpStatusCodes.CREATED
      );
    } catch (error: unknown) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        message: "POST /v1/projects error",
        userId: user.id,
      });
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Failed to create project record.",
        },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{projectId}",
    request: {
      body: jsonContentRequired(
        updateProjectBodySchema,
        "Project update payload"
      ),
      params: z.object({
        projectId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        projectDashboardDetailSchema,
        "Project updated"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid project media"
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Project is not ready to release"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { projectId } = c.req.valid("param"),
      body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [existingProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    if (!existingProject) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [collaborator] = await db
        .select({ canEdit: projectCollaborators.canEdit })
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.collaboratorUserId, user.id),
            eq(projectCollaborators.invitationStatus, "accepted")
          )
        )
        .limit(1),
      isCollaborator = collaborator?.canEdit === true,
      isOwner =
        existingProject.ownerUserId === user.id ||
        (organizationId && existingProject.organizationId === organizationId);

    if (!isOwner && !isCollaborator) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const releaseRequested =
      body.isPublic === true ||
      body.status === "released" ||
      body.status === "scheduled";
    if (releaseRequested && !existingProject.isPublic) {
      const readiness = await getProjectReleaseReadiness({ projectId });
      if (!readiness.isReady) {
        return c.json(
          {
            message: `Project is not ready to release: ${readiness.missing.join(" ")}`,
          },
          HttpStatusCodes.CONFLICT
        );
      }
    }

    const genreId = body.genre
        ? await ensureGenreId(body.genre)
        : existingProject.genreId,
      releaseDatePatch =
        "releaseDate" in body
          ? {
              releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
            }
          : {},
      statusPatch = body.status ? { status: body.status } : {};
    let exclusiveUntil: Date | null | undefined;
    if (body.exclusiveUntil === "") {
      exclusiveUntil = null;
    } else if (body.exclusiveUntil) {
      exclusiveUntil = new Date(body.exclusiveUntil);
    }
    const monetizationPatch = {
        ...(body.exclusiveUntil === undefined ? {} : { exclusiveUntil }),
        ...(body.isForSale === undefined ? {} : { isForSale: body.isForSale }),
        ...(body.listeningAccess === undefined
          ? {}
          : { listeningAccess: body.listeningAccess }),
        ...(body.isForSale === false
          ? { priceCents: null }
          : body.priceCents !== undefined
            ? { priceCents: body.priceCents }
            : {}),
      },
      [project] = await db
        .update(projects)
        .set({
          description: body.description,
          exportVersion: sql`${projects.exportVersion} + 1`,
          genreId,
          isPublic: body.isPublic === false ? false : existingProject.isPublic,
          projectType: body.projectType,
          ...monetizationPatch,
          ...releaseDatePatch,
          ...statusPatch,
          title: body.title,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .returning();

    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const coverObjectKey = body.assetIds?.[0] ?? null;

    if (coverObjectKey) {
      const allowedProjectPrefixes = [
        `projects/${user.id}/`,
        `uploads/${user.id}/`,
      ];
      if (
        !allowedProjectPrefixes.some((prefix) =>
          coverObjectKey.startsWith(prefix)
        )
      ) {
        return c.json(
          { message: "Cover artwork does not belong to this user." },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      await claimUploadIntent({
        entityId: project.id,
        entityType: "project_asset",
        objectKey: coverObjectKey,
        userId: user.id,
      });
      await db
        .delete(projectAssets)
        .where(
          and(
            eq(projectAssets.projectId, project.id),
            eq(projectAssets.assetKind, "cover_art")
          )
        );
      await db.insert(projectAssets).values({
        assetKind: "cover_art",
        bucketName: getUploadBucketName(),
        id: crypto.randomUUID(),
        mimeType: "image/*",
        objectKey: coverObjectKey,
        projectId: project.id,
        sizeBytes: null,
        status: "uploaded",
        storageProvider: "r2",
        uploaderUserId: user.id,
      });
      await completeUploadIntent({
        entityId: project.id,
        entityType: "project_asset",
        objectKey: coverObjectKey,
        userId: user.id,
      });
    }

    if (body.isPublic) {
      await publishProjectIfMediaReady({ projectId: project.id });
    }

    const [currentProject] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, project.id))
      .limit(1);
    return c.json(
      await buildProjectDetail(currentProject ?? project),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{projectId}/tracks/order",
    request: {
      body: jsonContentRequired(
        z.object({ trackIds: z.array(z.string()).min(1) }),
        "Ordered project track IDs"
      ),
      params: z.object({ projectId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        projectDashboardDetailSchema,
        "Project tracks reordered"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Track order does not match the project"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { projectId } = c.req.valid("param"),
      { trackIds } = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [collaborator] = await db
        .select({ canEdit: projectCollaborators.canEdit })
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.collaboratorUserId, user.id),
            eq(projectCollaborators.invitationStatus, "accepted")
          )
        )
        .limit(1),
      isCollaborator = collaborator?.canEdit === true,
      isOwner =
        project.ownerUserId === user.id ||
        (organizationId && project.organizationId === organizationId);

    if (!isOwner && !isCollaborator) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const attachedTracks = await db
        .select({ trackId: projectTracks.trackId })
        .from(projectTracks)
        .where(eq(projectTracks.projectId, projectId)),
      attachedIds = new Set(attachedTracks.map((entry) => entry.trackId)),
      requestedIds = new Set(trackIds),
      matchesProject =
        trackIds.length === attachedIds.size &&
        attachedIds.size === requestedIds.size &&
        trackIds.every((trackId) => attachedIds.has(trackId));

    if (!matchesProject) {
      return c.json(
        { message: "Track order must include every project track once." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    for (const [position, trackId] of trackIds.entries()) {
      await db
        .update(projectTracks)
        .set({ position })
        .where(
          and(
            eq(projectTracks.projectId, projectId),
            eq(projectTracks.trackId, trackId)
          )
        );
    }

    const [updatedProject] = await db
      .update(projects)
      .set({
        exportVersion: sql`${projects.exportVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return c.json(
      await buildProjectDetail(updatedProject ?? project),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{projectId}/assets",
    request: {
      body: jsonContentRequired(
        projectWorkspaceAssetBodySchema,
        "Project workspace asset"
      ),
      params: z.object({ projectId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        projectDashboardDetailSchema,
        "Project asset registered"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid project asset"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { projectId } = c.req.valid("param"),
      body = c.req.valid("json"),
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [collaborator] = await db
        .select({ canUpload: projectCollaborators.canUpload })
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.collaboratorUserId, user.id),
            eq(projectCollaborators.invitationStatus, "accepted")
          )
        )
        .limit(1),
      isOwner = project.ownerUserId === user.id,
      canUpload = isOwner || collaborator?.canUpload === true;

    if (!canUpload) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (
      !body.objectKey.startsWith(`projects/${user.id}/`) &&
      !body.objectKey.startsWith(`uploads/${user.id}/`)
    ) {
      return c.json(
        { message: "Uploaded project asset does not belong to this user." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const object = await c.env.MEDIA_BUCKET?.head(body.objectKey);
    if (c.env.MEDIA_BUCKET && !object) {
      return c.json(
        { message: "Uploaded project asset was not found in storage." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const capabilities = await getDatabaseSchemaCapabilities(db),
      storedAssetKind =
        body.assetKind === "beat" && !capabilities.projectAssetKinds.beat
          ? "attachment"
          : body.assetKind === "concept" &&
              !capabilities.projectAssetKinds.concept
            ? "attachment"
            : body.assetKind,
      now = new Date(),
      assetId = crypto.randomUUID();
    let version = 1;

    if (capabilities.projectAssetVersioning) {
      const [latestAsset] = await db
        .select({ version: projectAssets.version })
        .from(projectAssets)
        .where(
          and(
            eq(projectAssets.projectId, projectId),
            eq(projectAssets.assetKind, storedAssetKind)
          )
        )
        .orderBy(desc(projectAssets.version))
        .limit(1);
      version = (latestAsset?.version ?? 0) + 1;
      await db
        .update(projectAssets)
        .set({ isCurrent: false, updatedAt: now })
        .where(
          and(
            eq(projectAssets.projectId, projectId),
            eq(projectAssets.assetKind, storedAssetKind),
            eq(projectAssets.isCurrent, true)
          )
        );
    }

    await claimUploadIntent({
      entityId: projectId,
      entityType: "project_asset",
      objectKey: body.objectKey,
      userId: user.id,
    });
    await db.insert(projectAssets).values({
      assetKind: storedAssetKind,
      bucketName: getUploadBucketName(),
      id: assetId,
      metadata:
        storedAssetKind === body.assetKind
          ? { displayName: body.displayName }
          : {
              displayName: body.displayName,
              requestedAssetKind: body.assetKind,
            },
      mimeType: body.mimeType ?? object?.httpMetadata?.contentType ?? null,
      objectKey: body.objectKey,
      projectId,
      sizeBytes: body.sizeBytes ?? object?.size ?? null,
      status: "uploaded",
      storageProvider: "r2",
      uploaderUserId: user.id,
      ...(capabilities.projectAssetVersioning
        ? { isCurrent: true, version }
        : {}),
    });
    await completeUploadIntent({
      entityId: projectId,
      entityType: "project_asset",
      objectKey: body.objectKey,
      userId: user.id,
    });

    const [updatedProject] = await db
      .update(projects)
      .set({
        exportVersion: sql`${projects.exportVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(projects.id, projectId))
      .returning();

    return c.json(
      await buildProjectDetail(updatedProject ?? project),
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{projectId}/export",
    request: { params: z.object({ projectId: z.string() }) },
    responses: {
      [HttpStatusCodes.ACCEPTED]: jsonContent(
        z.object({
          exportVersion: z.number().int(),
          status: z.string(),
          workflowInstanceId: z.string(),
        }),
        "Project export accepted"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const { projectId } = c.req.valid("param"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [collaborator] = await db
      .select({ canEdit: projectCollaborators.canEdit })
      .from(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.projectId, projectId),
          eq(projectCollaborators.collaboratorUserId, user.id),
          eq(projectCollaborators.invitationStatus, "accepted")
        )
      )
      .limit(1);
    const canExport =
      project.ownerUserId === user.id ||
      (organizationId && project.organizationId === organizationId) ||
      collaborator?.canEdit === true;
    if (!canExport) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const result = await ensureProjectExportWorkflow({
      payload: {
        exportVersion: project.exportVersion,
        pipelineVersion: PROJECT_EXPORT_PIPELINE_VERSION,
        projectId: project.id,
      },
      workflow: c.env.PROJECT_EXPORT_WORKFLOW,
    });
    return c.json(
      {
        exportVersion: project.exportVersion,
        status: result.job?.status ?? "queued",
        workflowInstanceId: result.workflowInstanceId,
      },
      HttpStatusCodes.ACCEPTED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{projectId}/export",
    request: { params: z.object({ projectId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          assets: z
            .object({
              downloadUrl: z.string(),
              fileName: z.string(),
              id: z.string(),
              status: z.string(),
            })
            .array(),
          exportVersion: z.number().int(),
          status: z.string(),
          workflowInstanceId: z.string().nullable(),
        }),
        "Project export state"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const { projectId } = c.req.valid("param"),
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const [purchase, collaborator] = await Promise.all([
        db
          .select({ id: purchases.id })
          .from(purchases)
          .where(
            and(
              eq(purchases.projectId, projectId),
              eq(purchases.buyerUserId, user.id)
            )
          )
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select({ id: projectCollaborators.id })
          .from(projectCollaborators)
          .where(
            and(
              eq(projectCollaborators.projectId, projectId),
              eq(projectCollaborators.collaboratorUserId, user.id),
              eq(projectCollaborators.invitationStatus, "accepted")
            )
          )
          .limit(1)
          .then((rows) => rows[0]),
      ]),
      canAccess =
        project.ownerUserId === user.id ||
        Boolean(purchase) ||
        Boolean(collaborator);
    if (!canAccess) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const [job, assets] = await Promise.all([
      db
        .select()
        .from(mediaProcessingJobs)
        .where(
          and(
            eq(mediaProcessingJobs.projectId, projectId),
            eq(mediaProcessingJobs.workflowType, "project_export"),
            eq(mediaProcessingJobs.exportVersion, project.exportVersion)
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          id: projectAssets.id,
          objectKey: projectAssets.objectKey,
          status: projectAssets.status,
        })
        .from(projectAssets)
        .where(
          and(
            eq(projectAssets.projectId, projectId),
            eq(projectAssets.assetKind, "release_export"),
            eq(projectAssets.exportVersion, project.exportVersion)
          )
        )
        .orderBy(asc(projectAssets.objectKey)),
    ]);
    return c.json(
      {
        assets: assets.map((asset) => ({
          downloadUrl: `/v1/projects/${projectId}/assets/${asset.id}/download`,
          fileName: asset.objectKey?.split("/").pop() ?? `${asset.id}.m4a`,
          id: asset.id,
          status: asset.status,
        })),
        exportVersion: project.exportVersion,
        status: job?.status ?? "not_started",
        workflowInstanceId: job?.workflowInstanceId ?? null,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{projectId}/assets/{assetId}/download",
    request: {
      params: z.object({ assetId: z.string(), projectId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: {
        content: {
          "application/octet-stream": {
            schema: z.string().openapi({ format: "binary" }),
          },
        },
        description: "Authorized project export download",
      },
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project export not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const { assetId, projectId } = c.req.valid("param"),
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
      [asset] = await db
        .select({
          assetKind: projectAssets.assetKind,
          id: projectAssets.id,
          mimeType: projectAssets.mimeType,
          objectKey: projectAssets.objectKey,
          status: projectAssets.status,
        })
        .from(projectAssets)
        .where(
          and(
            eq(projectAssets.id, assetId),
            eq(projectAssets.projectId, projectId),
            inArray(projectAssets.status, ["uploaded", "ready"])
          )
        )
        .limit(1);
    if (!(project && asset?.objectKey)) {
      return c.json(
        { message: "Project export not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const [purchase, collaborator] = await Promise.all([
      db
        .select({ id: purchases.id })
        .from(purchases)
        .where(
          and(
            eq(purchases.projectId, projectId),
            eq(purchases.buyerUserId, user.id)
          )
        )
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({ id: projectCollaborators.id })
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.collaboratorUserId, user.id),
            eq(projectCollaborators.invitationStatus, "accepted")
          )
        )
        .limit(1)
        .then((rows) => rows[0]),
    ]);
    const canAccessWorkspaceAsset =
      asset.assetKind !== "release_export" && Boolean(collaborator);
    if (
      !(project.ownerUserId === user.id || purchase || canAccessWorkspaceAsset)
    ) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const object = await c.env.MEDIA_BUCKET?.get(asset.objectKey);
    if (!object) {
      return c.json(
        { message: "Project export not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const fileName = asset.objectKey.split("/").pop() ?? `${asset.id}.m4a`,
      headers = new Headers({
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${fileName.replaceAll('"', "_")}"`,
        "Content-Length": String(object.size),
        "Content-Type": asset.mimeType ?? "audio/mp4",
      });
    return new Response(object.body, { headers });
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/{projectId}",
    request: {
      params: z.object({
        projectId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Project deleted"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Project deleted." }, HttpStatusCodes.OK);
    }

    const { projectId } = c.req.valid("param"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb();

    const [deletedProject] = await db
      .delete(projects)
      .where(ownedProjectWhere({ organizationId, projectId, userId: user.id }))
      .returning({ id: projects.id });

    if (!deletedProject) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json({ message: "Project deleted." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{projectId}",
    request: {
      params: z.object({
        projectId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        projectDashboardDetailSchema,
        "Project detail summary"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const { projectId } = c.req.valid("param"),
      user = c.get("user");

    if (!isDatabaseConfigured()) {
      const project =
        sampleProjects.find((entry) => entry.id === projectId) ??
        sampleProjects[0];

      if (!project) {
        throw new Error("Sample project fallback is missing.");
      }

      return c.json(
        {
          ...project,
          assets: [],
          collaborators: [],
          tracks: [],
        },
        HttpStatusCodes.OK
      );
    }

    const organizationId = isAuthenticatedUser(user)
        ? await resolveActiveOrganizationId({
            session: isAuthenticatedSession(c.get("session"))
              ? c.get("session")
              : null,
            user,
          })
        : null,
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    if (!project) {
      return c.json(
        {
          message: "Project not found.",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (!project.isPublic) {
      if (!isAuthenticatedUser(user)) {
        return c.json(
          { message: "Project not found." },
          HttpStatusCodes.NOT_FOUND
        );
      }

      const isCollaborator =
          (
            await db
              .select({ id: projectCollaborators.id })
              .from(projectCollaborators)
              .where(
                and(
                  eq(projectCollaborators.projectId, projectId),
                  eq(projectCollaborators.collaboratorUserId, user.id),
                  eq(projectCollaborators.invitationStatus, "accepted")
                )
              )
              .limit(1)
          ).length > 0,
        isOwner =
          project.ownerUserId === user.id ||
          (organizationId && project.organizationId === organizationId);

      if (!isOwner && !isCollaborator) {
        return c.json(
          { message: "Project not found." },
          HttpStatusCodes.NOT_FOUND
        );
      }
    }

    return c.json(await buildProjectDetail(project), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{projectId}/tracks",
    request: {
      body: jsonContentRequired(
        z.object({
          bpm: z.number().int().positive().optional(),
          genre: z.string().optional(),
          musicalKey: z.string().optional(),
          sourceObjectKey: z.string().min(1),
          title: z.string().trim().min(1).max(160),
        }),
        "Project track payload"
      ),
      params: z.object({ projectId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        projectDashboardDetailSchema,
        "Track added to project"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid uploaded track"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    const { projectId } = c.req.valid("param"),
      body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [collaborator] = await db
        .select({ canUpload: projectCollaborators.canUpload })
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.collaboratorUserId, user.id),
            eq(projectCollaborators.invitationStatus, "accepted")
          )
        )
        .limit(1),
      isCollaborator = collaborator?.canUpload === true,
      isOwner =
        project.ownerUserId === user.id ||
        (organizationId && project.organizationId === organizationId);

    if (!isOwner && !isCollaborator) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (
      !body.sourceObjectKey.startsWith(`projects/${user.id}/`) &&
      !body.sourceObjectKey.startsWith(`tracks/${user.id}/`) &&
      !body.sourceObjectKey.startsWith(`uploads/${user.id}/`)
    ) {
      return c.json(
        { message: "Uploaded project track does not belong to this user." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const uploadedObject = await c.env.MEDIA_BUCKET?.head(body.sourceObjectKey);
    if (!uploadedObject) {
      return c.json(
        { message: "Uploaded project track was not found in storage." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const trackId = crypto.randomUUID(),
      now = new Date(),
      genreId = body.genre ? await ensureGenreId(body.genre) : project.genreId;
    await claimUploadIntent({
      entityId: trackId,
      entityType: "track_asset",
      objectKey: body.sourceObjectKey,
      userId: user.id,
    });

    await db.insert(tracks).values({
      downloadsAllowed: true,
      downloadsRequireFirstPlay: false,
      downloadsRequirePurchase: false,
      genreId,
      id: trackId,
      isForSale: false,
      isPublic: false,
      listeningAccess: "public",
      organizationId: project.organizationId,
      ownerUserId: user.id,
      productionStatus: "demo",
      releaseStrategy: "private",
      slug: uniqueSlug(body.title),
      title: body.title,
    });

    const masterAssetId = crypto.randomUUID();
    await db.insert(trackAssets).values({
      assetKind: "master",
      bucketName: getUploadBucketName(),
      id: masterAssetId,
      isCurrent: true,
      mimeType: "audio/*",
      objectKey: body.sourceObjectKey,
      processingVersion: MEDIA_PIPELINE_VERSION,
      purpose: "master",
      sizeBytes: uploadedObject.size,
      status: "ready",
      storageProvider: "r2",
      trackId,
      uploaderUserId: user.id,
    });
    await completeUploadIntent({
      entityId: trackId,
      entityType: "track_asset",
      objectKey: body.sourceObjectKey,
      userId: user.id,
    });

    const existingTracks = await db
        .select({ position: projectTracks.position })
        .from(projectTracks)
        .where(eq(projectTracks.projectId, projectId)),
      nextPosition =
        existingTracks.length > 0
          ? Math.max(...existingTracks.map((t) => t.position)) + 1
          : 0;

    await db.insert(projectTracks).values({
      position: nextPosition,
      projectId,
      trackId,
    });

    const acceptedProjectCollaborators = await db
      .select({
        collaboratorRole: projectCollaborators.collaboratorRole,
        collaboratorUserId: projectCollaborators.collaboratorUserId,
      })
      .from(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.projectId, projectId),
          eq(projectCollaborators.invitationStatus, "accepted")
        )
      );
    const trackCollaboratorRows = acceptedProjectCollaborators
      .filter(
        (projectCollaborator) =>
          projectCollaborator.collaboratorUserId &&
          projectCollaborator.collaboratorUserId !== user.id
      )
      .map((projectCollaborator) => ({
        canDelete: false,
        canEdit: true,
        canUpload: true,
        collaboratorRole: projectCollaborator.collaboratorRole,
        collaboratorUserId: projectCollaborator.collaboratorUserId,
        id: crypto.randomUUID(),
        invitationStatus: "accepted" as const,
        invitedByUserId: project.ownerUserId,
        trackId,
      }));
    if (trackCollaboratorRows.length > 0) {
      await db.insert(trackCollaborators).values(trackCollaboratorRows);
    }

    const [updatedProject] = await db
      .update(projects)
      .set({
        exportVersion: sql`${projects.exportVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(projects.id, projectId))
      .returning();

    try {
      await ensureMediaProcessingWorkflow({
        payload: {
          mode: "final_track",
          objectKey: body.sourceObjectKey,
          pipelineVersion: MEDIA_PIPELINE_VERSION,
          sourceAssetId: masterAssetId,
          trackId,
        },
        workflow: c.env.MEDIA_PROCESSING_WORKFLOW,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        event: "project_track_media_workflow_launch_failed",
        projectId,
        sourceAssetId: masterAssetId,
        trackId,
      });
    }

    return c.json(
      await buildProjectDetail(updatedProject ?? project),
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{projectId}/library-assets",
    request: {
      body: jsonContentRequired(
        projectLibraryAssetBodySchema,
        "Project library asset selection"
      ),
      params: z.object({ projectId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        projectDashboardDetailSchema,
        "Library assets added to project"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid project library asset selection"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Projects"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { projectId } = c.req.valid("param"),
      body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const [collaborator] = await db
        .select({ canUpload: projectCollaborators.canUpload })
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.collaboratorUserId, user.id),
            eq(projectCollaborators.invitationStatus, "accepted")
          )
        )
        .limit(1),
      isOwner =
        project.ownerUserId === user.id ||
        (organizationId && project.organizationId === organizationId),
      canUpload = isOwner || collaborator?.canUpload === true;

    if (!canUpload) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const uniqueTrackIds = [...new Set(body.trackIds)],
      sourceOwnership = organizationId
        ? or(
            eq(tracks.ownerUserId, user.id),
            eq(tracks.organizationId, organizationId)
          )
        : eq(tracks.ownerUserId, user.id),
      sourceRows = await db
        .select({
          assetId: trackAssets.id,
          bucketName: trackAssets.bucketName,
          durationMs: trackAssets.durationMs,
          mimeType: trackAssets.mimeType,
          objectKey: trackAssets.objectKey,
          sizeBytes: trackAssets.sizeBytes,
          status: trackAssets.status,
          storageProvider: trackAssets.storageProvider,
          title: tracks.title,
          trackId: tracks.id,
        })
        .from(tracks)
        .innerJoin(
          trackAssets,
          and(
            eq(trackAssets.trackId, tracks.id),
            eq(trackAssets.assetKind, "master"),
            eq(trackAssets.isCurrent, true),
            isNotNull(trackAssets.objectKey)
          )
        )
        .where(
          and(
            inArray(tracks.id, uniqueTrackIds),
            isNull(tracks.deletedAt),
            sourceOwnership
          )
        );

    if (sourceRows.length !== uniqueTrackIds.length) {
      return c.json(
        {
          message:
            "One or more selected uploads is unavailable or does not have an uploaded master.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const rowsByTrackId = new Map(
        sourceRows.map((sourceRow) => [sourceRow.trackId, sourceRow])
      ),
      orderedSourceRows = uniqueTrackIds.flatMap((trackId) => {
        const sourceRow = rowsByTrackId.get(trackId);
        return sourceRow ? [sourceRow] : [];
      }),
      [attachedTrackRows, attachedAssetRows] = await Promise.all([
        db
          .select({ trackId: projectTracks.trackId })
          .from(projectTracks)
          .where(eq(projectTracks.projectId, projectId)),
        db
          .select({
            objectKey: projectAssets.objectKey,
            sourceAssetId: projectAssets.sourceAssetId,
          })
          .from(projectAssets)
          .where(eq(projectAssets.projectId, projectId)),
      ]),
      attachedTrackIds = new Set(
        attachedTrackRows.map((attachedTrack) => attachedTrack.trackId)
      ),
      attachedObjectKeys = new Set(
        attachedAssetRows
          .map((attachedAsset) => attachedAsset.objectKey)
          .filter((objectKey): objectKey is string => Boolean(objectKey))
      ),
      attachedSourceAssetIds = new Set(
        attachedAssetRows
          .map((attachedAsset) => attachedAsset.sourceAssetId)
          .filter((sourceAssetId): sourceAssetId is string =>
            Boolean(sourceAssetId)
          )
      );

    let addedCount = 0;
    if (body.assetKind === "master") {
      const existingPositions = await db
          .select({ position: projectTracks.position })
          .from(projectTracks)
          .where(eq(projectTracks.projectId, projectId)),
        nextPositionStart =
          existingPositions.length > 0
            ? Math.max(...existingPositions.map((entry) => entry.position)) + 1
            : 0;
      let nextPosition = nextPositionStart;

      for (const sourceRow of orderedSourceRows) {
        if (attachedTrackIds.has(sourceRow.trackId)) {
          continue;
        }
        await db
          .insert(projectTracks)
          .values({
            position: nextPosition,
            projectId,
            trackId: sourceRow.trackId,
          })
          .onConflictDoNothing();
        nextPosition += 1;
        addedCount += 1;
      }
    } else {
      const capabilities = await getDatabaseSchemaCapabilities(db),
        storedAssetKind: "attachment" | "beat" | "concept" =
          body.assetKind === "beat" && !capabilities.projectAssetKinds.beat
            ? "attachment"
            : body.assetKind === "concept" &&
                !capabilities.projectAssetKinds.concept
              ? "attachment"
              : body.assetKind,
        projectAssetRows = [];

      for (const sourceRow of orderedSourceRows) {
        if (
          !sourceRow.objectKey ||
          attachedSourceAssetIds.has(sourceRow.assetId) ||
          attachedObjectKeys.has(sourceRow.objectKey)
        ) {
          continue;
        }

        projectAssetRows.push({
          assetKind: storedAssetKind,
          bucketName: sourceRow.bucketName ?? getUploadBucketName(),
          durationMs: sourceRow.durationMs,
          id: crypto.randomUUID(),
          metadata: {
            displayName: sourceRow.title,
            originalFileName:
              sourceRow.objectKey.split("/").pop() ?? sourceRow.title,
            requestedAssetKind:
              storedAssetKind === body.assetKind ? undefined : body.assetKind,
            sourceTrackId: sourceRow.trackId,
            sourceTrackTitle: sourceRow.title,
          },
          mimeType: sourceRow.mimeType,
          objectKey: sourceRow.objectKey,
          projectId,
          sizeBytes: sourceRow.sizeBytes,
          sourceAssetId: sourceRow.assetId,
          status: sourceRow.status,
          storageProvider: sourceRow.storageProvider,
          uploaderUserId: user.id,
        });
      }

      if (projectAssetRows.length > 0) {
        await db.insert(projectAssets).values(projectAssetRows);
        addedCount = projectAssetRows.length;
      }
    }

    const updatedProject =
      addedCount > 0
        ? (
            await db
              .update(projects)
              .set({
                exportVersion: sql`${projects.exportVersion} + 1`,
                updatedAt: new Date(),
              })
              .where(eq(projects.id, projectId))
              .returning()
          )[0]
        : project;

    return c.json(
      await buildProjectDetail(updatedProject ?? project),
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
