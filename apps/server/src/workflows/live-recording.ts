import { createDb } from "@soundkit/db";
import { liveExperiences } from "@soundkit/db/schema/app";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import {
  canPublishBattleReplay,
  loadLiveExperienceById,
  publishExperienceRecordingAsVideo,
} from "@/lib/live-experience-events";

export interface LiveRecordingWorkflowPayload {
  experienceId: string;
  recordingUrl: string;
}

export class LiveRecordingWorkflow extends WorkflowEntrypoint<
  Env,
  LiveRecordingWorkflowPayload
> {
  public async run(
    event: WorkflowEvent<LiveRecordingWorkflowPayload>,
    step: WorkflowStep
  ) {
    await step.sleep("wait for replay release window", "1 hour");

    return step.do("publish live replay", async () => {
      const experience = await loadLiveExperienceById(
        event.payload.experienceId
      );
      if (!experience) {
        throw new Error("Live experience no longer exists.");
      }

      if (
        experience.kind === "battle" &&
        experience.battleId &&
        !(await canPublishBattleReplay({
          battleId: experience.battleId,
          startedAt: experience.startedAt,
        }))
      ) {
        return {
          experienceId: experience.id,
          skipped: "battle_did_not_reach_a_turn",
        };
      }

      const recordingUrl =
        experience.recordingUrl ?? event.payload.recordingUrl;
      if (!recordingUrl) {
        throw new Error("Recording URL is not available.");
      }

      const videoId = await publishExperienceRecordingAsVideo({
        experience,
        recordingUrl,
      });
      if (!videoId) {
        throw new Error("Live replay publication failed.");
      }

      await createDb()
        .update(liveExperiences)
        .set({ replayPublishedAt: new Date(), updatedAt: new Date() })
        .where(eq(liveExperiences.id, experience.id));

      return { experienceId: experience.id, videoId };
    });
  }
}
