import { RejectUpload, handleRequest, route } from "@better-upload/server";
import type { Router } from "@better-upload/server";
import { cloudflare } from "@better-upload/server/clients";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createAuth } from "@soundkit/auth";
import { env } from "@soundkit/env/server";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const uploadConfigKeys = [
  "UPLOAD_BUCKET_NAME",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ACCESS_KEY_ID",
  "CLOUDFLARE_SECRET_ACCESS_KEY",
] as const;

type UploadConfigKey = (typeof uploadConfigKeys)[number];

const getEnvValue = (key: UploadConfigKey | "CLOUDFLARE_R2_JURISDICTION") => {
  const value = (env as unknown as Record<string, unknown>)[key];

  return typeof value === "string" && value.length > 0 ? value : null;
};

const getUploadJurisdiction = (): "eu" | "fedramp" | undefined => {
  const jurisdiction = getEnvValue("CLOUDFLARE_R2_JURISDICTION");

  if (jurisdiction === "eu" || jurisdiction === "fedramp") {
    return jurisdiction;
  }

  return undefined;
};

const getUploadConfig = () => {
  const bucketName = getEnvValue("UPLOAD_BUCKET_NAME");
  const accountId = getEnvValue("CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = getEnvValue("CLOUDFLARE_ACCESS_KEY_ID");
  const secretAccessKey = getEnvValue("CLOUDFLARE_SECRET_ACCESS_KEY");
  const missing: UploadConfigKey[] = [];

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
};

const uploadConfigMessage = (missing: readonly UploadConfigKey[]) =>
  `Upload storage credentials are not configured yet. Missing: ${missing.join(
    ", "
  )}.`;

const createObjectKey = ({
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
};

const requireUploadUser = async (request: Request) => {
  const session = await createAuth().api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    throw new RejectUpload("Sign in is required before uploading files.");
  }

  return session.user.id;
};

const createUploadRouter = (): Router | null => {
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

          const userId = await requireUploadUser(req);

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

          const userId = await requireUploadUser(req);

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

          const userId = await requireUploadUser(req);

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
  app.on(["GET", "POST"], uploadPath, (c) => {
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

    return handleRequest(c.req.raw, uploadRouter);
  });

handleUploadRoute("/media");
handleUploadRoute("/profile-media");
handleUploadRoute("/project-assets");
handleUploadRoute("/track-source");

export default app;
