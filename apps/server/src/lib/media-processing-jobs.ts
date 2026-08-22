/* eslint-disable one-var, sort-vars */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { mediaProcessingJobs } from "@soundkit/db/schema/app";
import { and, eq } from "drizzle-orm";

import {
  mediaProcessingWorkflowInstanceId,
  mediaRetentionWorkflowInstanceId,
  projectExportWorkflowInstanceId,
  trackEnrichmentWorkflowInstanceId,
} from "./media-pipeline";
import type {
  MediaProcessingStage,
  MediaProcessingWorkflowPayload,
  MediaRetentionWorkflowPayload,
  ProjectExportWorkflowPayload,
  TrackEnrichmentWorkflowPayload,
} from "./media-pipeline";

type MediaJobStatus = "failed" | "partial" | "queued" | "ready" | "running";
type MediaWorkflowType =
  | "media_processing"
  | "media_retention"
  | "project_export"
  | "track_enrichment";
type WorkflowRuntimeStatus =
  | "complete"
  | "errored"
  | "paused"
  | "queued"
  | "running"
  | "terminated"
  | "unknown"
  | "waiting"
  | "waitingForPause";

interface EnsureWorkflowResult {
  job: typeof mediaProcessingJobs.$inferSelect | null;
  workflowInstanceId: string;
  workflowStatus: WorkflowRuntimeStatus | "binding_unavailable";
}

interface PersistJobInput {
  exportVersion?: number;
  input: unknown;
  mode?: "final_track" | "legacy_backfill" | "open_verse_base";
  pipelineVersion: number;
  projectId?: string;
  sourceAssetId?: string;
  trackId?: string;
  workflowInstanceId: string;
  workflowType: MediaWorkflowType;
}

const jobId = (workflowType: MediaWorkflowType, workflowInstanceId: string) =>
    `${workflowType}:${workflowInstanceId}`,
  findJob = async ({
    workflowInstanceId,
    workflowType,
  }: Pick<PersistJobInput, "workflowInstanceId" | "workflowType">) => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const [job] = await createDb()
      .select()
      .from(mediaProcessingJobs)
      .where(
        and(
          eq(mediaProcessingJobs.workflowType, workflowType),
          eq(mediaProcessingJobs.workflowInstanceId, workflowInstanceId)
        )
      )
      .limit(1);

    return job ?? null;
  },
  persistQueuedJob = async (input: PersistJobInput) => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    await createDb()
      .insert(mediaProcessingJobs)
      .values({
        currentStage: "queued",
        exportVersion: input.exportVersion,
        id: jobId(input.workflowType, input.workflowInstanceId),
        input: input.input,
        mode: input.mode,
        pipelineVersion: input.pipelineVersion,
        projectId: input.projectId,
        sourceAssetId: input.sourceAssetId,
        status: "queued",
        trackId: input.trackId,
        workflowInstanceId: input.workflowInstanceId,
        workflowType: input.workflowType,
      })
      .onConflictDoNothing();

    return findJob(input);
  },
  markLaunchFailed = async ({
    error,
    workflowInstanceId,
    workflowType,
  }: {
    error: unknown;
    workflowInstanceId: string;
    workflowType: MediaWorkflowType;
  }) => {
    if (!isDatabaseConfigured()) {
      return;
    }

    await createDb()
      .update(mediaProcessingJobs)
      .set({
        currentStage: "failed",
        errorCode: "WORKFLOW_LAUNCH_FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Workflow launch failed.",
        status: "failed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mediaProcessingJobs.workflowType, workflowType),
          eq(mediaProcessingJobs.workflowInstanceId, workflowInstanceId)
        )
      );
  },
  ensureWorkflowInstance = async <Payload>({
    jobInput,
    payload,
    workflow,
  }: {
    jobInput: PersistJobInput;
    payload: Payload;
    workflow: null | Workflow<Payload> | undefined;
  }): Promise<EnsureWorkflowResult> => {
    const job = await persistQueuedJob(jobInput);

    if (job?.status === "ready") {
      return {
        job,
        workflowInstanceId: jobInput.workflowInstanceId,
        workflowStatus: "complete",
      };
    }

    if (!workflow) {
      const error = new Error(
        `${jobInput.workflowType} Workflow binding is unavailable.`
      );
      await markLaunchFailed({
        error,
        workflowInstanceId: jobInput.workflowInstanceId,
        workflowType: jobInput.workflowType,
      });

      return {
        job: await findJob(jobInput),
        workflowInstanceId: jobInput.workflowInstanceId,
        workflowStatus: "binding_unavailable",
      };
    }

    try {
      const [createdInstance] = await workflow.createBatch([
          {
            id: jobInput.workflowInstanceId,
            params: payload,
            retention: {
              errorRetention: "30 days",
              successRetention: "30 days",
            },
          },
        ]),
        instance =
          createdInstance ?? (await workflow.get(jobInput.workflowInstanceId)),
        instanceStatus = createdInstance
          ? { status: "queued" as const }
          : await instance.status(),
        shouldRestart =
          !createdInstance &&
          (instanceStatus.status === "errored" ||
            instanceStatus.status === "terminated" ||
            job?.status === "failed" ||
            job?.status === "partial");

      if (shouldRestart) {
        await instance.restart();
      }

      if (isDatabaseConfigured()) {
        await createDb()
          .update(mediaProcessingJobs)
          .set({
            currentStage: "queued",
            errorCode: null,
            errorMessage: null,
            status: "queued",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(mediaProcessingJobs.workflowType, jobInput.workflowType),
              eq(
                mediaProcessingJobs.workflowInstanceId,
                jobInput.workflowInstanceId
              )
            )
          );
      }

      return {
        job: await findJob(jobInput),
        workflowInstanceId: jobInput.workflowInstanceId,
        workflowStatus: shouldRestart ? "queued" : instanceStatus.status,
      };
    } catch (error) {
      await markLaunchFailed({
        error,
        workflowInstanceId: jobInput.workflowInstanceId,
        workflowType: jobInput.workflowType,
      });
      throw error;
    }
  };

