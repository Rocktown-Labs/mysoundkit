import { RejectUpload, handleRequest, route } from "@better-upload/server";
import type { Router } from "@better-upload/server";
import { cloudflare } from "@better-upload/server/clients";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createAuth } from "@soundkit/auth";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userProfiles } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { logInfo, logWarn } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>(),
  uploadConfigKeys = [
    "UPLOAD_BUCKET_NAME",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_KEY_ID",
    "CLOUDFLARE_SECRET_ACCESS_KEY",
  ] as const;

type UploadConfigKey = (typeof uploadConfigKeys)[number];

const getEnvValue = (key: UploadConfigKey | "CLOUDFLARE_R2_JURISDICTION") => {
    const value = (env as unknown as Record<string, unknown>)[key];

    return typeof value === "string" && value.length > 0 ? value : null;
  },
  getUploadJurisdiction = (): "eu" | "fedramp" | undefined => {
    const jurisdiction = getEnvValue("CLOUDFLARE_R2_JURISDICTION");

    if (jurisdiction === "eu" || jurisdiction === "fedramp") {
      return jurisdiction;
    }

    return undefined;
  },
  getUploadConfig = () => {
    const bucketName = getEnvValue("UPLOAD_BUCKET_NAME"),
      accountId = getEnvValue("CLOUDFLARE_ACCOUNT_ID"),
      accessKeyId = getEnvValue("CLOUDFLARE_ACCESS_KEY_ID"),
      secretAccessKey = getEnvValue("CLOUDFLARE_SECRET_ACCESS_KEY"),
      missing: UploadConfigKey[] = [];

    if (!bucketName) {
      missing.push("UPLOAD_BUCKET_NAME");
    }
    if (!accountId) {
      missing.push("CLOUDFLARE_ACCOUNT_ID");
    }
    if (!accessKeyId) {
      missing.push("CLOUDFLARE_ACCESS_KEY_ID");
    }
    if (!secretAccessKey) {
      missing.push("CLOUDFLARE_SECRET_ACCESS_KEY");
    }

    if (!bucketName || !accountId || !accessKeyId || !secretAccessKey) {
      return { missing, ready: false as const };
    }

    return {
      accessKeyId,
      accountId,
      bucketName,
      jurisdiction: getUploadJurisdiction(),
      ready: true as const,
      secretAccessKey,
    };
  },
  uploadConfigMessage = (missing: readonly UploadConfigKey[]) =>
    `Upload storage credentials are not configured yet. Missing: ${missing.join(
      ", "
    )}.`,
  createObjectKey = ({
    fileName,
    prefix,
    userId,
  }: {
    fileName: string;
    prefix: string;
    userId: string;
  }) => {
    const sanitizedName = fileName.replaceAll(/\s+/gu, "-");

    return `${prefix}/${userId}/${Date.now()}-${sanitizedName}`;
  },
  requireUploadUser = async (request: Request) => {
    const session = await createAuth().api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      throw new RejectUpload("Sign in is required before uploading files.");
    }

    return session.user.id;
  },
  requireArtistUploadUser = async (request: Request) => {
    const userId = await requireUploadUser(request);

    if (!isDatabaseConfigured()) {
      return userId;
    }

    const db = createDb(),
      [profile] = await db
        .select({ accountType: userProfiles.accountType })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

    if (profile?.accountType !== "artist") {
      throw new RejectUpload(
        "Convert to an artist account before uploading tracks."
      );
    }

    return userId;
  },
  createUploadRouter = (): Router | null => {
    const uploadConfig = getUploadConfig();

    if (!uploadConfig.ready) {
      return null;
    }

    return {
      bucketName: uploadConfig.bucketName,
      client: cloudflare({
        accessKeyId: uploadConfig.accessKeyId,
        accountId: uploadConfig.accountId,
        jurisdiction: uploadConfig.jurisdiction,
        secretAccessKey: uploadConfig.secretAccessKey,
      }),
      routes: {
        media: route({
          fileTypes: [
            "audio/*",
            "image/*",
            "video/*",
            "application/octet-stream",
          ],
          maxFileSize: 1024 * 1024 * 1024 * 2,
          multipart: true,
          multipleFiles: true,
          onBeforeUpload: async ({ files, req }) => {
            if (files.length === 0) {
              throw new RejectUpload("At least one file is required.");
            }

            const userId = await requireArtistUploadUser(req);

            return {
              generateObjectInfo: ({ file }) => ({
                key: createObjectKey({
                  fileName: file.name,
                  prefix: "uploads",
                  userId,
                }),
              }),
            };
          },
        }),
        "profile-media": route({
          fileTypes: ["image/*"],
          maxFileSize: 1024 * 1024 * 10,
          maxFiles: 1,
          multipleFiles: true,
          onBeforeUpload: async ({ files, req }) => {
            if (files.length === 0) {
              throw new RejectUpload("Select an image before uploading.");
            }

            const userId = await requireUploadUser(req);

            return {
              generateObjectInfo: ({ file }) => ({
                key: createObjectKey({
                  fileName: file.name,
                  prefix: "profiles",
                  userId,
                }),
              }),
            };
          },
        }),
        "project-assets": route({
          fileTypes: [
            "audio/*",
            "image/*",
            "application/pdf",
            "application/octet-stream",
          ],
          maxFileSize: 1024 * 1024 * 1024 * 2,
          multipart: true,
          multipleFiles: true,
          onBeforeUpload: async ({ files, req }) => {
            if (files.length === 0) {
              throw new RejectUpload("At least one project file is required.");
            }

            const userId = await requireArtistUploadUser(req);

            return {
              generateObjectInfo: ({ file }) => ({
                key: createObjectKey({
                  fileName: file.name,
                  prefix: "projects",
                  userId,
                }),
              }),
            };
          },
        }),
        "track-source": route({
          fileTypes: ["audio/*", "application/octet-stream"],
          maxFileSize: 1024 * 1024 * 1024 * 2,
          multipart: true,
          multipleFiles: true,
          onBeforeUpload: async ({ files, req }) => {
            if (files.length === 0) {
              throw new RejectUpload("At least one track file is required.");
            }

            const userId = await requireArtistUploadUser(req);

            logInfo({
              event: "upload_presigned_url_requested",
              fileCount: files.length,
              fileNames: files.map((f) => f.name),
              fileSizes: files.map((f) => f.size),
              route: "track-source",
              userId,
            });

            return {
              generateObjectInfo: ({ file }) => ({
                key: createObjectKey({
                  fileName: file.name,
                  prefix: "tracks",
                  userId,
                }),
              }),
            };
          },
        }),
      },
    };
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Upload route status"
      ),
    },
    tags: ["Uploads"],
  }),
  (c) =>
    c.json(
      {
        message: (() => {
          const uploadConfig = getUploadConfig();

          return uploadConfig.ready
            ? "Better Upload routes are configured for generic media, profile media, track source uploads, and project assets."
            : uploadConfigMessage(uploadConfig.missing);
        })(),
      },
      HttpStatusCodes.OK
    )
);

