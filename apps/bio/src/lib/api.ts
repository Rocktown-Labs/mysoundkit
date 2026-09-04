/* eslint-disable one-var, sort-vars, complexity */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/u, "");

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_SERVER_URL || "http://localhost:3000"
);
export const API_V1_URL = `${API_BASE_URL}/v1`;
export const SOUNDKIT_WEB_URL = trimTrailingSlash(
  import.meta.env.VITE_SOUNDKIT_WEB_URL ||
    (import.meta.env.DEV ? "http://localhost:3001" : "https://mysoundkit.com")
);
export const SOUNDKIT_BIO_URL = trimTrailingSlash(
  import.meta.env.VITE_SOUNDKIT_BIO_URL ||
    (import.meta.env.DEV ? "http://localhost:3002" : "https://soundkit.bio")
);
export const SOUNDKIT_BIO_SHARE_URL = "https://soundkit.bio";
export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

export const toAbsoluteBioUrl = (value: string) => {
  try {
    return new URL(value, SOUNDKIT_BIO_URL).toString();
  } catch {
    return value;
  }
};

export const toBioShareUrl = (username: string) =>
  `${SOUNDKIT_BIO_SHARE_URL}/${encodeURIComponent(username)}`;

export interface BioArtist {
  avatarUrl?: string | null;
  battleCount?: number;
  bio?: string | null;
  coverImageUrl?: string | null;
  followers: number;
  genre: string;
  id: string;
  joinedAt?: string;
  links?: Record<string, string | undefined>;
  location: string;
  name: string;
  rank?: number | null;
  state?: string | null;
  trackCount?: number;
  username: string;
  verified: boolean;
  weeklyPlays?: number;
}

export interface BioStreamingLinks {
  appleMusic?: string;
  spotify?: string;
  youtube?: string;
}

export interface BioTrack {
  artistName: string;
  artistUsername?: string | null;
  bpm?: number | null;
  coverArtUrl?: string | null;
  duration: string;
  genre?: string;
  id: string;
  mediaReady?: boolean;
  musicalKey?: string | null;
  playbackUrl?: string | null;
  plays: number;
  previewUrl?: string | null;
  regionSlug?: string | null;
  slug?: string | null;
  streamingLinks?: BioStreamingLinks;
  title: string;
}

export interface BioProject {
  artistName: string;
  artistUsername?: string | null;
  coverArtUrl?: string | null;
  id: string;
  projectType: "album" | "ep" | "mixtape" | "single";
  releaseDate?: string | null;
  slug: string;
  title: string;
  trackCount: number;
}

export interface BioVideo {
  creatorAvatarUrl?: string | null;
  creatorName?: string;
  creatorUsername?: string;
  duration?: string;
  id: string;
  slug: string;
  thumbnailUrl?: string | null;
  title: string;
  viewCount?: string;
}

export interface BioCredit {
  contentId: string;
  contentType: "track" | "project";
  coverArtUrl?: string | null;
  id: string;
  ownerName: string;
  ownerUsername: string;
  projectType?: "album" | "ep" | "mixtape" | "single" | null;
  role: "producer" | "engineer" | "songwriter";
  slug: string;
  title: string;
}

export interface BioMedia {
  credits: BioCredit[];
  featuredProjects: BioProject[];
  featuredTracks: BioTrack[];
  hasMore?: {
    credits: boolean;
    projects: boolean;
    tracks: boolean;
    videos: boolean;
  };
  projects: BioProject[];
  tracks: BioTrack[];
  videos: BioVideo[];
}

export interface BioCurrentUser {
  accountType?: "artist" | "fan";
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  id: string;
  name?: string | null;
  onboardingCompletedAt?: string | null;
  role?: string | null;
  username: string;
}

export interface BioAnalyticsOverview {
  estimatedEarningsCents: number;
  premiumSupporters: number;
  totalFollowers: number;
  totalPlays: number;
  totalQualifiedStreams: number;
  uniqueListeners: number;
}

export interface BioAnalyticsTimeseriesPoint {
  date: string;
  label: string;
  value: number;
}

export interface BioAnalyticsTimeseries {
  metric: string;
  points: BioAnalyticsTimeseriesPoint[];
  range: string;
  total: number;
}

export interface BioAnalyticsSource {
  count: number;
  label: string;
  percentage: number;
  sourceType: string;
}

export interface BioAnalyticsSources {
  sources: BioAnalyticsSource[];
  total: number;
}

export interface BioAnalyticsLocationItem {
  city: string | null;
  countryCode: string | null;
  hasEnoughData: boolean;
  listeners: number;
  percentage: number;
  plays?: number;
  regionCode: string | null;
  regionName?: string | null;
}

export interface BioAnalyticsRegionItem {
  countryCode: string | null;
  listeners: number;
  percentage: number;
  plays: number;
  regionCode: string;
  regionName: string;
}

export interface BioAnalyticsLocations {
  hasEnoughData: boolean;
  locations: BioAnalyticsLocationItem[];
  regions: BioAnalyticsRegionItem[];
  totalListeners: number;
  totalPlays: number;
}

export interface BioArtistEarnings {
  availableBalanceCents: number;
  estimatedThisMonthCents: number;
  nextEstimatedPayoutDate: string;
  paidLifetimeCents: number;
  payoutMinimumCents: number;
  payoutProgressPercent: number;
  pendingReserveCents: number;
  statements: {
    creatorRewardsCents: number;
    monthLabel: string;
    musicSalesCents: number;
    periodEndsAt: string;
    periodStartsAt: string;
    plays: number;
    qualifiedStreams: number;
    tipsCents: number;
    totalEarningsCents: number;
  }[];
}

