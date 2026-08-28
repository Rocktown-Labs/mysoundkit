/* eslint-disable one-var, promise/avoid-new, sort-vars */
import { describe, expect, it, vi } from "vitest";

import { reconcileCollections } from "./mutation-reconciliation";

describe("reconcileCollections", () => {
  it("waits for every collection to read back authoritative state", async () => {
    let resolveFirst: ((value: null) => void) | undefined,
      resolveSecond: ((value: null) => void) | undefined;
    const first = {
        utils: {
          refetch: vi.fn(
            () =>
              new Promise<null>((resolve) => {
                resolveFirst = resolve;
              })
          ),
        },
      },
      second = {
        utils: {
          refetch: vi.fn(
            () =>
              new Promise<null>((resolve) => {
                resolveSecond = resolve;
              })
          ),
        },
      },
      reconciliation = reconcileCollections(first, second);

    expect(first.utils.refetch).toHaveBeenCalledOnce();
    expect(second.utils.refetch).toHaveBeenCalledOnce();

    const settled = { value: false };
    void reconciliation.then(() => {
      settled.value = true;
    });
    resolveFirst?.(null);
    await Promise.resolve();
    expect(settled.value).toBe(false);

    resolveSecond?.(null);
    await expect(reconciliation).resolves.toBeUndefined();
    expect(settled.value).toBe(true);
  });

  it("propagates a failed readback so the optimistic transaction can roll back", async () => {
    const error = new Error("readback failed"),
      collection = {
        utils: {
          refetch: vi.fn().mockRejectedValue(error),
        },
      };

    await expect(reconcileCollections(collection)).rejects.toBe(error);
  });
});
