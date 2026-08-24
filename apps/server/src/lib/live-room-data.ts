import type { BattleCoordination, BattlePhase } from "@/lib/live-battle-state";

export type LiveRoomKind = "battle" | "party" | "stream";
export type LiveRoomViewerRole =
  | "admin"
  | "artist_a"
  | "artist_b"
  | "fan"
  | "host";

export interface LiveRoomChatMessage {
  id: string;
  message: string;
  sentAt: string;
  userName: string;
}

export interface LiveRoomLyricsLine {
  endMs: number;
  startMs: number;
  text: string;
}

export interface LiveRoomTrack {
  artistName: string;
  coverArtUrl: string;
  durationMs: number;
  id: string;
  lyrics: LiveRoomLyricsLine[];
  status: "played" | "playing" | "queued";
  title: string;
}

export interface LiveRoomArtist {
  avatarUrl: string;
  id: string;
  isMuted: boolean;
  name: string;
  roundsWon: number;
  stagePosition: "left" | "right";
  verified: boolean;
}

export interface LiveBattleRound {
  artistATrack: LiveRoomTrack;
  artistBTrack: LiveRoomTrack;
  id: string;
  isTiebreaker: boolean;
  number: number;
  status: "complete" | "live" | "queued" | "voting";
  voteTotals: Record<string, number>;
  winnerArtistId: null | string;
}

export interface LiveBattleArtistControls {
  availableTrackIds: string[];
  currentTrackId: string | null;
  selectedNextTrackId: string | null;
  usedTrackIds: string[];
}

export interface LivePartyPlayback {
  hostMode: "off_camera" | "on_camera";
  hostUserId: string;
  playbackState: "paused" | "playing";
  positionMs: number;
  stateChangedAt: number;
  trackId: string | null;
  trackIndex: number;
}

export interface LiveStreamLifecycle {
  errorCode?: string | null;
  errorMessage?: string | null;
  ingestStatus:
    | "connected"
    | "disconnected"
    | "error"
    | "idle"
    | "reconnecting";
  reconnectUntil?: number | null;
  replayStatus: "available" | "none" | "processing";
}

export interface LiveRoomState {
  battle?: {
    artistControls?: LiveBattleArtistControls;
    artistControlsByUserId?: Record<string, LiveBattleArtistControls>;
    artists: [LiveRoomArtist, LiveRoomArtist];
    queueSize?: number;
    queueUserIds?: string[];
    viewerQueueStatus?: "admitted" | "queued" | "waiting" | null;
    waitingRoomCount?: number;
    coordination?: BattleCoordination;
    currentRoundId: string;
    phase?: BattlePhase;
    rounds: LiveBattleRound[];
    tiePolicy: string;
  };
  party?: {
    playback: LivePartyPlayback;
  };
  role?: LiveRoomViewerRole;
  serverNow?: number;
  stream?: LiveStreamLifecycle;
  chat: LiveRoomChatMessage[];
  createdAt: string;
  currentTrackId: string;
  hostName: string;
  id: string;
  kind: LiveRoomKind;
  startsAt?: string | null;
  status: "ended" | "live" | "upcoming";
  summary: string;
  title: string;
  tracklist: LiveRoomTrack[];
  viewerCount: number;
}

const nowIso = () => new Date().toISOString(),
  lyrics = (lines: string[]): LiveRoomLyricsLine[] =>
    lines.map((text, index) => ({
      endMs: (index + 1) * 12_000,
      startMs: index * 12_000,
      text,
    })),
  summerNightsLyrics = lyrics([
    "Sunset bleeding gold on the dashboard",
    "Windows down, we follow where the bass goes",
    "Every chorus feels like home returning",
    "Summer nights keep the whole room glowing",
  ]),
  midnightLyrics = lyrics([
    "Meet me where the city lights are softer",
    "I kept a melody tucked under my coat",
    "If the rhythm breaks, we rebuild it louder",
    "Midnight knows the words we never wrote",
  ]),
  neonLyrics = lyrics([
    "Neon pulse and a wire full of thunder",
    "Your voice cuts through the static in my head",
    "Let the floor shake loose another memory",
    "We are bright enough to wake the dead",
  ]),
  makeTrack = (
    id: string,
    title: string,
    artistName: string,
    coverArtUrl: string,
    status: LiveRoomTrack["status"],
    trackLyrics: LiveRoomLyricsLine[]
  ): LiveRoomTrack => ({
    artistName,
    coverArtUrl,
    durationMs: 205_000,
    id,
    lyrics: trackLyrics,
    status,
    title,
  });

