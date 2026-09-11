/* eslint-disable one-var, prefer-named-capture-group */
/* oxlint-disable node/callback-return, node/no-top-level-await, promise/avoid-new */

import type { createDb } from "@soundkit/db";
import {
  battleQueueEntries,
  battles,
  liveExperiences,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AppEnv } from "@/lib/types";
import liveRoutes from "@/routes/live";

const DATABASE_URL =
  process.env.SOUNDKIT_TEST_DATABASE_URL ??
  "postgres://soundkit_test:soundkit_test@127.0.0.1:5432/soundkit_test?sslmode=disable";
const USER_ID = "db-test-live-user";
const QUEUED_BATTLE_ID = "db-test-live-queued-battle";
const LIVE_BATTLE_ID = "db-test-live-active-battle";
const QUEUE_ENTRY_ID = "db-test-live-queue-entry";
const EXPERIENCE_ID = "db-test-live-experience";

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

describe.skipIf(!dbConnected)("live query routes", () => {
  let db: ReturnType<typeof createDb>;

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("user", {
      banned: false,
      email: "db-test-live-user@test.dev",
      id: USER_ID,
      name: "Live Test User",
      role: "user",
    });
    c.set("session", {
      activeOrganizationId: null,
      id: "db-test-live-session",
      userId: USER_ID,
    });
    c.set("requestId", "db-test-live-request");
    await next();
  });
  app.route("/v1/live", liveRoutes);

  const cleanup = async () => {
    await db
      .delete(liveExperiences)
      .where(eq(liveExperiences.id, EXPERIENCE_ID));
    await db
      .delete(battleQueueEntries)
      .where(eq(battleQueueEntries.id, QUEUE_ENTRY_ID));
    await db
      .delete(battles)
      .where(inArray(battles.id, [QUEUED_BATTLE_ID, LIVE_BATTLE_ID]));
    await db.delete(userProfiles).where(eq(userProfiles.userId, USER_ID));
    await db.delete(user).where(eq(user.id, USER_ID));
  };

  beforeAll(async () => {
    const { createDb } = await import("@soundkit/db");
    db = createDb();
    await cleanup();

    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(user).values({
      email: "db-test-live-user@test.dev",
      id: USER_ID,
      name: "Live Test User",
    });
    await db.insert(userProfiles).values({
      accountType: "artist",
      userId: USER_ID,
      username: "db-test-live-user",
    });
    await db.execute(sql`
      insert into battles (format, id, starts_at, status, title)
      values
        ('best_of_3', ${QUEUED_BATTLE_ID}, ${startsAt}, 'scheduled', 'Queued Battle'),
        ('best_of_3', ${LIVE_BATTLE_ID}, ${startsAt}, 'live', 'Active Battle')
    `);
    await db.execute(sql`
      update battles
      set challenger_artist_user_id = ${USER_ID}
      where id = ${LIVE_BATTLE_ID}
    `);
    await db.insert(battleQueueEntries).values({
      battleId: QUEUED_BATTLE_ID,
      id: QUEUE_ENTRY_ID,
      status: "queued",
      userId: USER_ID,
    });
    await db.execute(sql`
      insert into live_experiences
        (created_by_user_id, id, kind, meeting_id, starts_at, status, title)
      values
        (${USER_ID}, ${EXPERIENCE_ID}, 'party', 'db-test-live-meeting', ${startsAt}, 'scheduled', 'Public Test Experience')
    `);
  });

  afterAll(async () => {
    await cleanup();
  });

  it("loads public experiences without failing on profile joins", async () => {
    const response = await app.request("/v1/live/experiences/public");
    const body = (await response.json()) as { id: string }[];

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: EXPERIENCE_ID })])
    );
  });

  it("loads queued and participating battles with empty-result-safe arrays", async () => {
    const response = await app.request("/v1/live/rooms/queue");
    const body = (await response.json()) as {
      battles: { battleId: string }[];
      participatingBattles: { battleId: string; role: string }[];
    };

    expect(response.status).toBe(200);
    expect(body.battles).toEqual([
      {
        battleId: QUEUED_BATTLE_ID,
        startsAt: expect.any(String),
        status: "scheduled",
        title: "Queued Battle",
      },
    ]);
    expect(body.participatingBattles).toEqual([
      {
        battleId: LIVE_BATTLE_ID,
        role: "artist_a",
        startsAt: expect.any(String),
        status: "live",
        title: "Active Battle",
      },
    ]);
  });
});
