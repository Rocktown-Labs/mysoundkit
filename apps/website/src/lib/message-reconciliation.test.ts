import { describe, expect, it, vi } from "vitest";

import { removeOptimisticMessage } from "./message-reconciliation";

describe("removeOptimisticMessage", () => {
  it("removes an optimistic message and waits for its transaction", async () => {
    const collection = {
      delete: vi.fn(() => ({
        isPersisted: { promise: Promise.resolve() },
      })),
      has: vi.fn(() => true),
    };

    await removeOptimisticMessage(collection, "local-message");

    expect(collection.has).toHaveBeenCalledWith("local-message");
    expect(collection.delete).toHaveBeenCalledWith("local-message");
  });

  it("does nothing when the optimistic message is already gone", async () => {
    const collection = {
      delete: vi.fn(),
      has: vi.fn(() => false),
    };

    await removeOptimisticMessage(collection, "local-message");

    expect(collection.delete).not.toHaveBeenCalled();
  });
});