export const updateMediaProcessingJob = async ({
  completedAt,
  currentStage,
  errorCode,
  errorMessage,
  output,
  progressPercent,
  startedAt,
  status,
  workflowInstanceId,
  workflowType,
}: {
  completedAt?: Date | null;
  currentStage?: MediaProcessingStage | string;
  errorCode?: null | string;
  errorMessage?: null | string;
  output?: unknown;
  progressPercent?: number;
  startedAt?: Date | null;
  status?: MediaJobStatus;
  workflowInstanceId: string;
  workflowType: MediaWorkflowType;
}): Promise<void> => {
  if (!isDatabaseConfigured()) {
    return;
  }

  await createDb()
    .update(mediaProcessingJobs)
    .set({
      completedAt,
      currentStage,
      errorCode,
      errorMessage,
      output,
      progressPercent:
        progressPercent === undefined ? undefined : String(progressPercent),
      startedAt,
      status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaProcessingJobs.workflowType, workflowType),
        eq(mediaProcessingJobs.workflowInstanceId, workflowInstanceId)
      )
    );
};

export const ensureMediaProcessingWorkflow = ({
  payload,
  workflow,
}: {
  payload: MediaProcessingWorkflowPayload;
  workflow: null | Workflow<MediaProcessingWorkflowPayload> | undefined;
}): Promise<EnsureWorkflowResult> => {
  const workflowInstanceId = mediaProcessingWorkflowInstanceId(payload);

  return ensureWorkflowInstance({
    jobInput: {
      input: payload,
      mode: payload.mode,
      pipelineVersion: payload.pipelineVersion,
      sourceAssetId: payload.sourceAssetId,
      trackId: payload.trackId,
      workflowInstanceId,
      workflowType: "media_processing",
    },
    payload,
    workflow,
  });
};

export const ensureTrackEnrichmentWorkflow = ({
  payload,
  workflow,
}: {
  payload: TrackEnrichmentWorkflowPayload;
  workflow: null | Workflow<TrackEnrichmentWorkflowPayload> | undefined;
}): Promise<EnsureWorkflowResult> => {
  const workflowInstanceId = trackEnrichmentWorkflowInstanceId(payload);

  return ensureWorkflowInstance({
    jobInput: {
      input: payload,
      mode: "final_track",
      pipelineVersion: payload.pipelineVersion,
      sourceAssetId: payload.sourceAssetId,
      trackId: payload.trackId,
      workflowInstanceId,
      workflowType: "track_enrichment",
    },
    payload,
    workflow,
  });
};

