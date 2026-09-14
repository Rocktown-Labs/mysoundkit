/* eslint-disable one-var, sort-vars, complexity */
import { createDb } from "@soundkit/db";
import { openVerseListings } from "@soundkit/db/schema/app";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";

import type { StemSeparatorContainer } from "@/containers/stem-separator";
import {
  demucsTargetKeys,
  finalizeTrackEnrichment,
  findCurrentDemucsStems,
  saveDemucsStemAsset,
  transcribeDemucsVocals,
} from "@/lib/audio-processing";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import {
  trackEnrichmentWorkflowInstanceId,
  trackEnrichmentWorkflowPayloadSchema,
} from "@/lib/media-pipeline";
import type { TrackEnrichmentWorkflowPayload } from "@/lib/media-pipeline";
import {
  MasterObjectMissingError,
  verifyCurrentMaster,
} from "@/lib/media-processing";
import { updateMediaProcessingJob } from "@/lib/media-processing-jobs";
import { ContainerStemSeparator } from "@/lib/stem-separator";
import { logError, logInfo } from "@/middleware/structured-logging";

const separationStepConfig = {
    retries: {
      delay: "1 second" as const,
      limit: 0,
    },
    // htdemucs on CPU runs ~1.5x track duration plus download, two FFmpeg
    // transcodes, and uploads inside the same container request.
    timeout: "30 minutes" as const,
  },
  transcriptionStepConfig = {
    retries: {
      delay: "10 seconds" as const,
      limit: 1,
    },
    timeout: "10 minutes" as const,
  },
  // A missing/stale master can never succeed on retry, so verification
  // failures are returned to the engine as terminal results.
  masterVerifyStepConfig = {
    retries: {
      delay: "5 seconds" as const,
      limit: 0,
    },
    timeout: "2 minutes" as const,
  },
  jobStateStepConfig = {
    retries: {
      delay: "10 seconds" as const,
      limit: 2,
    },
    timeout: "2 minutes" as const,
  };

export class TrackEnrichmentWorkflow extends WorkflowEntrypoint<
  Env,
  TrackEnrichmentWorkflowPayload
