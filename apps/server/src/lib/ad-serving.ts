/* eslint-disable one-var, sort-vars */
import { createDb } from "@soundkit/db";
import {
  artistProfiles,
  battleQueueEntries,
  battles,
  genres,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, count, eq, inArray } from "drizzle-orm";

export interface BattleAdContext {
  artistA: string | null;
  artistB: string | null;
  battleId: string;
  genre: string | null;
  queueSize: number;
  requiresPremium: boolean;
  startsAt: string | null;
  status: string;
  timingLabel: string;
  title: string;
  visibility: string;
}

const ET_TIME_ZONE = "America/New_York",
  timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ET_TIME_ZONE,
  }),
  dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIME_ZONE,
    weekday: "long",
  }),
  etDayKey = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: ET_TIME_ZONE,
      year: "numeric",
    }).format(date);

/**
 * Human timing label for battle promos ("Live now", "Tonight 9PM ET",
 * "Tomorrow 8PM ET", "Friday 9PM ET"). Pure — worker-tested.
 */
export const describeBattleTiming = ({
  now,
  startsAt,
  status,
}: {
  now: Date;
  startsAt: Date | null;
  status: string;
}): string => {
  if (status === "live") {
    return "Live now";
  }
  if (status === "completed" || status === "archived") {
    return "Recently battled";
  }
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return "Coming soon";
  }
  const diffMs = startsAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return "Starting soon";
  }
  const timeLabel = `${timeFormatter.format(startsAt)} ET`,
    startDay = etDayKey(startsAt),
    todayDay = etDayKey(now),
    tomorrowDay = etDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (startDay === todayDay) {
    return `Tonight ${timeLabel}`;
  }
  if (startDay === tomorrowDay) {
    return `Tomorrow ${timeLabel}`;
  }
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return `${dayFormatter.format(startsAt)} ${timeLabel}`;
  }
  return `${startsAt.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: ET_TIME_ZONE })} ${timeLabel}`;
};

export const hydrateBattleAdContext = async (
  battleId: string,
  now = new Date()
): Promise<BattleAdContext | null> => {
  const db = createDb(),
    [battle] = await db
      .select()
      .from(battles)
      .where(eq(battles.id, battleId))
      .limit(1);
  if (!battle) {
    return null;
  }
  const artistIds = [
      battle.challengerArtistUserId,
      battle.opponentArtistUserId,
    ].filter((id): id is string => Boolean(id)),
    [profileRows, [genreRow], [queueRow]] = await Promise.all([
      artistIds.length > 0
        ? db
            .select({
              stageName: artistProfiles.stageName,
              userId: artistProfiles.userId,
              username: userProfiles.username,
            })
            .from(artistProfiles)
            .leftJoin(
              userProfiles,
              eq(userProfiles.userId, artistProfiles.userId)
            )
            .where(inArray(artistProfiles.userId, artistIds))
        : [],
      battle.genreId
        ? db
            .select({ name: genres.name })
            .from(genres)
            .where(eq(genres.id, battle.genreId))
            .limit(1)
        : [],
      db
        .select({ size: count() })
        .from(battleQueueEntries)
        .where(
          and(
            eq(battleQueueEntries.battleId, battle.id),
            eq(battleQueueEntries.status, "queued")
          )
        ),
    ]),
    nameFor = (userId: string | null) => {
      if (!userId) {
        return null;
      }
      const row = profileRows.find((profile) => profile.userId === userId);
      return row?.stageName ?? row?.username ?? null;
    };
  return {
    artistA: nameFor(battle.challengerArtistUserId),
    artistB: nameFor(battle.opponentArtistUserId),
    battleId: battle.id,
    genre: genreRow?.name ?? null,
    queueSize: queueRow?.size ?? 0,
    requiresPremium: battle.visibility === "premium_only",
    startsAt: battle.startsAt?.toISOString() ?? null,
    status: battle.status,
    timingLabel: describeBattleTiming({
      now,
      startsAt: battle.startsAt,
      status: battle.status,
    }),
    title: battle.title,
    visibility: battle.visibility,
  };
};
