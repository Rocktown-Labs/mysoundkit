import { describe, expect, it } from "vitest";

import { AppError, errorPayload, serializeErrorForLog } from "./errors";

describe("error utilities", () => {
  it("serializes exposed app errors for clients", () => {
    const error = new AppError({
      code: "service_unavailable",
      message: "Uploads are not configured.",
      status: 503,
    });

    expect(errorPayload({ error, requestId: "req_123" })).toEqual({
      code: "service_unavailable",
      message: "Uploads are not configured.",
      requestId: "req_123",
    });
  });

  it("redacts generic errors from client payloads", () => {
    expect(
      errorPayload({
        error: new Error("database password leaked here"),
        requestId: "req_123",
      })
    ).toEqual({
      code: "internal_error",
      message: "Something went wrong. Please try again.",
      requestId: "req_123",
    });
  });

  it("keeps internal metadata for structured logs", () => {
    const serialized = serializeErrorForLog(
      new AppError({
        code: "conflict",
        details: { constraint: "track_assets_storage_object_idx" },
        message: "Duplicate upload.",
        status: 409,
      })
    );

    expect(serialized).toMatchObject({
      code: "conflict",
      details: { constraint: "track_assets_storage_object_idx" },
      message: "Duplicate upload.",
      status: 409,
    });
  });
});