export interface BioTip {
  amountCents: number;
  createdAt: string;
  fanDisplayName: string;
  id: string;
  message: string | null;
}

export interface BioTipsOverview {
  averageTipCents: number;
  supporterCount: number;
  tips: BioTip[];
  totalTipCount: number;
  totalTipsCents: number;
}

export interface BioRecentTrack {
  artistName: string;
  artistUsername?: string | null;
  coverArtUrl?: string | null;
  duration: string;
  id: string;
  lastPlayedAt: string;
  title: string;
  timesPlayed: number;
}

export interface BioSellerStatus {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingStatus:
    | "not_started"
    | "pending"
    | "restricted"
    | "enabled"
    | "rejected";
  payoutsEnabled: boolean;
}

export interface BioProjectDetail extends BioProject {
  description?: string | null;
  genre?: string | null;
  isPublic?: boolean;
  tracks: BioTrack[];
}

export interface BioVideoDetail extends BioVideo {
  creatorName: string;
  creatorUsername: string;
  description?: string | null;
  externalPlaybackUrl?: string | null;
  genre?: string | null;
  muxPlaybackId?: string | null;
  playbackPolicy?: "public" | "signed";
  sourceProvider?: "mux" | "external";
  videoKind: string;
}

export interface BioLiveExperienceDetail extends BioLiveStream {
  description?: string | null;
  genre?: string | null;
  hostDisplayName?: string | null;
  scheduledStartAt?: string | null;
  startedAt?: string | null;
  streamPlaybackUrl?: string | null;
  viewerCount: number;
}

export interface BioLiveStream {
  creatorUsername: string;
  id: string;
  kind?: "battle" | "party" | "stream";
  status: "live" | "ended" | "scheduled";
  title: string;
  viewerCount?: number;
}

export interface BioProfile {
  artist: BioArtist;
  live?: BioLiveStream | null;
  media: BioMedia;
}

export interface BioArtistSearchResult {
  avatarUrl?: string | null;
  followers: number;
  genre: string;
  id: string;
  location?: string;
  name: string;
  rank?: number | null;
  username: string;
  verified: boolean;
  weeklyPlays?: number;
}

export interface BioArtistDiscoveryPage {
  artists: BioArtistSearchResult[];
  hasMore: boolean;
  nextCursor: string | null;
}