> {
  public async run(
    event: WorkflowEvent<TrackEnrichmentWorkflowPayload>,
    step: WorkflowStep
  ) {
    const payload = trackEnrichmentWorkflowPayloadSchema.parse(event.payload),
      expectedInstanceId = trackEnrichmentWorkflowInstanceId(payload),
      emailQueue = (
        this.env as { EMAIL_DELIVERY_QUEUE?: Queue<EmailDeliveryQueueMessage> }
      ).EMAIL_DELIVERY_QUEUE;
    if (event.instanceId !== expectedInstanceId) {
      throw new Error(
        "Enrichment Workflow instance ID does not match its payload."
      );
    }
    if (!this.env.MEDIA_BUCKET) {
      throw new Error("MEDIA_BUCKET is required for track enrichment.");
    }
    if (!this.env.STEM_SEPARATOR) {
      throw new Error("STEM_SEPARATOR is required for track enrichment.");
    }

    try {
      const masterCheck = await step.do(
        "verify current master",
        masterVerifyStepConfig,
        async () => {
          try {
            await verifyCurrentMaster({
              bucket: this.env.MEDIA_BUCKET,
              objectKey: payload.objectKey,
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
            });
            return { ok: true as const };
          } catch (error) {
            return {
              errorCode:
                error instanceof MasterObjectMissingError
                  ? "MASTER_OBJECT_MISSING"
                  : "TRACK_ENRICHMENT_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Master verification failed.",
              ok: false as const,
            };
          }
        }
      );

      if (!masterCheck.ok) {
        await step.do(
          "record terminal enrichment failure",
          jobStateStepConfig,
          async () => {
            await updateMediaProcessingJob({
              completedAt: new Date(),
              currentStage: "failed",
              errorCode: masterCheck.errorCode,
              errorMessage: masterCheck.message,
              status: "failed",
              workflowInstanceId: event.instanceId,
              workflowType: "track_enrichment",
            });
            logError({
              error: masterCheck.message,
              errorCode: masterCheck.errorCode,
              event: "track_enrichment_failed",
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
              workflowInstanceId: event.instanceId,
            });
          }
        );
        // Returning normally marks the instance complete so the Workflows
        // engine does not retry a permanently missing/stale master.
        return { reason: masterCheck.errorCode, status: "failed" };
      }

      // Open Verse bases mid-collab are skipped: their finals get enriched
      // when the owner uploads the finished master. (No premium gate: every
      // upload enriches while the app is in development.)
      const openVerseGuard = await step.do(
        "check open verse guard",
        jobStateStepConfig,
        async () => {
          const db = createDb(),
            [unfinishedOpenVerse] = await db
              .select({ id: openVerseListings.id })
              .from(openVerseListings)
              .where(
                and(
                  eq(openVerseListings.trackId, payload.trackId),
                  inArray(openVerseListings.status, ["open", "closed"])
                )
              )
              .limit(1);
          return { skipped: Boolean(unfinishedOpenVerse) };
        }
      );

      if (openVerseGuard.skipped) {
        await step.do("record enrichment skipped", async () => {
          await updateMediaProcessingJob({
            completedAt: new Date(),
            currentStage: "skipped",
            output: { reason: "unfinished_open_verse" },
            progressPercent: 100,
            status: "ready",
            workflowInstanceId: event.instanceId,
            workflowType: "track_enrichment",
          });
          logInfo({
            event: "track_enrichment_skipped_unfinished_open_verse",
            sourceAssetId: payload.sourceAssetId,
            trackId: payload.trackId,
            workflowInstanceId: event.instanceId,
          });
        });
        return { reason: "unfinished_open_verse", status: "skipped" };
      }

      await step.do("record enrichment started", async () => {
        await updateMediaProcessingJob({
          currentStage: "separating_stems",
          progressPercent: 5,
          startedAt: new Date(),
          status: "running",
          workflowInstanceId: event.instanceId,
          workflowType: "track_enrichment",
        });
        logInfo({
          event: "track_enrichment_started",
          pipelineVersion: payload.pipelineVersion,
          sourceAssetId: payload.sourceAssetId,
          trackId: payload.trackId,
          workflowInstanceId: event.instanceId,
        });
      });

      // Smart retry: current stems for this exact source mean Demucs already
      // ran — reuse them and only re-run transcription. Both assets are
      // required: the registration step writes them separately, so a vocal
      // alone does not prove separation finished.
      const existingStems = await step.do(
        "check existing stem assets",
        jobStateStepConfig,
        () =>
          findCurrentDemucsStems({
            pipelineVersion: payload.pipelineVersion,
            sourceAssetId: payload.sourceAssetId,
            trackId: payload.trackId,
          })
      );

      const targets = demucsTargetKeys({
          pipelineVersion: payload.pipelineVersion,
          trackId: payload.trackId,
        }),
        jobId = `demucs:${payload.sourceAssetId}:v${payload.pipelineVersion}`;

      let vocalsAssetId: string | null =
        existingStems.vocals && existingStems.instrumental
          ? existingStems.vocals.id
          : null;
      if (vocalsAssetId) {
        await step.do("record stem reuse", async () => {
          await updateMediaProcessingJob({
            currentStage: "transcribing_vocals",
            progressPercent: 60,
            status: "running",
            workflowInstanceId: event.instanceId,
            workflowType: "track_enrichment",
          });
          logInfo({
            event: "track_enrichment_stem_reused",
            sourceAssetId: payload.sourceAssetId,
            trackId: payload.trackId,
            workflowInstanceId: event.instanceId,
          });
        });
      } else {
        const separation = await step.do(
          "separate stems with Demucs",
          separationStepConfig,
          async () => {
            const separator = new ContainerStemSeparator({
              binding: this.env
                .STEM_SEPARATOR as unknown as DurableObjectNamespace<StemSeparatorContainer>,
              workflowInstanceId: event.instanceId,
            });
            const result = await separator.separate({
              sourceObjectKey: payload.objectKey,
              targetInstrumentalKey: targets.instrumentalKey,
              targetVocalsKey: targets.vocalsKey,
            });
            return {
              instrumental: result.instrumental,
              vocals: result.vocals,
            };
          }
        );

        const { vocalsAssetId: separatedVocalsAssetId } = await step.do(
          "register stem assets",
          async () => {
            const vocals = await saveDemucsStemAsset({
              assetKind: "vocal_stem",
              pipelineVersion: payload.pipelineVersion,
              separation: separation.vocals,
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
            });
            await saveDemucsStemAsset({
              assetKind: "instrumental",
              pipelineVersion: payload.pipelineVersion,
              separation: separation.instrumental,
              sourceAssetId: payload.sourceAssetId,
              trackId: payload.trackId,
            });
            return { vocalsAssetId: vocals?.id ?? null };
          }
        );
        vocalsAssetId = separatedVocalsAssetId;
      }

      const lyrics = await step.do(
        "transcribe vocal stem",
        transcriptionStepConfig,
        async () => {
          if (!vocalsAssetId) {
            return null;
          }
          const revision = await transcribeDemucsVocals({
            ai: (this.env as unknown as { AI?: Ai }).AI,
            assetId: vocalsAssetId,
            bucket: this.env.MEDIA_BUCKET,
            trackId: payload.trackId,
          });
          return revision ? { id: revision.id, text: revision.text } : null;
        }
      );

      await step.do("finalize track enrichment", async () => {
        await finalizeTrackEnrichment({
          emailQueue,
          inputAssetId: payload.sourceAssetId,
          jobId,
          lyrics,
          suppressNotifications: payload.quiet ?? false,
          trackId: payload.trackId,
        });
        await updateMediaProcessingJob({
          completedAt: new Date(),
          currentStage: "complete",
          output: {
            lyricsRevisionId: lyrics?.id ?? null,
            separationJobId: jobId,
          },
          progressPercent: 100,
          status: "ready",
          workflowInstanceId: event.instanceId,
          workflowType: "track_enrichment",
        });
        logInfo({
          event: "track_enrichment_completed",
          separationJobId: jobId,
          sourceAssetId: payload.sourceAssetId,
          trackId: payload.trackId,
          workflowInstanceId: event.instanceId,
        });
      });

      return {
        lyricsRevisionId: lyrics?.id ?? null,
        separationJobId: jobId,
        status: "completed",
        trackId: payload.trackId,
      };
    } catch (error) {
      await step.do("record terminal enrichment failure", async () => {
        await updateMediaProcessingJob({
          completedAt: new Date(),
          currentStage: "failed",
          errorCode: "TRACK_ENRICHMENT_FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Enrichment failed.",
          status: "failed",
          workflowInstanceId: event.instanceId,
          workflowType: "track_enrichment",
        });
        logError({
          error: error instanceof Error ? error.message : "Enrichment failed.",
          event: "track_enrichment_failed",
          sourceAssetId: payload.sourceAssetId,
          trackId: payload.trackId,
          workflowInstanceId: event.instanceId,
        });
      });
      throw error;
    }
  }
}
