/* eslint-disable one-var */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createProjectExportSnapshot } from "./project-export";

const { select, resolveAsset } = vi.hoisted(() => ({
  resolveAsset: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@soundkit/db", () => ({ createDb: () => ({ select }) }));
vi.mock("./track-asset-resolver", () => ({
  resolveTrackAssetFromRows: resolveAsset,
}));

const query = (rows: unknown[]) => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    limit: () => Promise.resolve(rows),
    orderBy: () => Promise.resolve(rows),
    where: () => chain,
  };
  return chain;
};

describe("project export source authorization", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    { deletedAt: null, organizationId: null, ownerUserId: "other" },
    { deletedAt: new Date(), organizationId: null, ownerUserId: "owner" },
    {
      deletedAt: null,
      organizationId: "foreign-workspace",
      ownerUserId: "other",
    },
  ])(
    "rejects unauthorized or deleted source before reading assets: %j",
    async (track) => {
      select
        .mockReturnValueOnce(
          query([
            { exportVersion: 1, organizationId: null, ownerUserId: "owner" },
          ])
        )
        .mockReturnValueOnce(query([{ ...track, trackId: "foreign-track" }]));
      await expect(
        createProjectExportSnapshot({
          exportVersion: 1,
          projectId: "dummy-project",
        })
      ).rejects.toThrow("no longer authorized");
      expect(select).toHaveBeenCalledTimes(2);
      expect(resolveAsset).not.toHaveBeenCalled();
    }
  );

  it("rejects an organization source after the owner's membership is revoked", async () => {
    select
      .mockReturnValueOnce(
        query([
          { exportVersion: 1, organizationId: "team", ownerUserId: "owner" },
        ])
      )
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(
        query([
          {
            deletedAt: null,
            organizationId: "team",
            ownerUserId: "other",
            trackId: "track",
          },
        ])
      );
    await expect(
      createProjectExportSnapshot({
        exportVersion: 1,
        projectId: "dummy-project",
      })
    ).rejects.toThrow("no longer authorized");
    expect(resolveAsset).not.toHaveBeenCalled();
  });
});
