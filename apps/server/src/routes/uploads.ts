import { RejectUpload, handleRequest, route } from "@better-upload/server";
import type { Router } from "@better-upload/server";
import { cloudflare } from "@better-upload/server/clients";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const getProcessEnv = () => globalThis.process?.env ?? {};

const createUploadRouter = (): Router | null => {
  const processEnv = getProcessEnv();
  const bucketName = processEnv.UPLOAD_BUCKET_NAME;

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
        onBeforeUpload: ({ files }) => {
          if (files.length === 0) {
            throw new RejectUpload("At least one file is required.");
          }

          return {
            generateObjectInfo: ({ file }) => ({
              key: `uploads/${Date.now()}-${file.name}`,
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
          ? "Better Upload routes are configured."
          : "Upload routes are wired, but UPLOAD_BUCKET_NAME is not configured yet.",
      },
      HttpStatusCodes.OK
    )
);

app.on(["GET", "POST"], "/media", (c) => {
  const uploadRouter = createUploadRouter();

  if (!uploadRouter) {
    return c.json(
      { message: "Upload storage credentials are not configured yet." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return handleRequest(c.req.raw, uploadRouter);
});

export default app;