export const sampleLiveRooms: LiveRoomState[] = [
  {
    chat: [
      {
        id: "party-chat-1",
        message: "The lyric panel makes this feel like a release night.",
        sentAt: nowIso(),
        userName: "Lena",
      },
      {
        id: "party-chat-2",
        message: "Track two is already going on my late night playlist.",
        sentAt: nowIso(),
        userName: "Marcus",
      },
    ],
    createdAt: nowIso(),
    currentTrackId: "party-track-2",
    hostName: "Luna Eclipse",
    id: "single-album-party",
    kind: "party",
    status: "live",
    summary:
      "A front-to-back album room with synced chat, queue context, and readable lyrics while the record plays.",
    title: "Single Album Spotlight",
    tracklist: [
      makeTrack(
        "party-track-1",
        "Opening Glow",
        "Luna Eclipse",
        "/night-music-album-cover.webp",
        "played",
        midnightLyrics
      ),
      makeTrack(
        "party-track-2",
        "Summer Nights",
        "Luna Eclipse",
        "/summer-music-album-cover.webp",
        "playing",
        summerNightsLyrics
      ),
      makeTrack(
        "party-track-3",
        "After Hours",
        "Luna Eclipse",
        "/night-music-album-cover.webp",
        "queued",
        neonLyrics
      ),
    ],
    viewerCount: 2814,
  },
  {
    battle: {
      artists: [
        {
          avatarUrl: "/placeholder-user.jpg",
          id: "artist-dj-nova",
          isMuted: false,
          name: "DJ Nova",
          roundsWon: 1,
          stagePosition: "left",
          verified: true,
        },
        {
          avatarUrl: "/placeholder-user.jpg",
          id: "artist-mc-rhythm",
          isMuted: true,
          name: "MC Rhythm",
          roundsWon: 1,
          stagePosition: "right",
          verified: false,
        },
      ],
      currentRoundId: "battle-round-3",
      rounds: [
        {
          artistATrack: makeTrack(
            "battle-a-1",
            "Midnight Drive",
            "DJ Nova",
            "/summer-music-album-cover.webp",
            "played",
            summerNightsLyrics
          ),
          artistBTrack: makeTrack(
            "battle-b-1",
            "City Lights",
            "MC Rhythm",
            "/night-music-album-cover.webp",
            "played",
            midnightLyrics
          ),
          id: "battle-round-1",
          isTiebreaker: false,
          number: 1,
          status: "complete",
          voteTotals: { "artist-dj-nova": 1247, "artist-mc-rhythm": 1089 },
          winnerArtistId: "artist-dj-nova",
        },
        {
          artistATrack: makeTrack(
            "battle-a-2",
            "Neon Dreams",
            "DJ Nova",
            "/summer-music-album-cover.webp",
            "played",
            neonLyrics
          ),
          artistBTrack: makeTrack(
            "battle-b-2",
            "Street Poetry",
            "MC Rhythm",
            "/night-music-album-cover.webp",
            "played",
            midnightLyrics
          ),
          id: "battle-round-2",
          isTiebreaker: false,
          number: 2,
          status: "complete",
          voteTotals: { "artist-dj-nova": 856, "artist-mc-rhythm": 943 },
          winnerArtistId: "artist-mc-rhythm",
        },
        {
          artistATrack: makeTrack(
            "battle-a-3",
            "Electric Pulse",
            "DJ Nova",
            "/summer-music-album-cover.webp",
            "playing",
            neonLyrics
          ),
          artistBTrack: makeTrack(
            "battle-b-3",
            "Urban Flow",
            "MC Rhythm",
            "/night-music-album-cover.webp",
            "queued",
            midnightLyrics
          ),
          id: "battle-round-3",
          isTiebreaker: false,
          number: 3,
          status: "voting",
          voteTotals: { "artist-dj-nova": 654, "artist-mc-rhythm": 712 },
          winnerArtistId: null,
        },
        {
          artistATrack: makeTrack(
            "battle-a-4",
            "Tie Break Spark",
            "DJ Nova",
            "/placeholder.svg",
            "queued",
            summerNightsLyrics
          ),
          artistBTrack: makeTrack(
            "battle-b-4",
            "Final Word",
            "MC Rhythm",
            "/placeholder.svg",
            "queued",
            midnightLyrics
          ),
          id: "battle-round-4",
          isTiebreaker: true,
          number: 4,
          status: "queued",
          voteTotals: { "artist-dj-nova": 0, "artist-mc-rhythm": 0 },
          winnerArtistId: null,
        },
      ],
      tiePolicy:
        "If the scheduled rounds end tied, SoundKit unlocks one tiebreaker song from each battle kit and runs sudden-death voting.",
    },
    chat: [
      {
        id: "battle-chat-1",
        message:
          "One artist is live, the other stage is muted until their turn.",
        sentAt: nowIso(),
        userName: "Beat Master",
      },
      {
        id: "battle-chat-2",
        message:
          "Those synchronized lyrics are making the round easy to follow.",
        sentAt: nowIso(),
        userName: "Ari",
      },
    ],
    createdAt: nowIso(),
    currentTrackId: "battle-a-3",
    hostName: "SoundKit Live",
    id: "battle-1",
    kind: "battle",
    status: "live",
    summary:
      "Turn-based artist stages, synced lyrics, live chat, and voting at the end of every round.",
    title: "West Coast Showdown",
    tracklist: [
      makeTrack(
        "battle-a-3",
        "Electric Pulse",
        "DJ Nova",
        "/summer-music-album-cover.webp",
        "playing",
        neonLyrics
      ),
      makeTrack(
        "battle-b-3",
        "Urban Flow",
        "MC Rhythm",
        "/night-music-album-cover.webp",
        "queued",
        midnightLyrics
      ),
    ],
    viewerCount: 12_547,
  },
  {
    chat: [
      {
        id: "stream-chat-1",
        message: "Watching the beat come together live is wild.",
        sentAt: nowIso(),
        userName: "Nia",
      },
      {
        id: "stream-chat-2",
        message: "Drop the drum pattern in the kit after this.",
        sentAt: nowIso(),
        userName: "Jules",
      },
    ],
    createdAt: nowIso(),
    currentTrackId: "stream-track-1",
    hostName: "Neon Pulse",
    id: "stream-1",
    kind: "stream",
    status: "live",
    summary:
      "A premium creator livestream with room chat and a live notes/lyrics rail for the current work-in-progress.",
    title: "Beat Making From The First Drum Hit",
    tracklist: [
      makeTrack(
        "stream-track-1",
        "Neon Draft",
        "Neon Pulse",
        "/music-battle-video-thumbnail.jpg",
        "playing",
        neonLyrics
      ),
    ],
    viewerCount: 1451,
  },
];

const roomAliases: Record<string, string> = {
    "album-faceoff": "single-album-party",
    "party-1": "single-album-party",
    "stream-breakdown": "stream-1",
  },
  cloneRoom = (room: LiveRoomState): LiveRoomState => structuredClone(room);

export const findSampleLiveRoom = (roomId: string) => {
  const resolvedRoomId = roomAliases[roomId] ?? roomId;
  return sampleLiveRooms.find((room) => room.id === resolvedRoomId);
};

export const createSampleLiveRoom = (roomId: string): LiveRoomState => {
  const room = findSampleLiveRoom(roomId);
  if (room) {
    return cloneRoom(room);
  }

  return {
    chat: [],
    createdAt: nowIso(),
    currentTrackId: "",
    hostName: "SoundKit Creator",
    id: roomId,
    kind: "stream",
    status: "upcoming",
    summary: "Live broadcast on SoundKit.",
    title: "Live Stream",
    tracklist: [],
    viewerCount: 0,
  };
};
