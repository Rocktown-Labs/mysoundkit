/* eslint-disable one-var, sort-vars, complexity */
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { MediaProcessorContainer } from "@/containers/media-processor";
import {
  derivativeObjectKey,
  mediaProcessingWorkflowInstanceId,
  mediaProcessingWorkflowPayloadSchema,
} from "@/lib/media-pipeline";
import type {
  GeneratedMediaPurpose,
  MediaProcessingWorkflowPayload,
} from "@/lib/media-pipeline";
import {
  findReusableDerivative,
  getSoundKitAudioMetadata,
  markDerivativeFailed,
  markDerivativeProcessing,
  markOpenVerseSnippetReady,
  MasterObjectMissingError,
  registerGeneratedDerivative,
  saveSourceInspection,
  verifyCurrentMaster,
} from "@/lib/media-processing";
import { updateMediaProcessingJob } from "@/lib/media-processing-jobs";
import { ContainerMediaProcessor } from "@/lib/media-processor";
import type { MediaClip } from "@/lib/media-processor";
import { MediaProcessorValidationError } from "@/lib/media-processor-errors";
import { handleTrackMediaReady } from "@/lib/release-notifications";
import { logError, logInfo } from "@/middleware/structured-logging";

const derivativeRetryConfig = {
  retries: {
    backoff: "exponential" as const,
    delay: "30 seconds" as const,
    limit: 3,
  },
  timeout: "30 minutes" as const,
};

// Job-state updates go through Hyperdrive to Postgres; without an explicit
// budget a stalled connection hangs the run until the runtime kills it as
// "hung", which is invisible in step telemetry.
const jobStateStepConfig = {
  retries: {
    delay: "10 seconds" as const,
    limit: 2,
  },
  timeout: "2 minutes" as const,
};

// A master that is missing from R2 (e.g. uploaded to a destroyed preview
// bucket) or a stale source asset can never succeed on retry. These are
// handled in-step and returned to the engine as terminal results instead of
// thrown, so the instance completes without burning engine-level retries.
const masterVerifyStepConfig = {
  retries: {
    delay: "5 seconds" as const,
    limit: 0,
  },
  timeout: "2 minutes" as const,
};

type DerivativeState = "failed" | "not_applicable" | "ready";

export class MediaProcessingWorkflow extends WorkflowEntrypoint<
  Env,
  MediaProcessingWorkflowPayload
