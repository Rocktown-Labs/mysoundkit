import {
  artistProfiles,
  playbackSessions,
  tracks,
} from "@soundkit/db/schema/app";
import { sql } from "drizzle-orm";

import { playConditionSql } from "./analytics-helpers";

// A single grouped relation supplies both counters. Reusing correlated COUNTs in
// projection, ranking and cursor predicates otherwise rescans playback sessions.
export const artistPlayCountsJoin = sql`artist_play_counts.artist_id = ${artistProfiles.userId}`,
  artistPlayCountsSql = sql`(
  select ${tracks.ownerUserId} as artist_id,
    count(*)::int as total_plays,
    (count(*) filter (where ${playbackSessions.startedAt} >= now() - interval '7 days'))::int as weekly_plays
  from ${playbackSessions}
  inner join ${tracks} on ${tracks.id} = ${playbackSessions.trackId}
  where ${playConditionSql}
  group by ${tracks.ownerUserId}
) as artist_play_counts`,
  artistTotalPlays = sql<number>`coalesce(artist_play_counts.total_plays, 0)`,
  artistWeeklyPlays = sql<number>`coalesce(artist_play_counts.weekly_plays, 0)`;
