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

const createObjectKey = ({
  fileName,
  prefix,
  userId,
}: {
  fileName: string;
  prefix: string;
  userId: string;
}) => {
  const sanitizedName = fileName.replaceAll(/\s+/g, "-");

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
  const bucketName = env.UPLOAD_BUCKET_NAME;

  if (!bucketName) {
    return null;
  }

  return {
    bucketName,
    client: cloudflare(),
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
            generateObjectInfo: ({ file }) => {
              return {
                key: createObjectKey({
                  fileName: file.name,
                  prefix: "uploads",
                  userId,
                }),
              };
            },
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
        message: createUploadRouter()
          ? "Better Upload routes are configured for generic media, profile media, track source uploads, and project assets."
          : "Upload routes are wired, but UPLOAD_BUCKET_NAME is not configured yet.",
      },
      HttpStatusCodes.OK
    )
);

const handleUploadRoute = (
  uploadPath:
    | "/media"
    | "/profile-media"
    | "/project-assets"
    | "/track-source"
) =>
  app.on(["GET", "POST"], uploadPath, (c) => {
    const uploadRouter = createUploadRouter();

    if (!uploadRouter) {
      return c.json(
        { message: "Upload storage credentials are not configured yet." },
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
