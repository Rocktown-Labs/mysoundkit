/* eslint-disable complexity, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  genres,
  projectAssets,
  projectTracks,
  projects,
  trackAssets,
  tracks,
} from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { desc, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  buildProjectDetail,
  buildProjectSummary,
  ownedProjectWhere,
} from "@/lib/dashboard-mappers";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { sampleProjects } from "@/lib/sample-data";
import {
  createProjectBodySchema,
  messageResponseSchema,
  projectDashboardDetailSchema,
  projectSummarySchema,
  updateProjectBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId, uniqueSlug } from "@/lib/workspace";
import { logError } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>();

const getUploadBucketName = () =>
  (env as unknown as { UPLOAD_BUCKET_NAME?: string }).UPLOAD_BUCKET_NAME ??
  null;

const ensureGenreId = async (genreName: string) => {
  const db = createDb();
  const genreSlug = genreName.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
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
    name: genreName,
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

    if (!isAuthenticatedUser(user) || !isDatabaseConfigured()) {
      return c.json(sampleProjects, HttpStatusCodes.OK);
    }

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const rows = await db
      .select()
      .from(projects)
      .where(
        organizationId
          ? eq(projects.organizationId, organizationId)
          : eq(projects.ownerUserId, user.id)
      )
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
          collaboratorCount: body.collaboratorNames.length,
          coverArtUrl: null,
          description: body.description ?? null,
          id: "project_new",
          isPublic: body.isPublic,
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
      const [project] = await db
        .insert(projects)
        .values({
          createdAt: now,
          description: body.description ?? null,
          id: projectId,
          isPublic: body.isPublic,
          organizationId,
          ownerUserId: user.id,
          projectType: body.projectType,
          releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
          slug: uniqueSlug(body.title),
          status: body.releaseDate ? "scheduled" : "draft",
          title: body.title,
          updatedAt: now,
        })
        .returning();

      const existingTrackIds = body.trackIds;
      const newTrackIds = [];

      for (const newTrack of body.newTracks) {
        const trackId = crypto.randomUUID();
        const genreId = await ensureGenreId(newTrack.genre);
        await db.insert(tracks).values({
          catalogItemType: "single",
          genreId,
          id: trackId,
          isForSale: false,
          isPublic: body.isPublic,
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
            id: crypto.randomUUID(),
            metadata: {
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
    const [project] = await db
      .update(projects)
      .set({
        description: body.description,
        isPublic: body.isPublic,
        projectType: body.projectType,
        releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined,
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

    if (!isAuthenticatedUser(user) || !isDatabaseConfigured()) {
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

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(ownedProjectWhere({ organizationId, projectId, userId: user.id }))
      .limit(1);

    if (!project) {
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
