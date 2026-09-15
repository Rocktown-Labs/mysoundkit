/* eslint-disable one-var, prefer-named-capture-group */
/* oxlint-disable node/no-top-level-await, promise/avoid-new */

import type { createDb } from "@soundkit/db";
import {
  projectAssets,
  projectTracks,
  projects,
  tracks,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildProjectSummaries,
  buildTrackSummaries,
  findPublicProjectCoverForTrack,
} from "./dashboard-mappers";

const DATABASE_URL =
  process.env.SOUNDKIT_TEST_DATABASE_URL ??
  "postgres://soundkit_test:soundkit_test@127.0.0.1:5432/soundkit_test?sslmode=disable";
const USER_ID = "db-test-cover-user";
const TRACK_ID = "db-test-cover-track";
const EMPTY_TRACK_ID = "db-test-cover-empty-track";
const PROJECT_ID = "db-test-cover-project";
const PROJECT_ID_2 = "db-test-cover-project-2";
const ASSET_ID = "db-test-cover-asset";

const probeDatabase = async (url: string) => {
  if (process.env.SOUNDKIT_DISABLE_DB_TESTS === "true") {
    return false;
  }

  const match = /^postgres:\/\/(?:[^:]+:[^@]+@)?([^:/]+):(\d+)/u.exec(url);
  if (!match) {
    return false;
  }

  const [, host, port] = match;
  try {
    const { default: net } = await import("node:net");
    return await new Promise<boolean>((resolve) => {
      const socket = net.connect(Number(port), host, () => {
        socket.destroy();
        resolve(true);
      });
      socket.setTimeout(3000, () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
};

const dbConnected = await probeDatabase(DATABASE_URL);

process.env.DATABASE_URL = DATABASE_URL;

describe.skipIf(!dbConnected)("public project cover queries", () => {
  let db: ReturnType<typeof createDb>;

  beforeAll(async () => {
    const { createDb } = await import("@soundkit/db");
    db = createDb();

    await db.delete(projectAssets).where(eq(projectAssets.id, ASSET_ID));
    await db
      .delete(projectTracks)
      .where(inArray(projectTracks.projectId, [PROJECT_ID, PROJECT_ID_2]));
    await db
      .delete(projects)
      .where(inArray(projects.id, [PROJECT_ID, PROJECT_ID_2]));
    await db
      .delete(tracks)
      .where(inArray(tracks.id, [TRACK_ID, EMPTY_TRACK_ID]));
    await db.delete(user).where(eq(user.id, USER_ID));

    await db.insert(user).values({
      email: "db-test-cover-user@test.dev",
      id: USER_ID,
      name: "Cover Test User",
    });
    await db.insert(tracks).values([
      {
        id: TRACK_ID,
        ownerUserId: USER_ID,
        slug: TRACK_ID,
        title: "Cover Test Track",
      },
      {
        id: EMPTY_TRACK_ID,
        ownerUserId: USER_ID,
        slug: EMPTY_TRACK_ID,
        title: "Cover Test Empty Track",
      },
    ]);
    await db.insert(projects).values([
      {
        id: PROJECT_ID,
        isPublic: true,
        ownerUserId: USER_ID,
        projectType: "single",
        slug: PROJECT_ID,
        title: "Cover Test Project",
      },
      {
        id: PROJECT_ID_2,
        isPublic: true,
        ownerUserId: USER_ID,
        projectType: "single",
        slug: PROJECT_ID_2,
        title: "Cover Test Project 2",
      },
    ]);
    await db.insert(projectTracks).values([
      {
        projectId: PROJECT_ID,
        trackId: TRACK_ID,
      },
      {
        projectId: PROJECT_ID_2,
        trackId: EMPTY_TRACK_ID,
      },
    ]);
    await db.execute(sql`
      insert into project_assets
        (asset_kind, id, object_key, project_id, status, storage_provider)
      values
        ('cover_art', ${ASSET_ID}, 'covers/db-test-cover.webp', ${PROJECT_ID}, 'ready', 'r2')
    `);
  });

  afterAll(async () => {
    await db.delete(projectAssets).where(eq(projectAssets.id, ASSET_ID));
    await db
      .delete(projectTracks)
      .where(inArray(projectTracks.projectId, [PROJECT_ID, PROJECT_ID_2]));
    await db
      .delete(projects)
      .where(inArray(projects.id, [PROJECT_ID, PROJECT_ID_2]));
    await db
      .delete(tracks)
      .where(inArray(tracks.id, [TRACK_ID, EMPTY_TRACK_ID]));
    await db.delete(user).where(eq(user.id, USER_ID));
  });

  it("returns the current public cover and preserves empty-result nulls", async () => {
    const cover = await findPublicProjectCoverForTrack({
      db,
      trackId: TRACK_ID,
    });
    const emptyResult = await findPublicProjectCoverForTrack({
      db,
      trackId: EMPTY_TRACK_ID,
    });

    expect(cover?.objectKey).toBe("covers/db-test-cover.webp");
    expect(emptyResult).toBeNull();
  });

  it("builds track and project summaries for a page in batches", async () => {
    const trackRows = await db
        .select()
        .from(tracks)
        .where(inArray(tracks.id, [TRACK_ID, EMPTY_TRACK_ID])),
      trackById = new Map(trackRows.map((row) => [row.id, row])),
      firstTrack = trackById.get(TRACK_ID),
      secondTrack = trackById.get(EMPTY_TRACK_ID);

    if (!(firstTrack && secondTrack)) {
      throw new Error("Batch mapper test tracks were not created.");
    }

    const trackSummaries = await buildTrackSummaries([
      { playCountOverride: 4, row: firstTrack },
      { playCountOverride: 7, row: secondTrack },
    ]);
    const projectRows = await db
        .select()
        .from(projects)
        .where(inArray(projects.id, [PROJECT_ID, PROJECT_ID_2])),
      projectSummaries = await buildProjectSummaries(projectRows),
      projectSummaryById = new Map(
        projectSummaries.map((summary) => [summary.id, summary])
      );

    expect(
      trackSummaries.map((summary) => [summary.title, summary.plays])
    ).toEqual([
      ["Cover Test Track", 4],
      ["Cover Test Empty Track", 7],
    ]);
    expect(
      [PROJECT_ID, PROJECT_ID_2].map((projectId) => {
        const summary = projectSummaryById.get(projectId);
        return [summary?.title, summary?.trackCount];
      })
    ).toEqual([
      ["Cover Test Project", 1],
      ["Cover Test Project 2", 1],
    ]);
  });
});
