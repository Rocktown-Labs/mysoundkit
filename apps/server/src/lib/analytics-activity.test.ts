/* eslint-disable one-var, sort-vars, require-await, promise/avoid-new, unicorn/no-useless-undefined */
import { describe, expect, it, vi } from "vitest";

import { recordDailyActivity } from "./analytics-activity";

const base = {
  environment: "production",
  now: new Date("2026-11-01T12:00:00Z"),
  origin: "https://api.mysoundkit.com",
  userId: "private-account-id",
};
describe("authenticated activity throttle", () => {
  it("does not hit Postgres for a same-day cache hit", async () => {
    const record = vi.fn(async () => {}),
      cache = {
        match: vi.fn(async () => new Response("1")),
        put: vi.fn(async () => {}),
      };
    await recordDailyActivity({ ...base, cache, record });
    expect(record).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("records before caching and never places raw account IDs in cache keys", async () => {
    const record = vi.fn(async () => {}),
      cache = {
        match: vi.fn(async () => undefined),
        put: vi.fn(async (key: Request, value: Response) => {
          expect(record).toHaveBeenCalledOnce();
          expect(key.url).not.toContain(base.userId);
          expect(value.headers.get("cache-control")).toBe("max-age=900");
        }),
      };
    await recordDailyActivity({ ...base, cache, record });
    expect(cache.put).toHaveBeenCalledOnce();
  });
  it("uses a new key at the UTC day boundary", async () => {
    const entries = new Set<string>(),
      record = vi.fn(async () => {}),
      cache = {
        match: async (key: Request) =>
          entries.has(key.url) ? new Response("1") : undefined,
        put: async (key: Request) => {
          entries.add(key.url);
        },
      };
    await recordDailyActivity({
      ...base,
      cache,
      now: new Date("2026-11-01T23:59:59Z"),
      record,
    });
    await recordDailyActivity({
      ...base,
      cache,
      now: new Date("2026-11-02T00:00:01Z"),
      record,
    });
    expect(record).toHaveBeenCalledTimes(2);
  });
  it("falls back to the database if cache operations fail", async () => {
    const record = vi.fn(async () => {}),
      cache = {
        match: vi.fn(async () => {
          throw new Error("cache unavailable");
        }),
        put: vi.fn(async () => {
          throw new Error("cache unavailable");
        }),
      };
    const onCacheError = vi.fn();
    await recordDailyActivity({ ...base, cache, onCacheError, record });
    expect(onCacheError.mock.calls).toEqual([["match"], ["put"]]);
    expect(record).toHaveBeenCalledOnce();
  });
  it("does not cache an activity record that failed to commit", async () => {
    const record = vi.fn(async () => {
        throw new Error("database unavailable");
      }),
      cache = {
        match: vi.fn(async () => undefined),
        put: vi.fn(async () => {}),
      };
    await expect(
      recordDailyActivity({ ...base, cache, record })
    ).rejects.toThrow("database unavailable");
    expect(cache.put).not.toHaveBeenCalled();
  });
});
