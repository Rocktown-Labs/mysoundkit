/* eslint-disable one-var */
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/lib/types";

import mediaRoutes from "./media";
import projectRoutes from "./projects";

const { authorizeSource, select } = vi.hoisted(() => ({
  authorizeSource: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@soundkit/db", () => ({
  createDb: () => ({ select }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/project-export-access", () => ({
  isProjectExportSourceAuthorized: authorizeSource,
}));

const query = (rows: unknown[]) => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    limit: () => Promise.resolve(rows),
    where: () => chain,
  };
  return chain;
};

const project = { id: "project", ownerUserId: "owner" };
const asset = {
  assetKind: "release_export",
  id: "export",
  mimeType: "audio/mp4",
  objectKey: "projects/project/exports/audio.m4a",
  sourceAssetId: "source",
  status: "ready",
};

describe("existing generated export readers", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([false, true])(
    "checks the original source on both download paths (authorized=%s)",
    async (authorized) => {
      authorizeSource.mockResolvedValue(authorized);
      const app = new Hono<AppEnv>(),
        get = vi.fn().mockResolvedValue({
          body: "marker",
          httpEtag: "dummy",
          size: 6,
          uploaded: new Date(),
          writeHttpMetadata: vi.fn(),
        });
      app.use("*", async (c, next) => {
        c.set("user", { id: "owner" });
        return await next();
      });
      app.route("/v1/projects", projectRoutes);
      app.route("/media", mediaRoutes);

      // Project ownership is valid in both cases; it must not authorize foreign source audio.
      select
        .mockReturnValueOnce(query([project]))
        .mockReturnValueOnce(query([asset]))
        .mockReturnValueOnce(query([]))
        .mockReturnValueOnce(query([]));
      const download = await app.request(
        "/v1/projects/project/assets/export/download",
        undefined,
        { MEDIA_BUCKET: { get } as unknown as R2Bucket }
      );
      expect(download.status).toBe(authorized ? 200 : 404);
      if (authorized) {
        expect(await download.text()).toBe("marker");
      } else {
        expect(get).not.toHaveBeenCalled();
      }

      get.mockClear();
      select
        .mockReturnValueOnce(query([]))
        .mockReturnValueOnce(query([{ asset, project }]))
        .mockReturnValueOnce(query([]));
      const media = await app.request(`/media/${asset.objectKey}`, undefined, {
        MEDIA_BUCKET: { get } as unknown as R2Bucket,
      });
      expect(media.status).toBe(authorized ? 200 : 403);
      if (authorized) {
        expect(await media.text()).toBe("marker");
      } else {
        expect(get).not.toHaveBeenCalled();
      }
      expect(authorizeSource).toHaveBeenCalledTimes(2);
      expect(authorizeSource).toHaveBeenCalledWith({
        projectId: "project",
        sourceAssetId: "source",
      });
    }
  );
});
