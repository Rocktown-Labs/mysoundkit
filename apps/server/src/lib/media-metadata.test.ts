import { describe, expect, it } from "vitest";

import { isTrackDurationBackfillQueueName } from "./media-queue";

describe("track duration backfill queue names", () => {
  it("accepts production and suffixed preview queue names", () => {
    expect(
      isTrackDurationBackfillQueueName("soundkit-track-duration-backfill")
    ).toBe(true);
    expect(
      isTrackDurationBackfillQueueName("soundkit-track-duration-backfill-pr-44")
    ).toBe(true);
  });

  it("does not classify the email queue as a duration queue", () => {
    expect(isTrackDurationBackfillQueueName("soundkit-email-delivery")).toBe(
      false
    );
  });
});
