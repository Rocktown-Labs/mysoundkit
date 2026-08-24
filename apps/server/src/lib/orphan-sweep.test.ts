/* eslint-disable sort-vars */
import { describe, expect, it, vi } from "vitest";

import { listLegacyOrphanCandidates } from "./orphan-sweep";

const oldDate = new Date("2026-01-01T00:00:00.000Z"),
  recentDate = new Date("2026-02-01T00:00:00.000Z"),
  cutoff = new Date("2026-01-15T00:00:00.000Z");

describe("orphan upload listing", () => {
  it("follows every R2 cursor instead of stopping at 500 objects", async () => {
    const list = vi
        .fn()
        .mockResolvedValueOnce({
          cursor: "page-2",
          objects: [
            { key: "tracks/user/orphan.wav", uploaded: oldDate },
            { key: "untracked/system.txt", uploaded: oldDate },
          ],
          truncated: true,
        })
        .mockResolvedValueOnce({
          objects: [
            { key: "projects/user/orphan.pdf", uploaded: oldDate },
            { key: "profiles/user/recent.jpg", uploaded: recentDate },
          ],
          truncated: false,
        }),
      result = await listLegacyOrphanCandidates({
        bucket: { list },
        cutoff,
      });

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenNthCalledWith(2, {
      cursor: "page-2",
      limit: 500,
    });
    expect(result).toEqual({
      keys: ["tracks/user/orphan.wav", "projects/user/orphan.pdf"],
      scanned: 4,
    });
  });
});
