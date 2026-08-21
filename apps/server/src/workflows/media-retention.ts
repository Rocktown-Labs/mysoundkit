/* eslint-disable one-var, sort-vars */
import { createDb } from "@soundkit/db";
import { purchases, trackAssets, tracks } from "@soundkit/db/schema/app";
import { and, eq } from "drizzle-orm";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import {
  mediaRetentionWorkflowInstanceId,
  mediaRetentionWorkflowPayloadSchema,
} from "@/lib/media-pipeline";
import type { MediaRetentionWorkflowPayload } from "@/lib/media-pipeline";
import { updateMediaProcessingJob } from "@/lib/media-processing-jobs";
import { logInfo } from "@/middleware/structured-logging";

export class MediaRetentionWorkflow extends WorkflowEntrypoint<
  Env,
  MediaRetentionWorkflowPayload
> {
  public async run(
    event: WorkflowEvent<MediaRetentionWorkflowPayload>,
    step: WorkflowStep
  ) {
    const payload = mediaRetentionWorkflowPayloadSchema.parse(event.payload),
      expectedInstanceId = mediaRetentionWorkflowInstanceId(payload);
    if (event.instanceId !== expectedInstanceId) {
      throw new Error("Retention Workflow instance ID does not match payload.");
    }
    if (!this.env.MEDIA_BUCKET) {
      throw new Error("MEDIA_BUCKET is required for media retention.");
    }

    await step.sleepUntil("wait for recovery period", new Date(payload.purgeAfter));
    const retention = await step.do("recheck deletion retention", async () => {
      const db = createDb(),
        [track] = await db
          .select({ deletedAt: tracks.deletedAt, purgeAfter: tracks.purgeAfter })
          .from(tracks)
          .where(eq(tracks.id, payload.trackId))
          .limit(1);
      if (
        !track?.deletedAt ||
        track.deletedAt.toISOString() !== payload.deletedAt ||
        !track.purgeAfter ||
        track.purgeAfter.getTime() > Date.now()
      ) {
        return { active: false, hasPurchases: false };
      }
      const [purchase] = await db
        .select({ id: purchases.id })
        .from(purchases)
        .where(eq(purchases.trackId, payload.trackId))
        .limit(1);
      return { active: true, hasPurchases: Boolean(purchase) };
    });
    if (!retention.active) {
      await step.do("record retention canceled", () =>
        updateMediaProcessingJob({
          completedAt: new Date(),
          currentStage: "recovered",
          output: { recovered: true },
          progressPercent: 100,
          status: "ready",
          workflowInstanceId: event.instanceId,
          workflowType: "media_retention",
        })
      );
      return { status: "recovered" };
    }

    const assets = await step.do("snapshot purgeable media", async () => {
      const rows = await createDb()
        .select({
          id: trackAssets.id,
          objectKey: trackAssets.objectKey,
          purpose: trackAssets.purpose,
        })
        .from(trackAssets)
        .where(eq(trackAssets.trackId, payload.trackId));
      return rows.filter(
        (asset) =>
          !retention.hasPurchases ||
          (asset.purpose !== "download" &&
            asset.purpose !== "lossless_download")
      );
    });

    for (const asset of assets) {
      await step.do(`purge media asset ${asset.id}`, async () => {
        if (asset.objectKey) {
          await this.env.MEDIA_BUCKET.delete(asset.objectKey);
        }
        await createDb()
          .update(trackAssets)
          .set({ status: "deleted", updatedAt: new Date() })
          .where(
            and(
              eq(trackAssets.id, asset.id),
              eq(trackAssets.trackId, payload.trackId)
            )
          );
      });
    }

    await step.do("finalize media retention", async () => {
      if (!retention.hasPurchases) {
        await createDb().delete(tracks).where(eq(tracks.id, payload.trackId));
      }
      await updateMediaProcessingJob({
        completedAt: new Date(),
        currentStage: "complete",
        output: {
          hasPurchases: retention.hasPurchases,
          purgedAssets: assets.length,
        },
        progressPercent: 100,
        status: "ready",
        workflowInstanceId: event.instanceId,
        workflowType: "media_retention",
      });
      logInfo({
        event: "media_retention_completed",
        hasPurchases: retention.hasPurchases,
        purgedAssets: assets.length,
        trackId: payload.trackId,
        workflowInstanceId: event.instanceId,
      });
    });
    return {
      hasPurchases: retention.hasPurchases,
      purgedAssets: assets.length,
      status: "complete",
    };
  }
}
