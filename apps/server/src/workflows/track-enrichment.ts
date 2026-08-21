/* eslint-disable one-var, sort-vars, complexity */
import { createDb } from "@soundkit/db";
import { openVerseListings, tracks } from "@soundkit/db/schema/app";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";

import {
  finalizeTrackEnrichment,
  pollStemSplitJob,
  processTrackAudio,
  saveStemSplitOutput,
  transcribeStemSplitVocals,
} from "@/lib/audio-processing";
import type { StemSplitJobResponse } from "@/lib/audio-processing";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { resolveEntitlements } from "@/lib/entitlements";
import {
  trackEnrichmentWorkflowInstanceId,
  trackEnrichmentWorkflowPayloadSchema,
} from "@/lib/media-pipeline";
import type { TrackEnrichmentWorkflowPayload } from "@/lib/media-pipeline";
import { verifyCurrentMaster } from "@/lib/media-processing";
import { updateMediaProcessingJob } from "@/lib/media-processing-jobs";
import { logError, logInfo } from "@/middleware/structured-logging";

const MAX_STEMSPLIT_POLLS = 120,
  stemSplitSubmissionConfig = {
    retries: {
      delay: "1 second" as const,
      limit: 0,
    },
    timeout: "5 minutes" as const,
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

    try {
      const eligibility = await step.do(
        "verify current master and Premium eligibility",
        async () => {
          await verifyCurrentMaster({
            bucket: this.env.MEDIA_BUCKET,
            objectKey: payload.objectKey,
            sourceAssetId: payload.sourceAssetId,
            trackId: payload.trackId,
          });
          const db = createDb(),
            [track] = await db
              .select({ ownerUserId: tracks.ownerUserId })
              .from(tracks)
              .where(eq(tracks.id, payload.trackId))
              .limit(1);
          if (!track) {
            throw new Error("Track does not exist for enrichment.");
          }
          const [unfinishedOpenVerse] = await db
            .select({ id: openVerseListings.id })
            .from(openVerseListings)
            .where(
              and(
                eq(openVerseListings.trackId, payload.trackId),
                inArray(openVerseListings.status, ["open", "closed"])
              )
            )
            .limit(1);
          if (unfinishedOpenVerse) {
            return { eligible: false, reason: "unfinished_open_verse" };
          }
          const entitlements = await resolveEntitlements({
            session: null,
            user: { id: track.ownerUserId },
          });
          return {
            eligible: entitlements.isPremium,
            reason: entitlements.isPremium ? null : "not_premium",
          };
        }
      );

      if (!eligibility.eligible) {
        await step.do("record enrichment skipped", async () => {
          await updateMediaProcessingJob({
            completedAt: new Date(),
            currentStage: "skipped",
            output: { reason: eligibility.reason },
            progressPercent: 100,
            status: "ready",
            workflowInstanceId: event.instanceId,
            workflowType: "track_enrichment",
          });
          logInfo({
            event:
              eligibility.reason === "not_premium"
                ? "track_enrichment_skipped_not_premium"
                : "track_enrichment_skipped_unfinished_open_verse",
            sourceAssetId: payload.sourceAssetId,
            trackId: payload.trackId,
            workflowInstanceId: event.instanceId,
          });
        });
        return { reason: eligibility.reason, status: "skipped" };
      }

      await step.do("record enrichment started", async () => {
        await updateMediaProcessingJob({
          currentStage: "submitting_stemsplit",
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

      const submittedJob = await step.do(
        "submit StemSplit job once",
        stemSplitSubmissionConfig,
        () => processTrackAudio(payload)
      );
      let currentJob: StemSplitJobResponse = submittedJob;

      for (let pollCount = 0; pollCount < MAX_STEMSPLIT_POLLS; pollCount += 1) {
        if (
          currentJob.status === "COMPLETED" ||
          currentJob.status === "FAILED"
        ) {
          break;
        }
        await step.sleep(
          `wait for StemSplit poll ${pollCount + 1}`,
          "15 seconds"
        );
        currentJob = await step.do(`poll StemSplit ${pollCount + 1}`, () =>
          pollStemSplitJob({
            stemsplitJobId: submittedJob.id,
            trackId: payload.trackId,
          })
        );
      }

      if (currentJob.status === "FAILED") {
        throw new Error(`StemSplit job ${submittedJob.id} failed.`);
      }
      if (currentJob.status !== "COMPLETED") {
        throw new Error(`StemSplit job ${submittedJob.id} timed out.`);
      }

      const vocals = await step.do("register vocal stem", async () => {
        const asset = await saveStemSplitOutput({
          assetId: payload.sourceAssetId,
          job: currentJob,
          output: "vocals",
          trackId: payload.trackId,
        });
        return { assetId: asset?.id ?? null };
      });
      await step.do("register instrumental stem", async () => {
        await saveStemSplitOutput({
          assetId: payload.sourceAssetId,
          job: currentJob,
          output: "instrumental",
          trackId: payload.trackId,
        });
      });
      const lyrics = await step.do("transcribe vocal stem", async () => {
        const revision = await transcribeStemSplitVocals({
          trackId: payload.trackId,
          vocalsAssetId: vocals.assetId,
        });
        return revision ? { id: revision.id, text: revision.text } : null;
      });

      await step.do("finalize track enrichment", async () => {
        await finalizeTrackEnrichment({
          emailQueue,
          job: currentJob,
          lyrics,
          trackId: payload.trackId,
        });
        await updateMediaProcessingJob({
          completedAt: new Date(),
          currentStage: "complete",
          output: {
            lyricsRevisionId: lyrics?.id ?? null,
            stemsplitJobId: currentJob.id,
          },
          progressPercent: 100,
          status: "ready",
          workflowInstanceId: event.instanceId,
          workflowType: "track_enrichment",
        });
        logInfo({
          event: "track_enrichment_completed",
          sourceAssetId: payload.sourceAssetId,
          stemsplitJobId: currentJob.id,
          trackId: payload.trackId,
          workflowInstanceId: event.instanceId,
        });
      });

      return {
        lyricsRevisionId: lyrics?.id ?? null,
        status: "completed",
        stemsplitJobId: currentJob.id,
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
