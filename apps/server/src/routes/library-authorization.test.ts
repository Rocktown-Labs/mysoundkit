import type { SQL } from "drizzle-orm";
/* eslint-disable one-var, sort-vars */
import { PgDialect } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/lib/types";

import libraryRoutes from "./library";

const { select, insert, deleteRows, transaction, configured, summary } = vi.hoisted(() => ({
  configured: vi.fn(),
  summary: vi.fn(),
  deleteRows: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
}));
const fakeDb = () => ({ delete: deleteRows, insert, select, transaction });
vi.mock("@soundkit/db", () => ({
  createDb: () => ({ delete: deleteRows, insert, select, transaction }),
  isDatabaseConfigured: () => configured(),
}));
vi.mock("@/lib/dashboard-mappers", () => ({
  buildTrackSummaries: vi.fn(),
  buildTrackSummary: summary,
}));

const query = (rows: unknown[]) => {
  const chain = Object.assign(Promise.resolve(rows), {
    for: vi.fn(() => chain),
    from: () => chain,
    innerJoin: () => chain,
    limit: () => chain,
    orderBy: () => chain,
    returning: () => chain,
    where: vi.fn((_predicate: SQL | undefined) => chain),
  });
  return chain;
};
const request = (
  path: string,
  method: string,
  userId: string | null,
  body?: unknown
) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("user", userId ? { id: userId } : null);
    return await next();
  });
  app.route("/v1/library", libraryRoutes);
  return app.request(`/v1/library${path}`, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });
};
const mutations = [
  {
    body: { trackId: "track" },
    method: "POST",
    path: "/playlists/private/tracks",
  },
  { method: "DELETE", path: "/playlists/private/tracks/track" },
  { method: "DELETE", path: "/playlists/private" },
];

describe("playlist and library authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    configured.mockReturnValue(true);
    transaction.mockImplementation(
      async (run: (tx: ReturnType<typeof fakeDb>) => Promise<unknown>) =>
        await run(fakeDb())
    );
  });
  it.each(mutations)(
    "requires identity before $method $path",
    async ({ method, path, body }) => {
      const response = await request(path, method, null, body);
      expect(response.status).toBe(401);
      expect(select).not.toHaveBeenCalled();
      expect(deleteRows).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    }
  );
  it.each(mutations.slice(0, 2))(
    "rejects another owner's $method $path",
    async ({ method, path, body }) => {
      select.mockReturnValue(
        query([{ id: "private", ownerUserId: "owner-a" }])
      );
      const response = await request(path, method, "other-b", body);
      expect(response.status).toBe(404);
      expect(deleteRows).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    }
  );
  it("binds playlist deletion to the owner in the write predicate", async () => {
    const deletion = query([]);
    deleteRows.mockReturnValue(deletion);
    const response = await request("/playlists/private", "DELETE", "other-b");
    expect(response.status).toBe(404);
    const sql = new PgDialect().sqlToQuery(
      deletion.where.mock.calls[0]?.[0] as unknown as SQL
    );
    expect(sql.params).toEqual(["private", "other-b"]);
    expect(sql.sql).toContain('"owner_user_id"');
  });
  it.each([null, "other-b"])("hides private detail from %s", async (userId) => {
    select.mockReturnValue(
      query([{ id: "private", isPublic: false, ownerUserId: "owner-a" }])
    );
    const response = await request("/playlists/private", "GET", userId);
    expect(response.status).toBe(404);
    expect(select).toHaveBeenCalledTimes(1);
  });
  it.each([null, "owner-a"])(
    "preserves public detail or owner reads (%s)",
    async (userId) => {
      const playlist = {
        createdAt: new Date(),
        description: null,
        id: "private",
        isPublic: !userId,
        ownerUserId: "owner-a",
        title: "Visible",
        updatedAt: new Date(),
      };
      const entries = query([]);
      select
        .mockReturnValueOnce(query([playlist]))
        .mockReturnValueOnce(entries);
      const response = await request("/playlists/private", "GET", userId);
      expect(response.status).toBe(200);
      const result = (await response.json()) as { playlist: { title: string } };
      expect(result.playlist.title).toBe("Visible");
      const sql = new PgDialect().sqlToQuery(
        entries.where.mock.calls[0]?.[0] as unknown as SQL
      );
      expect(sql.sql).toContain('"is_public"');
      expect(sql.sql).toContain('"deleted_at"');
      if (userId) {
        expect(sql.sql).toContain('"buyer_user_id"');
        expect(sql.params).toContain(userId);
      }
    }
  );
  it("cannot save an unavailable track without a prior membership", async () => {
    select.mockReturnValue(query([]));
    const response = await request("/saved/private-track", "POST", "other-b");
    expect(response.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });
  it("lets an owner add a readable track while holding the playlist lock", async () => {
    const owned = query([{ id: "private", ownerUserId: "owner-a" }]);
    select
      .mockReturnValueOnce(owned)
      .mockReturnValueOnce(query([{ id: "track" }]));
    const onConflictDoNothing = vi.fn(() => Promise.resolve());
    const values = vi.fn(() => ({ onConflictDoNothing }));
    insert.mockReturnValue({ values });
    const response = await request(
      "/playlists/private/tracks",
      "POST",
      "owner-a",
      { trackId: "track" }
    );
    expect(response.status).toBe(200);
    expect(owned.for).toHaveBeenCalledWith("update");
    expect(values).toHaveBeenCalledWith({
      playlistId: "private",
      trackId: "track",
    });
  });
  it.each(["project purchase", "accepted collaboration"])("preserves saved private metadata authorized by %s", async grant => {
    const rows = query([{savedAt: new Date(),track: {id: "granted", title: "Authorized private track"}}]);
    select.mockReturnValue(rows);
    summary.mockResolvedValue({id: "granted",title: "Authorized private track",artistName: "Owner",artistUsername: "owner",duration: "1:00",coverArtUrl: null,genre: "Hip-Hop",regionSlug: null,slug: "granted"});
    const response = await request("/saved", "GET", "buyer-or-collaborator");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([expect.objectContaining({id: "granted",title: "Authorized private track"})]);
    const policy = new PgDialect().sqlToQuery(rows.where.mock.calls[0]?.[0] as SQL);
    expect(policy.params).toContain("buyer-or-collaborator");
    if (grant === "project purchase") {
      expect(policy.sql).toContain('"project_tracks"');
      expect(policy.sql).toContain('"project_id"');
      expect(policy.sql).toContain('"buyer_user_id"');
    } else {
      expect(policy.sql).toContain('"track_collaborators"');
      expect(policy.sql).toContain('"project_collaborators"');
      expect(policy.sql).toContain("'accepted'");
    }
  });
  it("keeps the known private sample playlist available only to the demo owner", async () => {
    configured.mockReturnValue(false);
    const owner = await request("/playlists/playlist_after_hours", "GET", "user_demo_artist");
    const stranger = await request("/playlists/playlist_after_hours", "GET", "other");
    const unknown = await request("/playlists/arbitrary", "GET", "user_demo_artist");
    expect(owner.status).toBe(200);
    expect(stranger.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(select).not.toHaveBeenCalled();
  });

});
