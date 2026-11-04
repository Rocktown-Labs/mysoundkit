/* oxlint-disable one-var, sort-vars -- Table-driven caller facts and route evidence. */
import { getTableName } from "drizzle-orm";
import type { SQL, Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/lib/types";

import tracksRoutes from "./tracks";

const { select, premium, resolveAsset } = vi.hoisted(() => ({
  premium: vi.fn(),
  resolveAsset: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@soundkit/db", () => ({
  createDb: () => ({ select }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/entitlements", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  resolveEntitlements: premium,
}));
vi.mock("@/lib/track-asset-resolver", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  resolveTrackAsset: resolveAsset,
}));
vi.mock("@/middleware/structured-logging", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

interface Facts {
  buyer?: "direct" | "project";
  collaboration?: "direct" | "project" | "pending" | "rejected";
  deleted?: boolean;
  forSale?: boolean;
  owner?: boolean;
  premium?: boolean;
  public?: boolean;
  viewer?: boolean;
}

const request = (facts: Facts) => {
  const predicates: { sql: string; params: unknown[] }[] = [],
    app = new Hono<AppEnv>(),
    get = vi.fn().mockResolvedValue({
      body: "marker",
      httpEtag: "dummy",
      writeHttpMetadata: vi.fn(),
    }),
    track = {
      deletedAt: facts.deleted ? new Date() : null,
      exclusiveUntil: null,
      id: "track",
      isForSale: facts.forSale ?? true,
      isPublic: facts.public ?? false,
      listeningAccess:
        facts.forSale === false ? "public" : "premium_or_purchased",
      ownerUserId: facts.owner ? "viewer" : "artist",
    };
  premium.mockResolvedValue({ isPremium: facts.premium ?? false });
  select.mockImplementation(() => {
    let table = "",
      joined = false;
    const chain = {
      from(value: Table) {
        table = getTableName(value);
        return chain;
      },
      innerJoin() {
        joined = true;
        return chain;
      },
      limit() {
        let rows: unknown[] = [];
        if (table === "tracks") {
          rows = [track];
        }
        if (
          table === "purchases" &&
          facts.buyer === (joined ? "project" : "direct")
        ) {
          rows = [{ id: "purchase" }];
        }
        if (
          table === "track_collaborators" &&
          facts.collaboration === "direct"
        ) {
          rows = [{ id: "collaboration" }];
        }
        if (table === "project_tracks" && facts.collaboration === "project") {
          rows = [{ id: "project-collaboration" }];
        }
        return Promise.resolve(rows);
      },
      where(predicate: SQL) {
        predicates.push(new PgDialect().sqlToQuery(predicate));
        return chain;
      },
    };
    return chain;
  });
  app.use("*", async (c, next) => {
    c.set("user", facts.viewer === false ? null : { id: "viewer" });
    c.set("session", null);
    return await next();
  });
  app.route("/v1/tracks", tracksRoutes);
  const response = app.request("/v1/tracks/track/playback", undefined, {
    MEDIA_BUCKET: {
      get,
      head: vi.fn().mockResolvedValue({ size: 6 }),
    } as unknown as R2Bucket,
  });
  return { get, predicates, response };
};

describe("guarded track playback caller matrix", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveAsset.mockResolvedValue({
      id: "stream",
      objectKey: "uploads/audio.wav",
      processingVersion: 1,
      purpose: "streaming",
    });
  });
  it.each([
    {
      deleted: true,
      expected: 200,
      label: "owner on deleted content",
      owner: true,
    },
    {
      collaboration: "rejected",
      expected: 403,
      label: "rejected collaborator",
    },
    {
      expected: 200,
      label: "premium listener on public paid content",
      premium: true,
      public: true,
    },
    {
      expected: 403,
      label: "ordinary listener on public paid content",
      public: true,
    },
    {
      collaboration: "project",
      deleted: true,
      expected: 403,
      label: "project collaborator after deletion",
    },
    {
      buyer: "project",
      deleted: true,
      expected: 200,
      label: "project buyer after deletion",
    },
    {
      buyer: "direct",
      expected: 200,
      label: "direct buyer after privacy change",
    },
    {
      buyer: "project",
      expected: 200,
      label: "project buyer after privacy change",
    },
    {
      buyer: "direct",
      deleted: true,
      expected: 200,
      label: "buyer after deletion",
    },
    {
      collaboration: "direct",
      expected: 200,
      label: "accepted direct collaborator",
    },
    {
      collaboration: "project",
      expected: 200,
      label: "accepted project collaborator",
    },
    { collaboration: "pending", expected: 403, label: "pending collaborator" },
    {
      expected: 403,
      label: "premium listener on private content",
      premium: true,
    },
    { expected: 403, label: "anonymous on private content", viewer: false },
    {
      expected: 200,
      forSale: false,
      label: "anonymous on public free content",
      public: true,
      viewer: false,
    },
    {
      deleted: true,
      expected: 403,
      forSale: false,
      label: "public listener after deletion",
      public: true,
      viewer: false,
    },
    { expected: 200, label: "owner on private paid content", owner: true },
  ] satisfies (Facts & { label: string; expected: number })[])(
    "$label",
    async (facts) => {
      const { response, get, predicates } = request(facts),
        result = await response;
      expect(result.status).toBe(facts.expected);
      if (facts.expected === 200) {
        expect(await result.text()).toBe("marker");
        expect(result.headers.get("cache-control")).toBe("private, no-store");
      } else {
        expect(get).not.toHaveBeenCalled();
      }
      if (facts.viewer !== false && !facts.owner) {
        const collaborationPredicates = predicates.filter(
          (entry) =>
            entry.sql.includes('"track_collaborators"') ||
            entry.sql.includes('"project_collaborators"')
        );
        expect(collaborationPredicates).toHaveLength(2);
        for (const predicate of collaborationPredicates) {
          expect(predicate.sql).toContain('"invitation_status"');
          expect(predicate.params).toContain("accepted");
          expect(predicate.params).toContain("viewer");
          expect(predicate.params).toContain("track");
        }
      }
      for (const predicate of predicates.filter((entry) =>
        entry.sql.includes('"invitation_status"')
      )) {
        expect(predicate.params).toContain("accepted");
        expect(predicate.params).toContain("viewer");
      }
    }
  );
});
