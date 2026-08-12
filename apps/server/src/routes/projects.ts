/* eslint-disable complexity, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  genres,
  projectAssets,
  projectCollaborators,
  projectPreSaves,
  projectTracks,
  projects,
  trackAssets,
  tracks,
  userNotifications,
} from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  buildProjectDetail,
  buildProjectSummary,
  ownedProjectWhere,
} from "@/lib/dashboard-mappers";
import { notifyCollaboratorInviteEmail } from "@/lib/email-events";
import { indexSearchEntity } from "@/lib/audio-processing";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { canonicalGenreName, canonicalGenreSlug } from "@/lib/genre-catalog";
import {
  genreSlugFromExploreFilter,
  stateFromExploreRegion,
} from "@/lib/public-explore";
import { sampleProjects } from "@/lib/sample-data";
import {
  createProjectBodySchema,
  messageResponseSchema,
  projectDashboardDetailSchema,
  projectSummarySchema,
  publicExploreQuerySchema,
  updateProjectBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
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
    await createDb().insert(projectPreSaves).values({
      projectId,
      userId: user.id,
    }).onConflictDoNothing();
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
};

const projectMatchesExploreFilters = (
  project: ProjectSummary,
  query: PublicProjectExploreQuery
) => {
  const genreSlug = genreSlugFromExploreFilter(query.genre);
  const state = stateFromExploreRegion(query);
  const regionSlug = state ? `us-${state.abbreviation.toLowerCase()}` : null;
  const q = query.q?.toLowerCase();

  if (
    genreSlug &&
    genreSlugFromExploreFilter(project.genre ?? "") !== genreSlug
  ) {
    return false;
  }

  if (regionSlug && project.regionSlug !== regionSlug) {
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
};

const getUploadBucketName = () =>
  (env as unknown as { UPLOAD_BUCKET_NAME?: string }).UPLOAD_BUCKET_NAME ??
  null;

const getUploadPublicBaseUrl = () =>
  (
    (env as unknown as { MEDIA_PUBLIC_URL?: string }).MEDIA_PUBLIC_URL ??
    (env as unknown as { VITE_MEDIA_URL?: string }).VITE_MEDIA_URL ??
    ""
  ).replace(/\/+$/u, "");

const ensureGenreId = async (genreName: string) => {
  const db = createDb();
  const genreSlug = canonicalGenreSlug(genreName);
  const [genreRow] = await db
    .select({ id: genres.id })
    .from(genres)
    .where(eq(genres.slug, genreSlug))
    .limit(1);

  if (genreRow) {
    return genreRow.id;
  }

  const genreId = crypto.randomUUID();
  await db.insert(genres).values({
    id: genreId,
    name: canonicalGenreName(genreName),
    slug: genreSlug,
  });

  return genreId;
};

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

    const db = createDb();
    const organizationId = isAuthenticatedUser(user)
      ? await resolveActiveOrganizationId({
          session: isAuthenticatedSession(c.get("session"))
            ? c.get("session")
            : null,
          user,
        })
      : null;
    let projectVisibilityWhere = eq(projects.isPublic, true);

    if (isAuthenticatedUser(user)) {
      projectVisibilityWhere = organizationId
        ? eq(projects.organizationId, organizationId)
        : eq(projects.ownerUserId, user.id);
    }

    const rows = await db
      .select()
      .from(projects)
      .where(projectVisibilityWhere)
      .orderBy(desc(projects.updatedAt))
      .limit(100);
    const summaries = [];

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

    const publicProjectConditions = [eq(projects.isPublic, true)];

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

    const rows = await createDb()
      .select()
      .from(projects)
      .where(and(...publicProjectConditions))
      .orderBy(projectOrderBy(query.sort))
      .limit(100);
    const summaries = [];

    for (const row of rows) {
      const summary = await buildProjectSummary(row);

      if (projectMatchesExploreFilters(summary, query)) {
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
    const { projectId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      const project = sampleProjects.find(
        (entry) => entry.id === projectId && entry.isPublic
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
      .where(and(eq(projects.id, projectId), eq(projects.isPublic, true)))
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

    try {
      const session = c.get("session");
      const organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
      const db = createDb();
      const projectId = crypto.randomUUID();
      const now = new Date();
      const hasNewTracks = body.newTracks.length > 0;
      const projectGenreId = body.genre
        ? await ensureGenreId(body.genre)
        : (body.newTracks[0]?.genre
          ? await ensureGenreId(body.newTracks[0].genre)
          : null);
      const projectStatus =
        body.status ?? (body.releaseDate ? "scheduled" : "draft");
      const [project] = await db
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
          isPublic: body.isPublic && !hasNewTracks,
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
        text: [body.title, body.description, body.genre].filter(Boolean).join("\n"),
      });

      const existingTrackIds = body.trackIds;
      const newTrackIds = [];

      for (const newTrack of body.newTracks) {
        const trackId = crypto.randomUUID();
        const genreId = await ensureGenreId(newTrack.genre);
        await db.insert(tracks).values({
          catalogItemType: "single",
          exclusiveUntil: body.exclusiveUntil
            ? new Date(body.exclusiveUntil)
            : null,
          genreId,
          id: trackId,
          isForSale: body.isForSale,
          isPublic: false,
          listeningAccess: body.listeningAccess,
          organizationId,
          ownerUserId: user.id,
          productionStatus: "demo",
          releaseStrategy: "private",
          slug: uniqueSlug(newTrack.title),
          title: newTrack.title,
        });

        if (newTrack.assetId) {
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
        }

        newTrackIds.push(trackId);
      }

      const projectCoverKey = body.assetIds[0] ?? null;

      if (projectCoverKey) {
        await db.insert(trackAssets).values(
          newTrackIds.map((trackId) => ({
            assetKind: "cover_art" as const,
            bucketName: getUploadBucketName(),
            id: crypto.randomUUID(),
            metadata: {
              originalFileName: body.title,
              url: `${getUploadPublicBaseUrl()}/${projectCoverKey}`,
            },
            mimeType: "image/*",
            objectKey: projectCoverKey,
            sizeBytes: null,
            status: "uploaded" as const,
            storageProvider: "r2" as const,
            trackId,
            uploaderUserId: user.id,
          }))
        );
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
            await db
              .insert(userNotifications)
              .values({
                id: `project_collaborator:${collaborator.id}`,
                link: `/dashboard/projects/${projectId}`,
                message: `${user.name ?? "Someone"} added you as a collaborator on ${body.title}.`,
                title: "New Project Collaboration",
                type: "collaborator_invite",
                userId: collaborator.collaboratorUserId,
              })
              .onConflictDoNothing();
          }

          if (collaborator.inviteEmail) {
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

      if (!project) {
        throw new Error("Failed to create project.");
      }

      return c.json(
        await buildProjectSummary(project),
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

    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const releaseDatePatch =
      "releaseDate" in body
        ? {
            releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
          }
        : {};
    const statusPatch = body.status ? { status: body.status } : {};
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
        : (body.priceCents !== undefined
          ? { priceCents: body.priceCents }
          : {})),
    };
    const [project] = await db
      .update(projects)
      .set({
        description: body.description,
        isPublic: body.isPublic,
        projectType: body.projectType,
        ...monetizationPatch,
        ...releaseDatePatch,
        ...statusPatch,
        title: body.title,
        updatedAt: new Date(),
      })
      .where(ownedProjectWhere({ organizationId, projectId, userId: user.id }))
      .returning();

    if (!project) {
      return c.json(
        { message: "Project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const coverObjectKey = body.assetIds?.[0] ?? null;

    if (coverObjectKey) {
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
    }

    return c.json(await buildProjectDetail(project), HttpStatusCodes.OK);
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

    const { projectId } = c.req.valid("param");
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();

    await db
      .delete(projects)
      .where(ownedProjectWhere({ organizationId, projectId, userId: user.id }));

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
    const { projectId } = c.req.valid("param");
    const user = c.get("user");

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
      : null;
    const db = createDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (
      !project ||
      (!project.isPublic &&
        (!isAuthenticatedUser(user) ||
          (project.ownerUserId !== user.id &&
            project.organizationId !== organizationId)))
    ) {
      return c.json(
        {
          message: "Project not found.",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(await buildProjectDetail(project), HttpStatusCodes.OK);
  }
);

export default app;
