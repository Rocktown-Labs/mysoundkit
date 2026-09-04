import type { createDb } from "@soundkit/db";
import {
  accountingPeriods,
  playbackSessions,
  trackAssets,
} from "@soundkit/db/schema/app";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

type SoundKitDb = ReturnType<typeof createDb>;

/**
 * Reusable SQL predicate for verified 30-second Plays.
 * Rules:
 * - Play counts after >= 30 seconds of meaningful playback.
 * - Short track (< 30s) fallback: counts after >= 95% completion.
 * - Rejected or held-risk sessions never count as verified plays.
 */
export const playConditionSql = sql`(
  ${playbackSessions.riskStatus} = 'clear'
  AND (
  ${playbackSessions.playedSeconds} >= 30
  OR (
    EXISTS (
      SELECT 1 FROM ${trackAssets}
      WHERE ${trackAssets.trackId} = ${playbackSessions.trackId}
        AND ${trackAssets.assetKind} IN ('master', 'untagged_wav', 'tagged_mp3', 'variant_audio', 'instrumental')
        AND ${trackAssets.durationMs} IS NOT NULL
        AND ${trackAssets.durationMs} > 0
        AND ${trackAssets.durationMs} < 30000
        AND ${playbackSessions.playedSeconds} >= round((${trackAssets.durationMs} / 1000.0) * 0.95)
    )
  )
  )
)`;

export const dateBucketSql = (
  range: "7d" | "28d" | "90d" | "12m",
  column: PgColumn
) =>
  range === "12m"
    ? sql<string>`to_char(${column}, 'YYYY-MM')`
    : sql<string>`to_char(${column}, 'YYYY-MM-DD')`;

/**
 * Resolve the currently open monthly accounting period for the artist's
 * earnings window. Returns null when no open period has been created yet
 * (e.g. a brand-new artist with no qualified streams).
 */
export const getOpenAccountingPeriod = async (
  db: SoundKitDb,
  now: Date
): Promise<{ endsAt: Date; id: string; startsAt: Date } | null> => {
  const [period] = await db
    .select({
      endsAt: accountingPeriods.endsAt,
      id: accountingPeriods.id,
      startsAt: accountingPeriods.startsAt,
    })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.periodType, "monthly"),
        eq(accountingPeriods.status, "open"),
        gte(
          accountingPeriods.startsAt,
          new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        ),
        lt(
          accountingPeriods.startsAt,
          new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        )
      )
    )
    .orderBy(accountingPeriods.startsAt)
    .limit(1);

  return period ?? null;
};

export const US_STATE_CODE_TO_NAME: Readonly<Record<string, string>> = {
  AK: "Alaska",
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
};

const US_STATE_NAME_TO_NAME = Object.fromEntries(
  Object.values(US_STATE_CODE_TO_NAME).map((name) => [name.toLowerCase(), name])
);

export const resolveRegionName = (
  countryCode: string | null,
  regionCode: string | null
): string | null => {
  if (!regionCode) {
    return null;
  }
  const clean = regionCode.trim();
  if (!clean) {
    return null;
  }
  if (countryCode === "US" || !countryCode) {
    const fromCode = US_STATE_CODE_TO_NAME[clean.toUpperCase()];
    if (fromCode) {
      return fromCode;
    }
    return US_STATE_NAME_TO_NAME[clean.toLowerCase()] ?? clean;
  }
  return clean;
};