const safeExternalUrl = (value: string | null): string | null => {
    if (!value) {
      return null;
    }

    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:" ? value : null;
    } catch {
      return null;
    }
  },
  isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === "object"),
  stringValue = (value: unknown): string | null =>
    typeof value === "string" && value.length > 0 ? value : null,
  apiMediaUrl = (value: string | null): string | null =>
    value?.startsWith("/") ? `${API_BASE_URL}${value}` : value,
  numberValue = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
  formatDuration = (value: unknown): string => {
    const durationMs = numberValue(value);
    if (durationMs === null || durationMs < 0) {
      return "0:00";
    }

    const totalSeconds = Math.round(durationMs / 1000),
      minutes = Math.floor(totalSeconds / 60),
      seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  },
  projectTypeFrom = (value: unknown): BioProject["projectType"] | null => {
    if (
      value === "album" ||
      value === "ep" ||
      value === "mixtape" ||
      value === "single"
    ) {
      return value;
    }
    return null;
  },
  liveKindFrom = (value: unknown): BioLiveStream["kind"] => {
    if (value === "battle" || value === "party" || value === "stream") {
      return value;
    }
    return undefined;
  },
  liveStatusFrom = (value: string | null): BioLiveStream["status"] => {
    if (value === "live") {
      return "live";
    }
    if (value === "ended" || value === "completed") {
      return "ended";
    }
    return "scheduled";
  },
  readJson = async (response: Response | null): Promise<unknown> => {
    if (!response?.ok) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  },
  normalizeArtist = (value: unknown): BioArtist | null => {
    if (!isRecord(value)) {
      return null;
    }

    const normalizedLinks: Record<string, string | undefined> = {};
    if (isRecord(value.links)) {
      for (const [platform, link] of Object.entries(value.links)) {
        if (typeof link === "string") {
          normalizedLinks[platform] = link;
        }
      }
    }
    if (!normalizedLinks.appleMusic && normalizedLinks.apple) {
      normalizedLinks.appleMusic = normalizedLinks.apple;
    }
    const links = Object.keys(normalizedLinks).length
      ? normalizedLinks
      : undefined;

    return {
      avatarUrl: apiMediaUrl(stringValue(value.avatarUrl)),
      battleCount: numberValue(value.battleCount) ?? 0,
      bio: stringValue(value.bio),
      coverImageUrl: apiMediaUrl(
        stringValue(value.coverImageUrl) ?? stringValue(value.headerUrl)
      ),
      followers:
        numberValue(value.followers) ?? numberValue(value.followerCount) ?? 0,
      genre: stringValue(value.genre) ?? "Independent Artist",
      id: stringValue(value.id) ?? "",
      joinedAt: stringValue(value.joinedAt) ?? undefined,
      links,
      location:
        stringValue(value.location) ??
        [stringValue(value.city), stringValue(value.state)]
          .filter((part): part is string => Boolean(part))
          .join(", "),
      name:
        stringValue(value.name) ??
        stringValue(value.displayName) ??
        stringValue(value.stageName) ??
        "SoundKit Artist",
      rank: numberValue(value.rank),
      state: stringValue(value.state),
      trackCount:
        numberValue(value.trackCount) ?? numberValue(value.track_count) ?? 0,
      username: stringValue(value.username) ?? "",
      verified: Boolean(value.verified ?? value.isVerified),
      weeklyPlays: numberValue(value.weeklyPlays) ?? 0,
    };
  },
  normalizeTrack = (
    value: unknown,
    fallbackArtistName = "SoundKit Artist",
    fallbackArtistUsername: string | null = null
  ): BioTrack | null => {
    if (!isRecord(value)) {
      return null;
    }

    const artist = isRecord(value.artist) ? value.artist : null,
      id = stringValue(value.id) ?? stringValue(value.slug);
    if (!id) {
      return null;
    }

    const playbackUrl = apiMediaUrl(stringValue(value.playbackUrl)),
      previewUrl = apiMediaUrl(stringValue(value.previewUrl)),
      duration =
        stringValue(value.duration) ?? formatDuration(value.durationMs),
      streamingLinks = isRecord(value.streamingLinks)
        ? {
            appleMusic:
              stringValue(value.streamingLinks.appleMusic) ??
              stringValue(value.streamingLinks.apple) ??
              undefined,
            spotify: stringValue(value.streamingLinks.spotify) ?? undefined,
            youtube: stringValue(value.streamingLinks.youtube) ?? undefined,
          }
        : undefined;

    return {
      artistName:
        stringValue(value.artistName) ??
        stringValue(artist?.name) ??
        fallbackArtistName,
      artistUsername:
        stringValue(value.artistUsername) ??
        stringValue(artist?.username) ??
        stringValue(artist?.handle) ??
        fallbackArtistUsername,
      bpm: numberValue(value.bpm),
      coverArtUrl: apiMediaUrl(
        stringValue(value.coverArtUrl) ?? stringValue(value.artworkUrl)
      ),
      duration,
      genre:
        stringValue(value.genre) ?? stringValue(artist?.genre) ?? undefined,
      id,
      mediaReady:
        typeof value.mediaReady === "boolean"
          ? value.mediaReady
          : Boolean(playbackUrl || previewUrl),
      musicalKey: stringValue(value.musicalKey),
      playbackUrl,
      plays:
        numberValue(value.plays) ??
        numberValue(value.playCount) ??
        numberValue(value.streamCount) ??
        0,
      previewUrl,
      regionSlug: stringValue(value.regionSlug),
      slug: stringValue(value.slug),
      streamingLinks,
      title: stringValue(value.title) ?? "Untitled Track",
    };
  },
  normalizeProject = (
    value: unknown,
    fallbackArtistName = "SoundKit Artist",
    fallbackArtistUsername: string | null = null
  ): BioProject | null => {
    if (!isRecord(value)) {
      return null;
    }

    const id = stringValue(value.id) ?? stringValue(value.slug);
    if (!id) {
      return null;
    }

    const projectType = stringValue(value.projectType);
    return {
      artistName: stringValue(value.artistName) ?? fallbackArtistName,
      artistUsername:
        stringValue(value.artistUsername) ?? fallbackArtistUsername,
      coverArtUrl: apiMediaUrl(stringValue(value.coverArtUrl)),
      id,
      projectType: projectTypeFrom(projectType) ?? "album",
      releaseDate:
        stringValue(value.releaseDate) ?? stringValue(value.releaseAt),
      slug: stringValue(value.slug) ?? id,
      title: stringValue(value.title) ?? "Untitled Project",
      trackCount:
        numberValue(value.trackCount) ?? numberValue(value.track_count) ?? 0,
    };
  },
  normalizeVideo = (value: unknown): BioVideo | null => {
    if (!isRecord(value)) {
      return null;
    }

    const id = stringValue(value.id) ?? stringValue(value.slug);
    if (!id) {
      return null;
    }

    return {
      creatorAvatarUrl: apiMediaUrl(
        stringValue(value.creatorAvatarUrl) ?? stringValue(value.avatarUrl)
      ),
      creatorName:
        stringValue(value.creatorName) ??
        stringValue(value.displayName) ??
        stringValue(value.name) ??
        "SoundKit Artist",
      creatorUsername:
        stringValue(value.creatorUsername) ?? stringValue(value.username) ?? "",
      duration: stringValue(value.duration) ?? undefined,
      id,
      slug: stringValue(value.slug) ?? id,
      thumbnailUrl: apiMediaUrl(stringValue(value.thumbnailUrl)),
      title: stringValue(value.title) ?? "Untitled Video",
      viewCount:
        stringValue(value.viewCount) ??
        numberValue(value.viewCount)?.toLocaleString() ??
        undefined,
    };
  },
  normalizeLiveStream = (value: unknown): BioLiveStream | null => {
    if (!isRecord(value)) {
      return null;
    }

    const id = stringValue(value.id);
    if (!id) {
      return null;
    }

    const rawStatus = stringValue(value.status);
    return {
      creatorUsername:
        stringValue(value.creatorUsername) ??
        stringValue(value.hostUsername) ??
        "",
      id,
      kind: liveKindFrom(value.kind),
      status: liveStatusFrom(rawStatus),
      title: stringValue(value.title) ?? "Live Session",
      viewerCount: numberValue(value.viewerCount) ?? 0,
    };
  };

const fetchBio = async (
  input: string,
  init?: RequestInit
): Promise<Response | null> => {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
};

const normalizeArtistSearchResult = (
  value: unknown
): BioArtistSearchResult | null => {
  const artist = normalizeArtist(value);
  if (!artist) {
    return null;
  }

  return {
    avatarUrl: artist.avatarUrl,
    followers: artist.followers,
    genre: artist.genre,
    id: artist.id,
    location: artist.location,
    name: artist.name,
    rank: artist.rank,
    username: artist.username,
    verified: artist.verified,
    weeklyPlays: artist.weeklyPlays,
  };
};

