import { describe, expect, it } from "vitest";

import {
  isRetryableDurableObjectError,
  retryDurableObjectCall,
} from "./durable-object-retry";

describe("durable object retry", () => {
  it("recognizes inactive Durable Object connection errors", () => {
    expect(
      isRetryableDurableObjectError(
        new Error(
          "Connection closed: this Durable Object instance is no longer active. Reconnect or retry the request."
        )
      )
    ).toBe(true);
  });

  it("retries an inactive Durable Object call", async () => {
    let attempts = 0;

    await expect(
      retryDurableObjectCall(
        async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error(
              "Connection closed: this Durable Object instance is no longer active."
            );
          }
          return "reconnected";
        },
        { baseDelayMs: 0, maxAttempts: 2 }
      )
    ).resolves.toBe("reconnected");
    expect(attempts).toBe(2);
  });
});