> {
  public async run(
    event: WorkflowEvent<MediaProcessingWorkflowPayload>,
    step: WorkflowStep
  ) {
    const payload = mediaProcessingWorkflowPayloadSchema.parse(event.payload),
      expectedInstanceId = mediaProcessingWorkflowInstanceId(payload);
    if (event.instanceId !== expectedInstanceId) {
      throw new Error("Media Workflow instance ID does not match its payload.");
    }
    if (!(this.env.MEDIA_BUCKET && this.env.MEDIA_PROCESSOR)) {
      throw new Error("Media processor bindings are unavailable.");
    }

    const processor = new ContainerMediaProcessor({
        binding: this.env
          .MEDIA_PROCESSOR as unknown as DurableObjectNamespace<MediaProcessorContainer>,
        workflowInstanceId: event.instanceId,
      }),
      bucket = this.env.MEDIA_BUCKET,
      statuses: Partial<Record<GeneratedMediaPurpose, DerivativeState>> = {};

    try {
      await step.do(
        "record media processing started",
        jobStateStepConfig,
        async () => {
          await updateMediaProcessingJob({
            currentStage: "verifying_master",
            errorCode: null,
            errorMessage: null,
            progressPercent: 5,
            startedAt: new Date(),
            status: "running",
            workflowInstanceId: event.instanceId,
            workflowType: "media_processing",
          });
          logInfo({
            event: "media_processing_started",
            pipelineVersion: payload.pipelineVersion,
            sourceAssetId: payload.sourceAssetId,
            trackId: payload.trackId,
            workflowInstanceId: event.instanceId,
          });
        }
      );

      const masterVerification = await step.do(
        "verify current master",
        masterVerifyStepConfig,
        async () => {
          try {
            const verified = await verifyCurrentMaster({
              bucket,
              objectKey: payload.objectKey,
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
            });
            return {
              assetId: verified.asset.id,
              ok: true as const,
              uploaderUserId: verified.asset.uploaderUserId,
            };
          } catch (error) {
            return {
              errorCode:
                error instanceof MasterObjectMissingError
                  ? "MASTER_OBJECT_MISSING"
                  : "MEDIA_PROCESSING_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Master verification failed.",
              ok: false as const,
            };
          }
        }
      );

      if (!masterVerification.ok) {
        logError({
          error: masterVerification.message,
          errorCode: masterVerification.errorCode,
          event: "media_processing_failed",
          pipelineVersion: payload.pipelineVersion,
          sourceAssetId: payload.sourceAssetId,
          trackId: payload.trackId,
          workflowInstanceId: event.instanceId,
        });
        await step.do(
          "record terminal media failure",
          jobStateStepConfig,
          async () => {
            await updateMediaProcessingJob({
              completedAt: new Date(),
              currentStage: "failed",
              errorCode: masterVerification.errorCode,
              errorMessage: masterVerification.message,
              output: { statuses },
              status: "failed",
              workflowInstanceId: event.instanceId,
              workflowType: "media_processing",
            });
          }
        );
        // Returning normally marks the instance complete so the Workflows
        // engine does not retry a permanently missing/stale master.
        return { mediaReady: false, statuses };
      }

      const master = {
          id: masterVerification.assetId,
          uploaderUserId: masterVerification.uploaderUserId,
        },
        inspection = await step.do(
          "inspect source technically",
          derivativeRetryConfig,
          () => processor.inspectSource({ sourceObjectKey: payload.objectKey })
        );

      await step.do("record source inspection", jobStateStepConfig, () =>
        updateMediaProcessingJob({
          currentStage: "analyzing_loudness",
          output: { inspection },
          progressPercent: 15,
          workflowInstanceId: event.instanceId,
          workflowType: "media_processing",
        })
      );

      const sourceAnalysis = await step.do(
        "analyze source loudness",
        derivativeRetryConfig,
        () => processor.analyzeLoudness({ sourceObjectKey: payload.objectKey })
      );

      await step.do(
        "register source analysis",
        jobStateStepConfig,
        async () => {
          await saveSourceInspection({
            analysis: sourceAnalysis,
            assetId: master.id,
            inspection,
          });
          await updateMediaProcessingJob({
            currentStage:
              payload.mode === "open_verse_base"
                ? "generating_open_verse_snippet"
                : "generating_streaming",
            output: { inspection, sourceAnalysis },
            progressPercent: 25,
            workflowInstanceId: event.instanceId,
            workflowType: "media_processing",
          });
        }
      );

      const soundKitMetadata = await step.do(
          "load canonical SoundKit metadata",
          () => getSoundKitAudioMetadata(payload.trackId)
        ),
        processDerivative = async ({
          clip,
          purpose,
          required,
        }: {
          clip?: MediaClip;
          purpose: GeneratedMediaPurpose;
          required: boolean;
        }): Promise<DerivativeState> => {
          const targetObjectKey = derivativeObjectKey({
              listingId:
                payload.mode === "open_verse_base"
                  ? payload.openVerse.listingId
                  : undefined,
              pipelineVersion: payload.pipelineVersion,
              purpose,
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
            }),
            reused = await step.do(`reuse ${purpose} derivative`, async () =>
              Boolean(
                await findReusableDerivative({
                  bucket,
                  pipelineVersion: payload.pipelineVersion,
                  purpose,
                  sourceAssetId: payload.sourceAssetId,
                  trackId: payload.trackId,
                })
              )
            );
          if (reused) {
            return "ready";
          }

          await step.do(`mark ${purpose} processing`, async () => {
            await markDerivativeProcessing({
              objectKey: targetObjectKey,
              pipelineVersion: payload.pipelineVersion,
              purpose,
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
              uploaderUserId: master.uploaderUserId,
            });
          });

          try {
            const generation = await step.do(
              `generate ${purpose} derivative`,
              derivativeRetryConfig,
              async () => {
                try {
                  return {
                    generated: await processor.createDerivative({
                      clip,
                      metadata: soundKitMetadata,
                      purpose,
                      sourceObjectKey: payload.objectKey,
                      targetObjectKey,
                    }),
                    ok: true as const,
                  };
                } catch (error) {
                  if (error instanceof MediaProcessorValidationError) {
                    // Cache deterministic validation failures as successful
                    // step output so Workflow retries never rerender them.
                    return {
                      message: error.message,
                      ok: false as const,
                    };
                  }
                  throw error;
                }
              }
            );
            if (!generation.ok) {
              throw new MediaProcessorValidationError(generation.message);
            }
            await step.do(`register ${purpose} derivative`, async () => {
              await registerGeneratedDerivative({
                bucket,
                generated: generation.generated,
                pipelineVersion: payload.pipelineVersion,
                purpose,
                sourceAssetId: payload.sourceAssetId,
                trackId: payload.trackId,
              });
            });
            return "ready";
          } catch (error) {
            await step.do(`record ${purpose} failure`, () =>
              markDerivativeFailed({
                error,
                objectKey: targetObjectKey,
                pipelineVersion: payload.pipelineVersion,
                purpose,
                sourceAssetId: payload.sourceAssetId,
                trackId: payload.trackId,
              })
            );
            if (required) {
              throw error;
            }
            return "failed";
          }
        };

      if (payload.mode === "open_verse_base") {
        statuses.open_verse_snippet = await processDerivative({
          clip: {
            endMs: payload.openVerse.slotEndsAtMs,
            startMs: payload.openVerse.slotStartsAtMs,
          },
          purpose: "open_verse_snippet",
          required: true,
        });
        await step.do("connect Open Verse snippet", async () => {
          await markOpenVerseSnippetReady({
            listingId: payload.openVerse.listingId,
            sourceAssetId: payload.sourceAssetId,
            trackId: payload.trackId,
          });
        });
        await step.do(
          "complete Open Verse base media",
          jobStateStepConfig,
          async () => {
            await updateMediaProcessingJob({
              completedAt: new Date(),
              currentStage: "complete",
              output: { inspection, sourceAnalysis, statuses },
              progressPercent: 100,
              status: "ready",
              workflowInstanceId: event.instanceId,
              workflowType: "media_processing",
            });
            logInfo({
              event: "open_verse_snippet_completed",
              pipelineVersion: payload.pipelineVersion,
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
              workflowInstanceId: event.instanceId,
            });
          }
        );
        return { mediaReady: true, statuses };
      }

      statuses.streaming = await processDerivative({
        purpose: "streaming",
        required: true,
      });
      // Battle playback resolves the same normalized streaming derivative.
      statuses.battle = "ready";
      await step.do("mark media ready", jobStateStepConfig, async () => {
        await updateMediaProcessingJob({
          currentStage: "media_ready",
          output: { inspection, mediaReady: true, sourceAnalysis, statuses },
          progressPercent: 50,
          workflowInstanceId: event.instanceId,
          workflowType: "media_processing",
        });
        await handleTrackMediaReady({
          emailQueue: this.env.EMAIL_DELIVERY_QUEUE,
          trackId: payload.trackId,
        });
        logInfo({
          event: "media_ready",
          pipelineVersion: payload.pipelineVersion,
          sourceAssetId: payload.sourceAssetId,
          trackId: payload.trackId,
          workflowInstanceId: event.instanceId,
        });
      });

      statuses.download = await processDerivative({
        purpose: "download",
        required: false,
      });
      statuses.lossless_download = inspection.isLossless
        ? await processDerivative({
            purpose: "lossless_download",
            required: false,
          })
        : "not_applicable";

      const hasPartialFailure = Object.values(statuses).includes("failed");
      await step.do(
        "finalize media processing",
        jobStateStepConfig,
        async () => {
          await updateMediaProcessingJob({
            completedAt: new Date(),
            currentStage: "complete",
            output: {
              inspection,
              mediaReady: true,
              processingComplete: true,
              sourceAnalysis,
              statuses,
            },
            progressPercent: 100,
            status: hasPartialFailure ? "partial" : "ready",
            workflowInstanceId: event.instanceId,
            workflowType: "media_processing",
          });
          logInfo({
            event: "media_processing_completed",
            pipelineVersion: payload.pipelineVersion,
            sourceAssetId: payload.sourceAssetId,
            status: hasPartialFailure ? "partial" : "ready",
            trackId: payload.trackId,
            workflowInstanceId: event.instanceId,
          });
        }
      );

      return {
        mediaReady: true,
        processingComplete: true,
        statuses,
      };
    } catch (error) {
      await step.do("record terminal media failure", async () => {
        const isMissingMaster = error instanceof MasterObjectMissingError;
        await updateMediaProcessingJob({
          completedAt: new Date(),
          currentStage: "failed",
          errorCode: isMissingMaster
            ? "MASTER_OBJECT_MISSING"
            : "MEDIA_PROCESSING_FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Media processing failed.",
          output: { statuses },
          status: "failed",
          workflowInstanceId: event.instanceId,
          workflowType: "media_processing",
        });
        logError({
          error:
            error instanceof Error ? error.message : "Media processing failed.",
          errorCode: isMissingMaster
            ? "MASTER_OBJECT_MISSING"
            : "MEDIA_PROCESSING_FAILED",
          event: "media_processing_failed",
          pipelineVersion: payload.pipelineVersion,
          sourceAssetId: payload.sourceAssetId,
          trackId: payload.trackId,
          workflowInstanceId: event.instanceId,
        });
      });
      throw error;
    }
  }
}
