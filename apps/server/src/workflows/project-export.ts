/* eslint-disable one-var, sort-vars */
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { MediaProcessorContainer } from "@/containers/media-processor";
import {
  projectExportWorkflowInstanceId,
  projectExportWorkflowPayloadSchema,
} from "@/lib/media-pipeline";
import type { ProjectExportWorkflowPayload } from "@/lib/media-pipeline";
import { updateMediaProcessingJob } from "@/lib/media-processing-jobs";
import { ContainerMediaProcessor } from "@/lib/media-processor";
import {
  createProjectExportSnapshot,
  findReusableProjectExport,
  markProjectExportProcessing,
  registerProjectExport,
} from "@/lib/project-export";
import { logError, logInfo } from "@/middleware/structured-logging";

const exportRetryConfig = {
  retries: {
    backoff: "exponential" as const,
    delay: "30 seconds" as const,
    limit: 3,
  },
  timeout: "30 minutes" as const,
};

export class ProjectExportWorkflow extends WorkflowEntrypoint<
  Env,
  ProjectExportWorkflowPayload
> {
  public async run(
    event: WorkflowEvent<ProjectExportWorkflowPayload>,
    step: WorkflowStep
  ) {
    const payload = projectExportWorkflowPayloadSchema.parse(event.payload),
      expectedInstanceId = projectExportWorkflowInstanceId(payload);
    if (event.instanceId !== expectedInstanceId) {
      throw new Error(
        "Project Workflow instance ID does not match its payload."
      );
    }
    if (!(this.env.MEDIA_BUCKET && this.env.MEDIA_PROCESSOR)) {
      throw new Error("Project media processor bindings are unavailable.");
    }

    const bucket = this.env.MEDIA_BUCKET,
      processor = new ContainerMediaProcessor({
        binding: this.env
          .MEDIA_PROCESSOR as unknown as DurableObjectNamespace<MediaProcessorContainer>,
        workflowInstanceId: event.instanceId,
      });
    try {
      await step.do("record project export started", async () => {
        await updateMediaProcessingJob({
          currentStage: "snapshotting_project",
          progressPercent: 5,
          startedAt: new Date(),
          status: "running",
          workflowInstanceId: event.instanceId,
          workflowType: "project_export",
        });
        logInfo({
          event: "project_export_started",
          exportVersion: payload.exportVersion,
          projectId: payload.projectId,
          workflowInstanceId: event.instanceId,
        });
      });

      const snapshot = await step.do("snapshot project release context", () =>
        createProjectExportSnapshot({
          exportVersion: payload.exportVersion,
          projectId: payload.projectId,
        })
      );

      for (const track of snapshot.tracks) {
        const stepLabel = String(track.position).padStart(2, "0"),
          reused = await step.do(`reuse project track ${stepLabel}`, async () =>
            Boolean(
              await findReusableProjectExport({
                bucket,
                exportVersion: snapshot.exportVersion,
                projectId: snapshot.projectId,
                sourceAssetId: track.sourceAssetId,
              })
            )
          );
        if (reused) {
          continue;
        }

        await step.do(`mark project track ${stepLabel} processing`, () =>
          markProjectExportProcessing({
            exportVersion: snapshot.exportVersion,
            projectId: snapshot.projectId,
            sourceAssetId: track.sourceAssetId,
            targetObjectKey: track.targetObjectKey,
            uploaderUserId: snapshot.ownerUserId,
          })
        );
        const generated = await step.do(
          `render project track ${stepLabel}`,
          exportRetryConfig,
          () =>
            processor.createDerivative({
              metadata: track.metadata,
              purpose: "project_export",
              sourceObjectKey: track.sourceObjectKey,
              targetObjectKey: track.targetObjectKey,
            })
        );
        await step.do(`register project track ${stepLabel}`, () =>
          registerProjectExport({
            bucket,
            exportVersion: snapshot.exportVersion,
            generated,
            projectId: snapshot.projectId,
            sourceAssetId: track.sourceAssetId,
          })
        );
      }

      await step.do("finalize project export", async () => {
        await updateMediaProcessingJob({
          completedAt: new Date(),
          currentStage: "complete",
          output: {
            exportVersion: snapshot.exportVersion,
            trackCount: snapshot.tracks.length,
          },
          progressPercent: 100,
          status: "ready",
          workflowInstanceId: event.instanceId,
          workflowType: "project_export",
        });
        logInfo({
          event: "project_export_completed",
          exportVersion: snapshot.exportVersion,
          projectId: snapshot.projectId,
          trackCount: snapshot.tracks.length,
          workflowInstanceId: event.instanceId,
        });
      });
      return {
        exportVersion: snapshot.exportVersion,
        status: "ready",
        trackCount: snapshot.tracks.length,
      };
    } catch (error) {
      await step.do("record project export failure", async () => {
        await updateMediaProcessingJob({
          completedAt: new Date(),
          currentStage: "failed",
          errorCode: "PROJECT_EXPORT_FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Project export failed.",
          status: "failed",
          workflowInstanceId: event.instanceId,
          workflowType: "project_export",
        });
        logError({
          error:
            error instanceof Error ? error.message : "Project export failed.",
          event: "project_export_failed",
          exportVersion: payload.exportVersion,
          projectId: payload.projectId,
          workflowInstanceId: event.instanceId,
        });
      });
      throw error;
    }
  }
}
