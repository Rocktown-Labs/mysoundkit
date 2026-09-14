import { describe, expect, it } from "vitest";

import { isScheduledJobsEnabled } from "./scheduled-jobs";

describe("scheduled job gating", () => {
  it("fails closed unless production explicitly enables jobs", () => {
    expect(isScheduledJobsEnabled("true")).toBe(true);
    expect(isScheduledJobsEnabled(undefined)).toBe(false);
    expect(isScheduledJobsEnabled("false")).toBe(false);
    expect(isScheduledJobsEnabled("TRUE")).toBe(false);
  });
});