const normalizeMediaList = <T>(
  value: unknown,
  mapper: (entry: unknown) => T | null
): T[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const normalized = mapper(entry);
        return normalized ? [normalized] : [];
      })
    : [];

const normalizeProfileMedia = (value: unknown, artist: BioArtist): BioMedia => {
  const rawRecord = isRecord(value) ? value : null,
    normalizeCredit = (entry: unknown): BioCredit | null => {
      if (!isRecord(entry)) {
        return null;
      }

      const id = stringValue(entry.id) ?? stringValue(entry.contentId);
      if (!id) {
        return null;
      }

      const role = stringValue(entry.role);
      if (role !== "producer" && role !== "engineer" && role !== "songwriter") {
        return null;
      }

      return {
        contentId: stringValue(entry.contentId) ?? id,
        contentType: entry.contentType === "project" ? "project" : "track",
        coverArtUrl: apiMediaUrl(stringValue(entry.coverArtUrl)),
        id,
        ownerName: stringValue(entry.ownerName) ?? "SoundKit Artist",
        ownerUsername: stringValue(entry.ownerUsername) ?? "",
        projectType: projectTypeFrom(entry.projectType),
        role,
        slug: stringValue(entry.slug) ?? stringValue(entry.contentId) ?? id,
        title: stringValue(entry.title) ?? "Untitled Release",
      };
    },
    rawHasMore =
      rawRecord && isRecord(rawRecord.hasMore)
        ? {
            credits: rawRecord.hasMore.credits === true,
            projects: rawRecord.hasMore.projects === true,
            tracks: rawRecord.hasMore.tracks === true,
            videos: rawRecord.hasMore.videos === true,
          }
        : undefined;

  return {
    credits: normalizeMediaList(rawRecord?.credits, normalizeCredit),
    featuredProjects: normalizeMediaList(rawRecord?.featuredProjects, (entry) =>
      normalizeProject(entry, artist.name, artist.username)
    ),
    featuredTracks: normalizeMediaList(rawRecord?.featuredTracks, (entry) =>
      normalizeTrack(entry, artist.name, artist.username)
    ),
    hasMore: rawHasMore,
    projects: normalizeMediaList(rawRecord?.projects, (entry) =>
      normalizeProject(entry, artist.name, artist.username)
    ),
    tracks: normalizeMediaList(rawRecord?.tracks, (entry) =>
      normalizeTrack(entry, artist.name, artist.username)
    ),
    videos: normalizeMediaList(rawRecord?.videos, normalizeVideo),
  };
};

export const loadBioProfile = async (
  username: string
): Promise<BioProfile | null> => {
  const encodedUsername = encodeURIComponent(username),
    artistResponse = await fetchBio(
      `${API_V1_URL}/artists/${encodedUsername}`,
      {
        headers: { Accept: "application/json" },
      }
    ),
    artistData = await readJson(artistResponse),
    artistRecord =
      isRecord(artistData) && isRecord(artistData.artist)
        ? artistData.artist
        : artistData,
    artist = normalizeArtist(artistRecord);

  if (!artist || !artist.id || !artist.username) {
    return null;
  }

  const [mediaResponse, liveResponse] = await Promise.all([
      fetchBio(`${API_V1_URL}/artists/${encodedUsername}/media?section=feed`, {
        headers: { Accept: "application/json" },
      }),
      fetchBio(
        `${API_V1_URL}/live/experiences/public?creatorUsername=${encodeURIComponent(artist.username)}`,
        { headers: { Accept: "application/json" } }
      ),
    ]),
    [rawMedia, rawLive] = await Promise.all([
      readJson(mediaResponse),
      readJson(liveResponse),
    ]),
    liveExperiences = Array.isArray(rawLive) ? rawLive : [],
    live =
      liveExperiences
        .map(normalizeLiveStream)
        .find((experience) =>
          Boolean(experience && experience.status === "live")
        ) ?? null,
    media = normalizeProfileMedia(rawMedia, artist);

  return { artist, live, media };
};

export const loadBioMediaSection = async (
  username: string,
  artist: BioArtist,
  section: Exclude<
    keyof BioMedia,
    "hasMore" | "featuredProjects" | "featuredTracks"
  >
): Promise<BioMedia | null> => {
  const response = await fetchBio(
    `${API_V1_URL}/artists/${encodeURIComponent(username)}/media?section=${encodeURIComponent(section)}`,
    { headers: { Accept: "application/json" } }
  );

  if (!response?.ok) {
    return null;
  }

  return normalizeProfileMedia(await readJson(response), artist);
};

export const loadBioTrack = async (
  trackId: string
): Promise<BioTrack | null> => {
  try {
    const encodedId = encodeURIComponent(trackId),
      response = await fetchBio(`${API_V1_URL}/tracks/${encodedId}`, {
        headers: { Accept: "application/json" },
      }),
      data = await readJson(response);

    return normalizeTrack(data);
  } catch {
    return null;
  }
};

export const searchBioArtists = async (
  query: string,
  limit = 8
): Promise<BioArtistSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const response = await fetch(
      `${API_V1_URL}/search?type=artists&limit=${limit}&q=${encodeURIComponent(trimmed)}`,
      { headers: { Accept: "application/json" } }
    ),
    data = await readJson(response),
    record =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : null;

  if (record && Array.isArray(record.artists)) {
    return normalizeMediaList(record.artists, normalizeArtistSearchResult);
  }

  return [];
};

