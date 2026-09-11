import { describe, expect, it, vi } from "vitest";

import { isRetryableError, withRetry } from "./retry";

describe("retry utilities", () => {
  it("classifies transient status codes as retryable", () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
  });

  it("classifies transient causes wrapped by database errors as retryable", () => {
    const cause = Object.assign(new Error("connection reset"), {
        code: "ECONNRESET",
      }),
      error = Object.assign(new Error("Failed query"), { cause });

    expect(isRetryableError(error)).toBe(true);
  });

  it("retries retryable failures before returning success", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("rate limit"), { status: 429 })
      )
      .mockResolvedValue("ok");

    await expect(
      withRetry("test operation", operation, {
        baseDelayMs: 1,
        maxDelayMs: 1,
        maxRetries: 2,
      })
    ).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable failures", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error("validation failed"));

    await expect(
      withRetry("test operation", operation, {
        baseDelayMs: 1,
        maxDelayMs: 1,
        maxRetries: 2,
      })
    ).rejects.toThrow("validation failed");

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
