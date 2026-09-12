/* eslint-disable one-var */
/* oxlint-disable promise/avoid-new */
import { beforeEach, describe, expect, it, vi } from "vitest";

const poolState = vi.hoisted(() => ({
  end: vi.fn(() => Promise.resolve()),
  options: [] as Record<string, unknown>[],
}));

vi.mock("pg", () => ({
  Pool: vi.fn(
    class MockPool {
      public end = poolState.end;

      public constructor(options: Record<string, unknown>) {
        poolState.options.push(options);
      }
    }
  ),
}));

describe("database pool", () => {
  beforeEach(() => {
    poolState.end.mockClear();
    poolState.options.length = 0;
    process.env.DATABASE_URL =
      "postgres://soundkit_test:soundkit_test@127.0.0.1:5432/soundkit_test";
  });

  it("bounds Hyperdrive connection and query waits", async () => {
    const { createDb, runWithDatabaseScope } = await import("./index");

    await runWithDatabaseScope(() => {
      createDb();
      return Promise.resolve();
    });

    expect(poolState.options[0]).toMatchObject({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 5000,
      max: 10,
      query_timeout: 15_000,
      statement_timeout: 12_000,
    });
    expect(poolState.end).toHaveBeenCalledOnce();
  });

  it("reuses a pool within one event and disposes it before the next", async () => {
    const { createDb, runWithDatabaseScope } = await import("./index");
    let firstDatabase: ReturnType<typeof createDb> | undefined;

    await runWithDatabaseScope(() => {
      firstDatabase = createDb();
      expect(createDb()).toBe(firstDatabase);
      return Promise.resolve();
    });

    await runWithDatabaseScope(() => {
      expect(createDb()).not.toBe(firstDatabase);
      return Promise.resolve();
    });

    expect(poolState.options).toHaveLength(2);
    expect(poolState.end).toHaveBeenCalledTimes(2);
  });

  it("waits for event background work before disposing the pool", async () => {
    const { createDb, runWithDatabaseScope } = await import("./index");
    let finishBackgroundWork: (() => void) | undefined;
    const backgroundWork = new Promise<void>((resolve) => {
        finishBackgroundWork = resolve;
      }),
      deferredCleanups: Promise<void>[] = [];

    await runWithDatabaseScope(
      () => {
        createDb();
        return Promise.resolve();
      },
      {
        cleanupBarrier: () => backgroundWork,
        deferCleanup: (cleanup) => deferredCleanups.push(cleanup),
      }
    );

    expect(poolState.end).not.toHaveBeenCalled();
    finishBackgroundWork?.();
    await Promise.all(deferredCleanups);
    expect(poolState.end).toHaveBeenCalledOnce();
  });
});
