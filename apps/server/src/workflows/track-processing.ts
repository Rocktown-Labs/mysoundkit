import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { TrackProcessingWorkflowPayload } from "@/lib/audio-processing";
import {
  pollAndFinalizeStemSplitJob,
  processTrackAudio,
} from "@/lib/audio-processing";

const MAX_STEMSPLIT_POLLS = 30;

export class TrackProcessingWorkflow extends WorkflowEntrypoint<
  Env,
  TrackProcessingWorkflowPayload
> {
  async run(
    event: WorkflowEvent<TrackProcessingWorkflowPayload>,
    step: WorkflowStep
  ) {
    void this.env;

    const submittedJob = await step.do("submit stemsplit job", () =>
      processTrackAudio(event.payload)
    );

    let currentJob = submittedJob;

    for (let pollCount = 0; pollCount < MAX_STEMSPLIT_POLLS; pollCount += 1) {
      if (currentJob.status === "COMPLETED" || currentJob.status === "FAILED") {
        break;
      }

      await step.sleep("wait for stemsplit", "15 seconds");
      currentJob = await step.do(`poll stemsplit ${pollCount + 1}`, () =>
        pollAndFinalizeStemSplitJob({
          assetId: event.payload.assetId,
          stemsplitJobId: submittedJob.id,
          trackId: event.payload.trackId,
        })
      );
    }

    if (currentJob.status !== "COMPLETED") {
      throw new Error(`StemSplit job ${submittedJob.id} did not complete.`);
    }

    return {
      status: currentJob.status,
      stemsplitJobId: currentJob.id,
      trackId: event.payload.trackId,
    };
  }
}
