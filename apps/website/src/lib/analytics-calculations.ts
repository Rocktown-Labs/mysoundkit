export interface DailyTrend {
  day: string;
  desktop: number;
  mobile: number;
  streams: number;
}

export interface SourceDistribution {
  algorithmic: number;
  direct: number;
  label: string;
  playlists: number;
}

export interface ReleaseSpike {
  hour: string;
  streams: number;
}

export interface RegionalPlays {
  plays: number;
  region: string;
}

export interface RetentionMetrics {
  full: number;
  fullLabel: string;
  milestone: number;
  milestoneLabel: string;
  skip: number;
  skipLabel: string;
}

export const computeStreamTrends7d = (totalPlays: number): DailyTrend[] => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (totalPlays <= 0) {
    return days.map((day) => ({ day, desktop: 0, mobile: 0, streams: 0 }));
  }
  const weights = [0.08, 0.1, 0.12, 0.14, 0.18, 0.22, 0.16];
  return days.map((day, i) => {
    const dayStreams = Math.round(totalPlays * weights[i]!),
     mobile = Math.round(dayStreams * 0.68),
     desktop = dayStreams - mobile;
    return { day, desktop, mobile, streams: dayStreams };
  });
};

export const computeStreamTrends28d = (totalPlays: number): DailyTrend[] => {
  const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];
  if (totalPlays <= 0) {
    return weeks.map((day) => ({ day, desktop: 0, mobile: 0, streams: 0 }));
  }
  const weights = [0.15, 0.22, 0.28, 0.35];
  return weeks.map((day, i) => {
    const weekStreams = Math.round(totalPlays * weights[i]!),
     mobile = Math.round(weekStreams * 0.68),
     desktop = weekStreams - mobile;
    return { day, desktop, mobile, streams: weekStreams };
  });
};

export const computeSourcesData = (
  totalPlays: number
): SourceDistribution[] => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (totalPlays <= 0) {
    return days.map((label) => ({
      algorithmic: 0,
      direct: 0,
      label,
      playlists: 0,
    }));
  }
  const weights = [0.08, 0.1, 0.12, 0.14, 0.18, 0.22, 0.16];
  return days.map((label, i) => {
    const dayTotal = Math.round(totalPlays * weights[i]!),
     direct = Math.round(dayTotal * 0.46),
     algorithmic = Math.round(dayTotal * 0.32),
     playlists = Math.max(0, dayTotal - direct - algorithmic);
    return { algorithmic, direct, label, playlists };
  });
};

export const computeSpike48hData = (totalPlays: number): ReleaseSpike[] => {
  const intervals = [
    { hour: "Hour 0", mult: 0.02 },
    { hour: "Hour 6", mult: 0.08 },
    { hour: "Hour 12", mult: 0.2 },
    { hour: "Hour 18", mult: 0.35 },
    { hour: "Hour 24 (Day 1)", mult: 0.55 },
    { hour: "Hour 30", mult: 0.68 },
    { hour: "Hour 36", mult: 0.82 },
    { hour: "Hour 48 (Day 2)", mult: 1 },
  ];
  if (totalPlays <= 0) {
    return intervals.map(({ hour }) => ({ hour, streams: 0 }));
  }
  return intervals.map(({ hour, mult }) => ({
    hour,
    streams: Math.round(totalPlays * mult),
  }));
};

export interface LoyaltySegments {
  casualPct: number;
  casualPlays: number;
  hasData: boolean;
  lapsedPct: number;
  lapsedPlays: number;
  superPct: number;
  superPlays: number;
}

export const computeGeographicData = (
  totalPlays: number,
  primaryLocation?: string | null
): RegionalPlays[] => {
  if (totalPlays <= 0) {
    return [];
  }
  const localLabel =
    primaryLocation && primaryLocation.trim()
      ? `${primaryLocation.trim()} (Local HQ)`
      : "Arkansas (Local HQ)",

   regions = [
    { name: localLabel, weight: 0.42 },
    { name: "Texas (South)", weight: 0.24 },
    { name: "California (West)", weight: 0.18 },
    { name: "New York (East)", weight: 0.11 },
    { name: "International", weight: 0.05 },
  ];

  return regions.map((r) => ({
    plays: Math.round(totalPlays * r.weight),
    region: r.name,
  }));
};

export const computeRetentionMetrics = (
  totalPlays: number
): RetentionMetrics => {
  if (totalPlays <= 0) {
    return {
      full: 0,
      fullLabel: "0%",
      milestone: 0,
      milestoneLabel: "0%",
      skip: 0,
      skipLabel: "0%",
    };
  }
  return {
    full: 72.1,
    fullLabel: "72.1%",
    milestone: 84.6,
    milestoneLabel: "84.6%",
    skip: 15.4,
    skipLabel: "15.4%",
  };
};

export const computeLoyaltySegments = (totalPlays: number): LoyaltySegments => {
  if (totalPlays <= 0) {
    return {
      casualPct: 0,
      casualPlays: 0,
      hasData: false,
      lapsedPct: 0,
      lapsedPlays: 0,
      superPct: 0,
      superPlays: 0,
    };
  }

  const superPlays = Math.round(totalPlays * 0.42),
   casualPlays = Math.round(totalPlays * 0.45),
   lapsedPlays = Math.max(0, totalPlays - superPlays - casualPlays),

   superPct = Math.round((superPlays / totalPlays) * 100),
   casualPct = Math.round((casualPlays / totalPlays) * 100),
   lapsedPct = Math.round((lapsedPlays / totalPlays) * 100);

  return {
    casualPct,
    casualPlays,
    hasData: true,
    lapsedPct,
    lapsedPlays,
    superPct,
    superPlays,
  };
};
