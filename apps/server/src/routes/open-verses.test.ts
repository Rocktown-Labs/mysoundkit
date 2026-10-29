/* eslint-disable one-var */
import { openVerseSubmissions } from "@soundkit/db/schema/app";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/lib/types";

import openVerseRoutes from "./open-verses";

const { claim, complete, Conflict, head, insert, select } = vi.hoisted(() => ({
  Conflict: class extends Error {},
  claim: vi.fn(),
  complete: vi.fn(),
  head: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@soundkit/db", () => ({
  createDb: () => ({ insert, select }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/upload-intents", () => ({
  UploadIntentConflictError: Conflict,
  claimUploadIntent: claim,
  completeUploadIntent: complete,
  recordUploadIntent: vi.fn(),
}));

const query = (rows: unknown[]) => {
  const filtered = Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => filtered,
  };
  return chain;
};

const body = {
  audition: { assetObjectKey: "uploads/submitter/audition.wav" },
  vocalStem: { assetObjectKey: "tracks/submitter/vocal.wav" },
};
const request = (payload: unknown, storage = true) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("user", { id: "submitter" });
    return await next();
  });
  app.route("/v1/open-verses", openVerseRoutes);
  return app.request(
    "/v1/open-verses/listing/submissions",
    {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    storage ? { MEDIA_BUCKET: { head } as unknown as R2Bucket } : {}
  );
};

describe("Open Verse submission upload provenance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    select
      .mockReturnValue(query([]))
      .mockReturnValueOnce(query([{ accountType: "artist" }]))
      .mockReturnValueOnce(
        query([{ accessMode: "open", trackId: "listing-owner-track" }])
      )
      .mockReturnValueOnce(query([{ count: 1 }]))
      .mockReturnValueOnce(query([{ count: 0 }]));
    claim.mockResolvedValue(true);
    complete.mockResolvedValue(true);
    head.mockResolvedValue({
      httpMetadata: { contentType: "audio/wav" },
      size: 64,
    });
  });

  it.each(["audition", "vocalStem", "adlibs"])(
    "rejects a foreign key in %s before claiming or writing assets",
    async (field) => {
      const response = await request({
        ...body,
        [field]: { assetObjectKey: "uploads/someone-else/private.wav" },
      });
      expect(response.status).toBe(403);
      expect(claim).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    }
  );

  it("rejects a presigned upload that has not reached storage", async () => {
    head.mockResolvedValueOnce(null);
    const response = await request(body);
    expect(response.status).toBe(400);
    expect(claim).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed when upload storage is unavailable", async () => {
    const response = await request(body, false);
    expect(response.status).toBe(503);
    expect(claim).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an own-prefix key without a verified upload intent", async () => {
    claim.mockResolvedValue(false);
    const response = await request(body);
    expect(response.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("reserves all inputs before writing any asset, including a conflicting second file", async () => {
    claim
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Conflict("already registered"));
    const response = await request(body);
    expect(response.status).toBe(403);
    expect(claim).toHaveBeenCalledTimes(2);
    expect(insert).not.toHaveBeenCalled();
  });

  it("binds valid claims and completed registrations to the submitter and listing track", async () => {
    const writes: Record<string, unknown>[] = [];
    insert.mockImplementation((table) => ({
      values: (value: Record<string, unknown>) => {
        if (table === openVerseSubmissions) {
          return {
            onConflictDoUpdate: () => ({
              returning: () =>
                Promise.resolve([
                  { ...value, createdAt: new Date(), status: "submitted" },
                ]),
            }),
          };
        }
        writes.push(value);
        return { returning: () => Promise.resolve([{ id: value.id }]) };
      },
    }));
    const response = await request(body);
    expect(response.status).toBe(201);
    expect(writes).toHaveLength(2);
    for (const asset of [body.audition, body.vocalStem]) {
      const expected = {
        entityId: "listing-owner-track",
        entityType: "track_asset",
        objectKey: asset.assetObjectKey,
        userId: "submitter",
      };
      expect(claim).toHaveBeenCalledWith(expected);
      expect(complete).toHaveBeenCalledWith(expected);
    }
    for (const asset of writes) {
      expect(asset).toMatchObject({
        mimeType: "audio/wav",
        sizeBytes: 64,
        trackId: "listing-owner-track",
        uploaderUserId: "submitter",
      });
    }
  });
});