const handleUploadRoute = (
  uploadPath: "/media" | "/profile-media" | "/project-assets" | "/track-source"
) =>
  app.on(["GET", "POST"], uploadPath, async (c) => {
    const uploadRouter = createUploadRouter();

    if (!uploadRouter) {
      const uploadConfig = getUploadConfig();

      return c.json(
        {
          message: uploadConfig.ready
            ? "Upload storage credentials are not configured yet."
            : uploadConfigMessage(uploadConfig.missing),
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const userId = c.get("user")?.id ?? null;

    if (c.req.method === "POST") {
      const startedAt = Date.now();
      logInfo({
        event: "upload_signed_url_requested",
        route: uploadPath,
        userId,
      });

      const response = await handleRequest(c.req.raw, uploadRouter);

      if (response.status >= 400) {
        logWarn({
          durationMs: Date.now() - startedAt,
          event: "upload_signed_url_rejected",
          route: uploadPath,
          status: response.status,
          userId,
        });
      } else {
        logInfo({
          durationMs: Date.now() - startedAt,
          event: "upload_signed_url_issued",
          route: uploadPath,
          status: response.status,
          userId,
        });
      }

      return response;
    }

    return handleRequest(c.req.raw, uploadRouter);
  });

handleUploadRoute("/media");
handleUploadRoute("/profile-media");
handleUploadRoute("/project-assets");
handleUploadRoute("/track-source");

export default app;
