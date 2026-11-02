/* eslint-disable one-var, sort-vars */
import { playbackSessions, tracks } from "@soundkit/db/schema/app";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { playConditionSql } from "./analytics-helpers";
import { artistPlayCountsSql } from "./artist-discovery";

interface PlanNode {
  "Group Key"?: string[];
  "Parent Relationship"?: string;
  Plans?: PlanNode[];
}

function playbackAggregates(node: PlanNode): PlanNode[] {
  const children = node.Plans?.flatMap(playbackAggregates) ?? [];
  return node["Group Key"]?.some((key) => key.includes("tracks.owner_user_id"))
    ? [node, ...children]
    : children;
}

const url = process.env.SOUNDKIT_TEST_DATABASE_URL,
  dialect = new PgDialect();

// Only use an explicitly supplied fixture database, never DATABASE_URL.
describe.skipIf(!url || process.env.SOUNDKIT_DISABLE_DB_TESTS === "true")(
  "artist discovery grouped playback counts",
  () => {
    const client = new Client({ connectionString: url });
    async function execute(query: SQL) {
      const compiled = dialect.sqlToQuery(query);
      return await client.query(compiled.sql, compiled.params);
    }
    beforeAll(async () => {
      await client.connect();
      await client.query("BEGIN");
      // Temporary tables shadow real tables on this dedicated connection. No
      // shared fixtures or application records are modified.
      await client.query(`
        CREATE TEMP TABLE tracks (id text, owner_user_id text) ON COMMIT DROP;
        CREATE TEMP TABLE playback_sessions (
          id text, track_id text, started_at timestamptz,
          played_seconds integer, risk_status text
        ) ON COMMIT DROP;
        CREATE TEMP TABLE track_assets (
          track_id text, asset_kind text, duration_ms integer
        ) ON COMMIT DROP;
        CREATE TEMP TABLE fixture_artists (
          id text, username text, followers integer, region text
        ) ON COMMIT DROP;
        INSERT INTO fixture_artists VALUES
          ('a', 'alpha', 0, 'tx'), ('b', 'bravo', 0, 'tx'),
          ('c', 'charlie', 0, 'ar'), ('d', 'delta', 0, 'tx');
        INSERT INTO tracks VALUES ('long', 'a'), ('short', 'b'), ('other', 'c');
        INSERT INTO track_assets VALUES
          ('long', 'master', 180000), ('short', 'master', 10000),
          ('short', 'tagged_mp3', 10000);
        INSERT INTO playback_sessions VALUES
          ('recent', 'long', now() - interval '1 day', 30, 'clear'),
          ('old', 'long', now() - interval '8 days', 30, 'clear'),
          ('held', 'long', now(), 90, 'held'),
          ('rejected', 'long', now(), 90, 'rejected'),
          ('unfinished', 'long', now(), 29, 'clear'),
          ('short-pass', 'short', now(), 10, 'clear'),
          ('short-fail', 'short', now(), 9, 'clear'),
          ('other-pass', 'other', now(), 30, 'clear');
      `);
    });
    afterAll(async () => {
      await client.query("ROLLBACK");
      await client.end();
    });

    it("matches correlated counters, including short tracks, risk and zero plays", async () => {
      const result = await execute(sql`
        SELECT a.id,
          coalesce(artist_play_counts.total_plays, 0) AS total,
          coalesce(artist_play_counts.weekly_plays, 0) AS weekly,
          (SELECT count(*)::int FROM ${playbackSessions}
            JOIN ${tracks} ON ${tracks.id} = ${playbackSessions.trackId}
            WHERE ${tracks.ownerUserId} = a.id AND ${playConditionSql}) AS old_total,
          (SELECT count(*)::int FROM ${playbackSessions}
            JOIN ${tracks} ON ${tracks.id} = ${playbackSessions.trackId}
            WHERE ${tracks.ownerUserId} = a.id AND ${playConditionSql}
              AND ${playbackSessions.startedAt} >= now() - interval '7 days') AS old_weekly
        FROM fixture_artists a
        LEFT JOIN ${artistPlayCountsSql} ON artist_play_counts.artist_id = a.id
        ORDER BY a.id
      `);
      expect(result.rows).toEqual([
        { id: "a", old_total: 2, old_weekly: 1, total: 2, weekly: 1 },
        { id: "b", old_total: 1, old_weekly: 1, total: 1, weekly: 1 },
        { id: "c", old_total: 1, old_weekly: 1, total: 1, weekly: 1 },
        { id: "d", old_total: 0, old_weekly: 0, total: 0, weekly: 0 },
      ]);
    });

    it("preserves filtered ranks and tied cursor pagination", async () => {
      const score = sql`coalesce(artist_play_counts.weekly_plays, 0) * 20 + a.followers * 5 + coalesce(artist_play_counts.total_plays, 0) * 2`,
        query = (cursor?: {
          score: number;
          username: string;
          id: string;
        }) => sql`
          SELECT a.id, a.username, ${score} AS score
          FROM fixture_artists a
          LEFT JOIN ${artistPlayCountsSql} ON artist_play_counts.artist_id = a.id
          WHERE a.region = 'tx'
            ${
              cursor
                ? sql`AND (${score} < ${cursor.score} OR
              (${score} = ${cursor.score} AND a.username > ${cursor.username}) OR
              (${score} = ${cursor.score} AND a.username = ${cursor.username} AND a.id > ${cursor.id}))`
                : sql``
            }
          ORDER BY ${score} DESC, a.username ASC, a.id ASC
        `,
        allResult = await execute(query()),
        all = allResult.rows,
        remainingResult = await execute(query(all[0])),
        remaining = remainingResult.rows;
      expect(all.map((row) => row.id)).toEqual(["a", "b", "d"]);
      expect(remaining).toEqual(all.slice(1));
      await client.query(
        "UPDATE fixture_artists SET region = 'tx' WHERE id = 'c'"
      );
      const tiedResult = await execute(query()),
        tied = tiedResult.rows,
        afterTie = await execute(query(tied[1]));
      expect(afterTie.rows).toEqual(tied.slice(2));
      // A parallel plan may split an aggregate across workers. Inspect its
      // grouping relation rather than assuming a display name or node count.
      const plan = await execute(sql`EXPLAIN (FORMAT JSON) ${query()}`),
        root = (plan.rows[0]["QUERY PLAN"] as { Plan: PlanNode }[])[0]
          ?.Plan;
      expect(root).toBeDefined();
      const aggregates = root ? playbackAggregates(root) : [];
      expect(aggregates.length).toBeGreaterThan(0);
      expect(
        aggregates.every((node) => node["Parent Relationship"] !== "SubPlan")
      ).toBe(true);
    });
  }
);