export const ensureMediaProcessingWorkflowBatch = async ({
  payloads,
  workflow,
}: {
  payloads: MediaProcessingWorkflowPayload[];
  workflow: null | Workflow<MediaProcessingWorkflowPayload> | undefined;
}) => {
  if (payloads.length === 0 || payloads.length > 100) {
    throw new Error(
      "Media Workflow batches must contain between 1 and 100 jobs."
    );
  }
  const jobs = payloads.map((payload) => ({
    input: {
      input: payload,
      mode: payload.mode,
      pipelineVersion: payload.pipelineVersion,
      sourceAssetId: payload.sourceAssetId,
      trackId: payload.trackId,
      workflowInstanceId: mediaProcessingWorkflowInstanceId(payload),
      workflowType: "media_processing" as const,
    },
    payload,
  }));
  await Promise.all(jobs.map((job) => persistQueuedJob(job.input)));
  if (!workflow) {
    await Promise.all(
      jobs.map((job) =>
        markLaunchFailed({
          error: new Error("Media Workflow binding is unavailable."),
          workflowInstanceId: job.input.workflowInstanceId,
          workflowType: "media_processing",
        })
      )
    );
    return { created: 0, requested: jobs.length };
  }

  const created = await workflow.createBatch(
    jobs.map((job) => ({
      id: job.input.workflowInstanceId,
      params: job.payload,
      retention: {
        errorRetention: "30 days",
        successRetention: "30 days",
      },
    }))
  );
  const createdIds = new Set(created.map((instance) => instance.id));
  for (const job of jobs) {
    if (createdIds.has(job.input.workflowInstanceId)) {
      continue;
    }
    const instance = await workflow.get(job.input.workflowInstanceId),
      status = await instance.status();
    if (status.status === "errored" || status.status === "terminated") {
      await instance.restart();
    }
  }
  return { created: created.length, requested: jobs.length };
};

export const ensureTrackEnrichmentWorkflowBatch = async ({
  payloads,
  workflow,
}: {
  payloads: TrackEnrichmentWorkflowPayload[];
  workflow: null | Workflow<TrackEnrichmentWorkflowPayload> | undefined;
}) => {
  if (payloads.length === 0 || payloads.length > 100) {
    throw new Error(
      "Enrichment Workflow batches must contain between 1 and 100 jobs."
    );
  }
  const jobs = payloads.map((payload) => ({
    input: {
      input: payload,
      mode: "final_track" as const,
      pipelineVersion: payload.pipelineVersion,
      sourceAssetId: payload.sourceAssetId,
      trackId: payload.trackId,
      workflowInstanceId: trackEnrichmentWorkflowInstanceId(payload),
      workflowType: "track_enrichment" as const,
    },
    payload,
  }));
  await Promise.all(jobs.map((job) => persistQueuedJob(job.input)));
  if (!workflow) {
    await Promise.all(
      jobs.map((job) =>
        markLaunchFailed({
          error: new Error("Enrichment Workflow binding is unavailable."),
          workflowInstanceId: job.input.workflowInstanceId,
          workflowType: "track_enrichment",
        })
      )
    );
    return { created: 0, requested: jobs.length };
  }
  const created = await workflow.createBatch(
    jobs.map((job) => ({
      id: job.input.workflowInstanceId,
      params: job.payload,
      retention: {
        errorRetention: "30 days",
        successRetention: "30 days",
      },
    }))
  );
  return { created: created.length, requested: jobs.length };
};

export const ensureMediaRetentionWorkflow = ({
  payload,
  workflow,
}: {
  payload: MediaRetentionWorkflowPayload;
  workflow: null | Workflow<MediaRetentionWorkflowPayload> | undefined;
}): Promise<EnsureWorkflowResult> => {
  const workflowInstanceId = mediaRetentionWorkflowInstanceId(payload);

  return ensureWorkflowInstance({
    jobInput: {
      input: payload,
      pipelineVersion: 1,
      trackId: payload.trackId,
      workflowInstanceId,
      workflowType: "media_retention",
    },
    payload,
    workflow,
  });
};

export const ensureProjectExportWorkflow = ({
  payload,
  workflow,
}: {
  payload: ProjectExportWorkflowPayload;
  workflow: null | Workflow<ProjectExportWorkflowPayload> | undefined;
}): Promise<EnsureWorkflowResult> => {
  const workflowInstanceId = projectExportWorkflowInstanceId(payload);

  return ensureWorkflowInstance({
    jobInput: {
      exportVersion: payload.exportVersion,
      input: payload,
      pipelineVersion: payload.pipelineVersion,
      projectId: payload.projectId,
      workflowInstanceId,
      workflowType: "project_export",
    },
    payload,
    workflow,
  });
};
