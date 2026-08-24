import { describe, expect, it } from "vitest";

import {
  isUploadIntentTableUnavailable,
  objectKeyFromMediaUrl,
  UploadIntentConflictError,
} from "./upload-intents";

describe("upload intent rollout safety", () => {
  it("recognizes a missing additive table through wrapped database errors", () => {
    expect(
      isUploadIntentTableUnavailable({
        cause: { cause: { code: "42P01" } },
      })
    ).toBe(true);
    expect(isUploadIntentTableUnavailable({ code: "23505" })).toBe(false);
  });

  it("extracts durable object keys from canonical media URLs", () => {
    expect(
      objectKeyFromMediaUrl(
        "https://media.mysoundkit.com/media/uploads/user/creative.webp"
      )
    ).toBe("uploads/user/creative.webp");
    expect(objectKeyFromMediaUrl("https://youtube.com/watch?v=123")).toBeNull();
  });

  it("uses a distinct error for cross-user or cross-entity claims", () => {
    const error = new UploadIntentConflictError(
      "That object is already registered elsewhere."
    );
    expect(error.name).toBe("UploadIntentConflictError");
  });
});