export const loadRegionArtists = async (
  region = "us-arkansas",
  regionType = "north-america"
): Promise<BioArtistSearchResult[]> => {
  const response = await fetch(
      `${API_V1_URL}/artists?region=${encodeURIComponent(region)}&regionType=${encodeURIComponent(regionType)}&category=top&limit=12`,
      { headers: { Accept: "application/json" } }
    ),
    data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(`Could not load artists (${response.status}).`);
  }

  if (Array.isArray(data)) {
    return normalizeMediaList(data, normalizeArtistSearchResult);
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  if (record && Array.isArray(record.artists)) {
    return normalizeMediaList(record.artists, normalizeArtistSearchResult);
  }

  return [];
};

export const loadArtistDiscoveryPage = async ({
  cursor,
  limit = 12,
  region = "us-arkansas",
  regionType = "north-america",
}: {
  cursor?: string | null;
  limit?: number;
  region?: string;
  regionType?: "north-america" | "global";
}): Promise<BioArtistDiscoveryPage> => {
  const params = new URLSearchParams({
    limit: String(limit),
    region,
    regionType,
  });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetchBio(
    `${API_V1_URL}/artists/discover?${params.toString()}`,
    { headers: { Accept: "application/json" } }
  );
  if (!response?.ok) {
    throw new Error(`Could not load artists (${response?.status ?? 0}).`);
  }

  const data = await readJson(response),
    record = isRecord(data) ? data : null,
    artists = normalizeMediaList(record?.artists, normalizeArtistSearchResult);

  return {
    artists,
    hasMore: record?.hasMore === true,
    nextCursor: stringValue(record?.nextCursor),
  };
};

export const isSafeExternalUrl = (value: string | undefined) =>
  safeExternalUrl(value ?? null) !== null;

export const buildSoundKitWebUrl = (path: string, refArtist?: string) => {
  const normalizedPath = path
    .replace(/^\/auth\/signup\b/u, "/signup")
    .replace(/^\/auth\/login\b/u, "/login");
  const base = `${SOUNDKIT_WEB_URL}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
  try {
    const url = new URL(base);
    url.searchParams.set("utm_source", "soundkit_bio");
    url.searchParams.set("utm_medium", "social_link");
    if (refArtist) {
      url.searchParams.set("ref", `bio_${refArtist}`);
    }
    return url.toString();
  } catch {
    return base;
  }
};

export const checkUsernameAvailable = async (username: string) => {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) {
    return {
      available: false,
      message: "Username must be at least 3 characters",
    };
  }

  const response = await fetch(
    `${API_V1_URL}/onboarding/username-availability?username=${encodeURIComponent(trimmed)}`,
    { headers: { Accept: "application/json" } }
  );
  const data = (await response.json().catch(() => null)) as {
    available?: boolean;
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(data?.message ?? "Could not check username availability.");
  }

  return {
    available: data?.available === true,
    message:
      data?.message ??
      (data?.available ? "Username is available" : "Username is taken"),
  };
};

export const loadGenres = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_V1_URL}/discover/genres`, {
      headers: { Accept: "application/json" },
    });
    const data = await readJson(response);
    if (Array.isArray(data)) {
      return data
        .map((entry) =>
          typeof entry === "string"
            ? entry
            : (entry as { name?: string }).name || ""
        )
        .filter(Boolean);
    }
    return [
      "Hip-Hop",
      "R&B/Soul",
      "Pop",
      "Electronic",
      "Rock",
      "Country",
      "Latin",
      "Afrobeats",
      "Jazz",
    ];
  } catch {
    return [
      "Hip-Hop",
      "R&B/Soul",
      "Pop",
      "Electronic",
      "Rock",
      "Country",
      "Latin",
      "Afrobeats",
      "Jazz",
    ];
  }
};

interface OnboardingResponse {
  checkoutUrl?: string | null;
  message?: string;
  requiresCheckout?: boolean;
  setupRequired?: boolean;
}

export const signUpWithEmail = async (
  payload: { email: string; name: string; password: string },
  turnstileToken?: string
) => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (turnstileToken) {
    headers["X-Turnstile-Token"] = turnstileToken;
  }

  const response = await fetch(`${API_BASE_URL}/auth/sign-up/email`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers,
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(data?.message ?? "Could not create your SoundKit account.");
  }
};

const submitOnboarding = async (
  accountType: "artist" | "fan",
  payload: Record<string, unknown>
): Promise<OnboardingResponse> => {
  const response = await fetch(`${API_V1_URL}/onboarding/${accountType}`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(data?.message ?? `Onboarding failed (${response.status})`);
  }

  return data ?? {};
};

export const submitArtistOnboarding = (payload: Record<string, unknown>) =>
  submitOnboarding("artist", payload);

export const submitFanOnboarding = (payload: Record<string, unknown>) =>
  submitOnboarding("fan", payload);

const BIO_AUTH_TOKEN_KEY = "soundkit_bio_auth_token";

export const getBioAuthToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return (
      localStorage.getItem(BIO_AUTH_TOKEN_KEY) ||
      sessionStorage.getItem(BIO_AUTH_TOKEN_KEY)
    );
  } catch {
    return null;
  }
};

export const setBioAuthToken = (token: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(BIO_AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(BIO_AUTH_TOKEN_KEY, token);
  } catch {
    // storage unavailable
  }
};

export const getBioAuthHeaders = (): Record<string, string> => {
  const token = getBioAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const clearBioAuthToken = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(BIO_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(BIO_AUTH_TOKEN_KEY);
  } catch {
    // storage unavailable
  }
};

