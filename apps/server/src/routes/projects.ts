import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { sampleProjects } from "@/lib/sample-data";
import { createProjectBodySchema, projectSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

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
  (c) => c.json(sampleProjects, HttpStatusCodes.OK)
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
    },
    tags: ["Projects"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        id: "project_new",
        isPublic: true,
        projectType: body.projectType,
        slug: body.title.toLowerCase().replaceAll(" ", "-"),
        title: body.title,
        trackCount: body.trackIds.length,
      },
      HttpStatusCodes.CREATED
    );
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
        projectSummarySchema,
        "Project detail summary"
      ),
    },
    tags: ["Projects"],
  }),
  (c) => {
    const { projectId } = c.req.valid("param");
    const project =
      sampleProjects.find((entry) => entry.id === projectId) ??
      sampleProjects[0];
    return c.json(project, HttpStatusCodes.OK);
  }
);

export default app;
