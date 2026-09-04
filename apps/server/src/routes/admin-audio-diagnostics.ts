/* eslint-disable one-var, sort-vars */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { audioDiagnosticJobs } from "@soundkit/db/schema/app";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import {
  AUDIO_DIAGNOSTIC_TEST_META,
  AUDIO_DIAGNOSTIC_TESTS,
  MAX_DIAGNOSTIC_TRACKS,
  STALE_RUNNING_JOB_MS,
  listDiagnosticJobs,
  processDiagnosticJob,
} from "@/lib/audio-diagnostics";
import { ContainerMediaProcessor } from "@/lib/media-processor";
import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  diagnosticTestSchema = z.enum(AUDIO_DIAGNOSTIC_TESTS),
  createJobBodySchema = z.object({
    tests: diagnosticTestSchema.array().min(1).max(4),
    trackIds: z.string().array().min(1).max(MAX_DIAGNOSTIC_TRACKS),
  }),
  diagnosticCheckSchema = z.object({
    detail: z.string(),
    test: z.string(),
    verdict: z.string(),
  }),
  diagnosticJobSchema = z.object({
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    error: z.string().nullable(),
    id: z.string(),
    progressDone: z.number().int(),
    results: z
      .object({
        checks: diagnosticCheckSchema.array(),
        trackId: z.string(),
        trackTitle: z.string(),
        verdict: z.string(),
      })
      .array(),
    status: z.string(),
    tests: z.string().array(),
    total: z.number().int(),
  }),
  serializeJob = (job: typeof audioDiagnosticJobs.$inferSelect) => ({
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    error: job.error,
    id: job.id,
    progressDone: job.progressDone,
    results: (job.results ?? []) as unknown as z.infer<
      typeof diagnosticJobSchema
    >["results"],
    status: job.status,
    tests: (job.tests ?? []) as string[],
    total: ((job.trackIds ?? []) as string[]).length,
  }),
  // waitUntil workers can be killed before a long job finishes; a job still
  // marked running with no recent progress is resumed on the next poll.
  kickJobProcessing = (
    jobId: string,
    env: AppEnv["Bindings"],
    executionCtx?: { waitUntil: (promise: Promise<unknown>) => void } | null
  ) => {
    if (!env.MEDIA_PROCESSOR) {
      void processDiagnosticJob({ jobId, processor: null });
      return;
    }
    const processor = new ContainerMediaProcessor({
      binding: env.MEDIA_PROCESSOR,
      workflowInstanceId: `audio_diagnostics_${jobId}`.slice(0, 100),
    });
    if (executionCtx?.waitUntil) {
      executionCtx.waitUntil(processDiagnosticJob({ jobId, processor }));
      return;
    }
    void processDiagnosticJob({ jobId, processor });
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/audio-diagnostics/tests",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z
          .object({
            description: z.string(),
            id: z.string(),
            label: z.string(),
          })
          .array(),
        "Available diagnostic tests"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    return c.json(
      AUDIO_DIAGNOSTIC_TESTS.map((id) => ({
        description: AUDIO_DIAGNOSTIC_TEST_META[id].description,
        id,
        label: AUDIO_DIAGNOSTIC_TEST_META[id].label,
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/audio-diagnostics/jobs",
    request: {
      body: jsonContentRequired(createJobBodySchema, "Diagnostic job payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        diagnosticJobSchema,
        "Created diagnostic job"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const body = c.req.valid("json"),
      jobId = crypto.randomUUID(),
      [job] = await createDb()
        .insert(audioDiagnosticJobs)
        .values({
          createdByUserId: c.get("user")?.id ?? null,
          id: jobId,
          progressDone: 0,
          results: [],
          status: "queued",
          tests: [...body.tests],
          trackIds: [...new Set(body.trackIds)],
        })
        .returning();
    if (!job) {
      throw new Error("Failed to create diagnostic job.");
    }
    kickJobProcessing(jobId, c.env as AppEnv["Bindings"], c.executionCtx);
    return c.json(serializeJob(job), HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/audio-diagnostics/jobs",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        diagnosticJobSchema.array(),
        "Recent diagnostic jobs"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    return c.json(
      (await listDiagnosticJobs()).map(serializeJob),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/audio-diagnostics/jobs/{jobId}",
    request: {
      params: z.object({ jobId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(diagnosticJobSchema, "Diagnostic job"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Job not found"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (!isDatabaseConfigured()) {
      return c.json({ message: "Job not found." }, HttpStatusCodes.NOT_FOUND);
    }
    const { jobId } = c.req.valid("param"),
      [job] = await createDb()
        .select()
        .from(audioDiagnosticJobs)
        .where(eq(audioDiagnosticJobs.id, jobId))
        .limit(1);
    if (!job) {
      return c.json({ message: "Job not found." }, HttpStatusCodes.NOT_FOUND);
    }
    // Self-healing: resume jobs whose background worker died mid-run.
    if (
      (job.status === "queued" || job.status === "running") &&
      Date.now() - job.updatedAt.getTime() > STALE_RUNNING_JOB_MS
    ) {
      kickJobProcessing(jobId, c.env as AppEnv["Bindings"], c.executionCtx);
    }
    return c.json(serializeJob(job), HttpStatusCodes.OK);
  }
);

export default app;
