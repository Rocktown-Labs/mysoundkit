/* eslint-disable one-var */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isProjectExportSourceAuthorized } from "./project-export-access";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@soundkit/db", () => ({ createDb: () => ({ select }) }));

const source = {
  deletedAt: null,
  memberId: null,
  objectKey: "tracks/owner/download.m4a",
  projectOrganizationId: null,
  projectOwnerUserId: "owner",
  status: "ready",
  trackOrganizationId: null,
  trackOwnerUserId: "owner",
};

const result = (rows: unknown[]) => {
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    limit: () => Promise.resolve(rows),
    where: () => query,
  };
  return query;
};

describe("current project export source authority", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    { ...source, trackOwnerUserId: "another-owner" },
    { ...source, deletedAt: new Date() },
    { ...source, objectKey: null },
    { ...source, status: "deleted" },
    {
      ...source,
      projectOrganizationId: "team",
      trackOrganizationId: "team",
      trackOwnerUserId: "other",
    },
    {
      ...source,
      memberId: "member",
      projectOrganizationId: "team",
      trackOrganizationId: "foreign-team",
      trackOwnerUserId: "other",
    },
  ])(
    "denies an old export with a revoked or foreign source: %j",
    async (row) => {
      select.mockReturnValue(result([row]));
      expect(
        await isProjectExportSourceAuthorized({
          projectId: "project",
          sourceAssetId: "source",
        })
      ).toBe(false);
    }
  );

  it.each([
    source,
    {
      ...source,
      memberId: "member",
      projectOrganizationId: "team",
      trackOrganizationId: "team",
      trackOwnerUserId: "other",
    },
  ])("preserves an owner or current workspace source: %j", async (row) => {
    select.mockReturnValue(result([row]));
    expect(
      await isProjectExportSourceAuthorized({
        projectId: "project",
        sourceAssetId: "source",
        sourceObjectKey: source.objectKey,
      })
    ).toBe(true);
  });

  it("denies missing provenance and no-longer-linked sources", async () => {
    expect(
      await isProjectExportSourceAuthorized({
        projectId: "project",
        sourceAssetId: null,
      })
    ).toBe(false);
    expect(select).not.toHaveBeenCalled();
    select.mockReturnValue(result([]));
    expect(
      await isProjectExportSourceAuthorized({
        projectId: "project",
        sourceAssetId: "unlinked",
      })
    ).toBe(false);
  });

  it("does not render a key restored from a stale snapshot", async () => {
    select.mockReturnValue(result([source]));
    expect(
      await isProjectExportSourceAuthorized({
        projectId: "project",
        sourceAssetId: "source",
        sourceObjectKey: "tracks/foreign/download.m4a",
      })
    ).toBe(false);
  });
});