export const getCurrentSessionUser =
  async (): Promise<BioCurrentUser | null> => {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const token = getBioAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_V1_URL}/me`, {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        return null;
      }

      const payload: unknown = await response.json(),
        data =
          isRecord(payload) && isRecord(payload.user) ? payload.user : payload;
      const id = isRecord(data) ? stringValue(data.id) : null;
      if (!isRecord(data) || !id) {
        return null;
      }

      const accountType = data.accountType === "fan" ? "fan" : "artist",
        username =
          stringValue(data.username) ??
          stringValue(data.stageName)?.toLowerCase().replaceAll(/\s+/gu, "") ??
          "artist";

      return {
        accountType,
        avatarUrl: apiMediaUrl(stringValue(data.avatarUrl)),
        displayName:
          stringValue(data.displayName) ?? stringValue(data.name) ?? "Artist",
        email: stringValue(data.email),
        id,
        name: stringValue(data.name),
        onboardingCompletedAt: stringValue(data.onboardingCompletedAt),
        role: stringValue(data.role),
        username,
      };
    } catch {
      return null;
    }
  };

export class BioApiError extends Error {
  public status: number;

  public constructor(message: string, status = 0) {
    super(message);
    this.name = "BioApiError";
    this.status = status;
  }
}

const nonNegativeInteger = (value: unknown): number =>
    Math.max(0, Math.round(numberValue(value) ?? 0)),
  nonNegativeNumber = (value: unknown): number =>
    Math.max(0, numberValue(value) ?? 0),
  fetchBioJson = async <T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const token = getBioAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(`${API_V1_URL}${path}`, {
        ...init,
        credentials: "include",
        headers,
      });
    } catch {
      throw new BioApiError("SoundKit is unavailable right now.");
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : `SoundKit request failed (${response.status}).`;
      throw new BioApiError(message, response.status);
    }

    return payload as T;
  },
  normalizeAnalyticsOverview = (value: unknown): BioAnalyticsOverview => {
    const data = isRecord(value) ? value : {};
    return {
      estimatedEarningsCents: nonNegativeInteger(data.estimatedEarningsCents),
      premiumSupporters: nonNegativeInteger(data.premiumSupporters),
      totalFollowers: nonNegativeInteger(data.totalFollowers),
      totalPlays: nonNegativeInteger(data.totalPlays),
      totalQualifiedStreams: nonNegativeInteger(data.totalQualifiedStreams),
      uniqueListeners: nonNegativeInteger(data.uniqueListeners),
    };
  },
  normalizeBioRecentTracks = (value: unknown): BioRecentTrack[] => {
    let rawItems: unknown[] = [];
    if (Array.isArray(value)) {
      rawItems = value;
    } else if (isRecord(value) && Array.isArray(value.items)) {
      rawItems = value.items;
    }

    return rawItems.flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }

      const artistName = stringValue(item.artist),
        id = stringValue(item.id),
        lastPlayedAt = stringValue(item.lastPlayed),
        title = stringValue(item.title);
      if (!(artistName && id && lastPlayedAt && title)) {
        return [];
      }

      return [
        {
          artistName,
          artistUsername: stringValue(item.artistSlug),
          coverArtUrl: apiMediaUrl(stringValue(item.cover)),
          duration: stringValue(item.duration) ?? "0:00",
          id,
          lastPlayedAt,
          timesPlayed: nonNegativeInteger(item.timesPlayed),
          title,
        },
      ];
    });
  },
  normalizeAnalyticsTimeseries = (value: unknown): BioAnalyticsTimeseries => {
    const data = isRecord(value) ? value : {},
      rawPoints = Array.isArray(data.points) ? data.points : [];
    return {
      metric: stringValue(data.metric) ?? "plays",
      points: rawPoints.flatMap((point) => {
        if (!isRecord(point)) {
          return [];
        }
        const date = stringValue(point.date),
          label = stringValue(point.label);
        return date && label
          ? [{ date, label, value: nonNegativeInteger(point.value) }]
          : [];
      }),
      range: stringValue(data.range) ?? "7d",
      total: nonNegativeInteger(data.total),
    };
  },
  normalizeAnalyticsSources = (value: unknown): BioAnalyticsSources => {
    const data = isRecord(value) ? value : {},
      rawSources = Array.isArray(data.sources) ? data.sources : [];
    return {
      sources: rawSources.flatMap((source) => {
        if (!isRecord(source)) {
          return [];
        }
        const label = stringValue(source.label),
          sourceType = stringValue(source.sourceType);
        return label && sourceType
          ? [
              {
                count: nonNegativeInteger(source.count),
                label,
                percentage: nonNegativeNumber(source.percentage),
                sourceType,
              },
            ]
          : [];
      }),
      total: nonNegativeInteger(data.total),
    };
  },
  normalizeAnalyticsLocations = (value: unknown): BioAnalyticsLocations => {
    const data = isRecord(value) ? value : {},
      rawLocations = Array.isArray(data.locations) ? data.locations : [],
      rawRegions = Array.isArray(data.regions) ? data.regions : [];
    return {
      hasEnoughData: Boolean(data.hasEnoughData) || rawRegions.length > 0,
      locations: rawLocations.flatMap((location) => {
        if (!isRecord(location)) {
          return [];
        }
        return [
          {
            city: stringValue(location.city),
            countryCode: stringValue(location.countryCode),
            hasEnoughData: Boolean(location.hasEnoughData),
            listeners: nonNegativeInteger(location.listeners),
            percentage: nonNegativeNumber(location.percentage),
            plays: nonNegativeInteger(location.plays),
            regionCode: stringValue(location.regionCode),
            regionName: stringValue(location.regionName),
          },
        ];
      }),
      regions: rawRegions.flatMap((region) => {
        if (!isRecord(region)) {
          return [];
        }
        const regionCode = stringValue(region.regionCode) ?? "other",
          regionName =
            stringValue(region.regionName) ??
            stringValue(region.regionCode) ??
            "Unknown";
        return [
          {
            countryCode: stringValue(region.countryCode),
            listeners: nonNegativeInteger(region.listeners),
            percentage: nonNegativeNumber(region.percentage),
            plays: nonNegativeInteger(region.plays),
            regionCode,
            regionName,
          },
        ];
      }),
      totalListeners: nonNegativeInteger(data.totalListeners),
      totalPlays: nonNegativeInteger(data.totalPlays),
    };
  },
  normalizeArtistEarnings = (value: unknown): BioArtistEarnings => {
    const data = isRecord(value) ? value : {},
      rawStatements = Array.isArray(data.statements) ? data.statements : [];
    return {
      availableBalanceCents: nonNegativeInteger(data.availableBalanceCents),
      estimatedThisMonthCents: nonNegativeInteger(data.estimatedThisMonthCents),
      nextEstimatedPayoutDate:
        stringValue(data.nextEstimatedPayoutDate) ?? "End of month",
      paidLifetimeCents: nonNegativeInteger(data.paidLifetimeCents),
      payoutMinimumCents: nonNegativeInteger(data.payoutMinimumCents),
      payoutProgressPercent: Math.min(
        100,
        nonNegativeNumber(data.payoutProgressPercent)
      ),
      pendingReserveCents: nonNegativeInteger(data.pendingReserveCents),
      statements: rawStatements.flatMap((statement) => {
        if (!isRecord(statement)) {
          return [];
        }
        const monthLabel = stringValue(statement.monthLabel),
          periodEndsAt = stringValue(statement.periodEndsAt),
          periodStartsAt = stringValue(statement.periodStartsAt);
        return monthLabel && periodEndsAt && periodStartsAt
          ? [
              {
                creatorRewardsCents: nonNegativeInteger(
                  statement.creatorRewardsCents
                ),
                monthLabel,
                musicSalesCents: nonNegativeInteger(statement.musicSalesCents),
                periodEndsAt,
                periodStartsAt,
                plays: nonNegativeInteger(statement.plays),
                qualifiedStreams: nonNegativeInteger(
                  statement.qualifiedStreams
                ),
                tipsCents: nonNegativeInteger(statement.tipsCents),
                totalEarningsCents: nonNegativeInteger(
                  statement.totalEarningsCents
                ),
              },
            ]
          : [];
      }),
    };
  },
  normalizeTipsOverview = (value: unknown): BioTipsOverview => {
    const data = isRecord(value) ? value : {},
      rawTips = Array.isArray(data.tips) ? data.tips : [];
    return {
      averageTipCents: nonNegativeInteger(data.averageTipCents),
      supporterCount: nonNegativeInteger(data.supporterCount),
      tips: rawTips.flatMap((tip) => {
        if (!isRecord(tip)) {
          return [];
        }
        const id = stringValue(tip.id),
          createdAt = stringValue(tip.createdAt),
          fanDisplayName = stringValue(tip.fanDisplayName);
        return id && createdAt && fanDisplayName
          ? [
              {
                amountCents: nonNegativeInteger(tip.amountCents),
                createdAt,
                fanDisplayName,
                id,
                message: stringValue(tip.message),
              },
            ]
          : [];
      }),
      totalTipCount: nonNegativeInteger(data.totalTipCount),
      totalTipsCents: nonNegativeInteger(data.totalTipsCents),
    };
  },
  normalizeSellerStatus = (value: unknown): BioSellerStatus => {
    const data = isRecord(value) ? value : {},
      { onboardingStatus } = data;
    return {
      chargesEnabled: data.chargesEnabled === true,
      detailsSubmitted: data.detailsSubmitted === true,
      onboardingStatus:
        onboardingStatus === "pending" ||
        onboardingStatus === "restricted" ||
        onboardingStatus === "enabled" ||
        onboardingStatus === "rejected"
          ? onboardingStatus
          : "not_started",
      payoutsEnabled: data.payoutsEnabled === true,
    };
  };

export const loadBioAnalyticsOverview =
  async (): Promise<BioAnalyticsOverview> =>
    normalizeAnalyticsOverview(
      await fetchBioJson("/analytics/overview?scope=bio")
    );

export const loadBioAnalyticsTimeseries = async (
  metric: "plays" | "qualified_streams" | "unique_listeners" = "plays",
  range: "7d" | "28d" | "90d" | "12m" = "7d"
): Promise<BioAnalyticsTimeseries> =>
  normalizeAnalyticsTimeseries(
    await fetchBioJson(
      `/analytics/timeseries?metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}&scope=bio`
    )
  );

export const loadBioAnalyticsSources = async (): Promise<BioAnalyticsSources> =>
  normalizeAnalyticsSources(await fetchBioJson("/analytics/sources?scope=bio"));

export const loadBioAnalyticsLocations =
  async (): Promise<BioAnalyticsLocations> =>
    normalizeAnalyticsLocations(
      await fetchBioJson("/analytics/locations?scope=bio")
    );

export const loadBioRecentTracks = async (): Promise<BioRecentTrack[]> =>
  normalizeBioRecentTracks(await fetchBioJson("/library/recent"));

export const loadBioArtistEarnings = async (): Promise<BioArtistEarnings> =>
  normalizeArtistEarnings(await fetchBioJson("/analytics/earnings"));

export const loadBioTips = async (limit = 20): Promise<BioTipsOverview> =>
  normalizeTipsOverview(
    await fetchBioJson(`/payments/tips?limit=${encodeURIComponent(limit)}`)
  );

export const loadBioSellerStatus = async (): Promise<BioSellerStatus> =>
  normalizeSellerStatus(await fetchBioJson("/seller/status"));

export const loadBioProject = async (
  idOrSlug: string
): Promise<BioProjectDetail | null> => {
  try {
    const encodedId = encodeURIComponent(idOrSlug);
    const response = await fetch(`${API_V1_URL}/projects/public/${encodedId}`, {
      headers: { Accept: "application/json" },
    });
    const data = await readJson(response);

    if (!data || typeof data !== "object") {
      return null;
    }

    const raw = data as Record<string, unknown>,
      artistRecord = isRecord(raw.artist) ? raw.artist : null,
      artistName =
        stringValue(raw.artistName) ??
        stringValue(artistRecord?.name) ??
        stringValue(raw.ownerName) ??
        "SoundKit Artist",
      artistUsername =
        stringValue(raw.artistUsername) ??
        stringValue(artistRecord?.username) ??
        stringValue(raw.ownerUsername),
      rawTracks = Array.isArray(raw.tracks) ? raw.tracks : [],
      tracks = rawTracks.flatMap((track) => {
        const normalized = normalizeTrack(track, artistName, artistUsername);
        return normalized ? [normalized] : [];
      });

    return {
      artistName,
      artistUsername,
      coverArtUrl: apiMediaUrl(stringValue(raw.coverArtUrl)),
      description: stringValue(raw.description),
      genre: stringValue(raw.genre),
      id: stringValue(raw.id) ?? idOrSlug,
      isPublic: raw.isPublic !== false,
      projectType:
        raw.projectType === "ep" ||
        raw.projectType === "mixtape" ||
        raw.projectType === "single"
          ? raw.projectType
          : "album",
      releaseDate: stringValue(raw.releaseDate) ?? stringValue(raw.releaseAt),
      slug: stringValue(raw.slug) ?? idOrSlug,
      title: stringValue(raw.title) ?? "Untitled Project",
      trackCount: numberValue(raw.trackCount) ?? tracks.length,
      tracks,
    };
  } catch {
    return null;
  }
};

export const loadBioVideo = async (
  videoId: string
): Promise<BioVideoDetail | null> => {
  try {
    const encodedId = encodeURIComponent(videoId);
    const response = await fetch(`${API_V1_URL}/videos/${encodedId}`, {
      headers: { Accept: "application/json" },
    });
    const data = await readJson(response);

    if (!data || typeof data !== "object") {
      return null;
    }

    const raw = data as Record<string, unknown>,
      normalized = normalizeVideo(raw);
    if (!normalized) {
      return null;
    }

    const playbackPolicy =
        raw.playbackPolicy === "signed" ? "signed" : "public",
      sourceProvider = raw.sourceProvider === "external" ? "external" : "mux";

    return {
      ...normalized,
      creatorName: normalized.creatorName ?? "SoundKit Artist",
      creatorUsername: normalized.creatorUsername ?? "",
      description: stringValue(raw.description),
      externalPlaybackUrl: safeExternalUrl(
        stringValue(raw.externalPlaybackUrl)
      ),
      genre: stringValue(raw.genre),
      muxPlaybackId: stringValue(raw.muxPlaybackId),
      playbackPolicy,
      sourceProvider,
      videoKind: stringValue(raw.videoKind) ?? "music_video",
    };
  } catch {
    return null;
  }
};

export const loadBioLiveExperience = async (
  experienceId: string
): Promise<BioLiveExperienceDetail | null> => {
  try {
    const encodedId = encodeURIComponent(experienceId);
    const response = await fetchBio(
      `${API_V1_URL}/live/experiences/${encodedId}`,
      {
        headers: { Accept: "application/json" },
      }
    );
    let data = await readJson(response);

    if (!data && response?.status === 403) {
      const publicResponse = await fetchBio(
          `${API_V1_URL}/live/experiences/public`,
          { headers: { Accept: "application/json" } }
        ),
        publicData = await readJson(publicResponse);
      data = Array.isArray(publicData)
        ? (publicData.find(
            (experience) =>
              isRecord(experience) && experience.id === experienceId
          ) ?? null)
        : null;
    }

    if (!isRecord(data)) {
      return null;
    }

    const raw = data,
      normalized = normalizeLiveStream({ ...raw, id: raw.id ?? experienceId });
    if (!normalized) {
      return null;
    }

    return {
      ...normalized,
      description: stringValue(raw.description),
      genre: stringValue(raw.genre),
      hostDisplayName:
        stringValue(raw.hostDisplayName) ??
        stringValue(raw.creatorName) ??
        (normalized.creatorUsername ? `@${normalized.creatorUsername}` : null),
      scheduledStartAt:
        stringValue(raw.scheduledStartAt) ?? stringValue(raw.startsAt),
      startedAt: stringValue(raw.startedAt),
      streamPlaybackUrl:
        apiMediaUrl(stringValue(raw.streamPlaybackUrl)) ??
        apiMediaUrl(stringValue(raw.playbackUrl)),
      viewerCount: normalized.viewerCount ?? 0,
    };
  } catch {
    return null;
  }
};
