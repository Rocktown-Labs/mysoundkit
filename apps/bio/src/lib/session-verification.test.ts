/* eslint-disable one-var, sort-vars */
import { afterEach, expect, test, vi } from "vitest";

import { verifyBioHandoffSession } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("handoff retries transient verification failures before accepting a session", async () => {
  vi.useFakeTimers();
  const transport = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(
      Response.json({ accountType: "fan", id: "fixture-user" })
    );
  vi.stubGlobal("fetch", transport);
  const result = verifyBioHandoffSession("fixture-token");
  await vi.runAllTimersAsync();
  await expect(result).resolves.toMatchObject({
    accountType: "fan",
    id: "fixture-user",
  });
  expect(transport).toHaveBeenCalledTimes(3);
});

test("handoff rejects an invalid session without retrying", async () => {
  const transport = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", transport);
  await expect(verifyBioHandoffSession("fixture-token")).resolves.toBeNull();
  expect(transport).toHaveBeenCalledTimes(1);
});

test("persistent service failure remains distinct from an invalid session", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
  );
  const result = verifyBioHandoffSession("fixture-token"),
    rejection = expect(result).rejects.toMatchObject({ status: 503 });
  await vi.runAllTimersAsync();
  await rejection;
});
