import { once } from "node:events";
import { createServer } from "node:http";

const json = (response, status, body, origin) => {
  response.writeHead(status, {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,cookie",
    "access-control-allow-origin": origin,
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
};

const mockUser = (session) => {
  if (session === "admin") {
    return {
      accountType: "artist",
      displayName: "CG Admin",
      id: "user_admin",
      onboardingCompletedAt: "2026-06-22T12:00:00.000Z",
      username: "cg_admin",
    };
  }

  if (session === "complete") {
    return {
      accountType: "artist",
      displayName: "Complete Artist",
      id: "user_complete",
      onboardingCompletedAt: "2026-05-24T12:00:00.000Z",
      username: "complete_artist",
    };
  }

  if (session === "fan_incomplete") {
    return {
      accountType: "fan",
      displayName: "Fan",
      id: "user_fan",
      onboardingCompletedAt: null,
      username: "fan_test",
    };
  }

  if (session === "incomplete") {
    return {
      accountType: "artist",
      displayName: "Artist",
      id: "user_artist",
      onboardingCompletedAt: null,
      username: "artist_test",
    };
  }

  return null;
};

const liveRoom = (roomId) => {
  const isBattle = roomId.includes("battle");
  const isStream = roomId.includes("stream");
  let kind = "party";
  let title = "Single Album Spotlight";

  if (isBattle) {
    kind = "battle";
    title = "West Coast Showdown";
  } else if (isStream) {
    kind = "stream";
    title = "Beat Making From The First Drum Hit";
  }

  const track = {
    artistName: isBattle ? "DJ Nova" : "Luna Eclipse",
    coverArtUrl: isStream
      ? "/music-battle-video-thumbnail.jpg"
      : "/summer-music-album-cover.png",
    durationMs: 205_000,
    id: `${roomId}-track-1`,
    lyrics: [
      {
        endMs: 12_000,
        startMs: 0,
        text: "Sunset bleeding gold on the dashboard",
      },
      {
        endMs: 24_000,
        startMs: 12_000,
        text: "Every chorus keeps the room glowing",
      },
    ],
    status: "playing",
    title: isStream ? "Neon Draft" : "Summer Nights",
  };

  return {
    battle: isBattle
      ? {
          artists: [
            {
              avatarUrl: "/diverse-user-avatars.png",
              id: "artist-dj-nova",
              isMuted: false,
              name: "DJ Nova",
              roundsWon: 1,
              stagePosition: "left",
              verified: true,
            },
            {
              avatarUrl: "/diverse-user-avatars.png",
              id: "artist-mc-rhythm",
              isMuted: true,
              name: "MC Rhythm",
              roundsWon: 1,
              stagePosition: "right",
              verified: false,
            },
          ],
          currentRoundId: "round-1",
          rounds: [
            {
              artistATrack: track,
              artistBTrack: {
                ...track,
                artistName: "MC Rhythm",
                id: `${roomId}-track-2`,
                title: "Urban Flow",
              },
              id: "round-1",
              isTiebreaker: false,
              number: 1,
              status: "voting",
              voteTotals: { "artist-dj-nova": 12, "artist-mc-rhythm": 10 },
              winnerArtistId: null,
            },
          ],
          tiePolicy: "If the rounds end tied, a tiebreaker round unlocks.",
        }
      : undefined,
    chat: [
      {
        id: `${roomId}-chat-1`,
        message: "This room is synced.",
        sentAt: "2026-05-26T12:00:00.000Z",
        userName: "Listener",
      },
    ],
    createdAt: "2026-05-26T12:00:00.000Z",
    currentTrackId: track.id,
    hostName: isStream ? "Neon Pulse" : "Luna Eclipse",
    id: roomId,
    kind,
    status: "live",
    summary: "A live room with chat, track context, and lyrics.",
    title,
    tracklist: [track],
    viewerCount: 512,
  };
};

const platformSettings = {
  defaultExploreRegion: "us-arkansas",
  defaultExploreRegionType: "north-america",
  useGlobalExploreHome: true,
};

const mockTracks = [
  {
    artistName: "Luna Eclipse",
    artistUsername: "luna-eclipse",
    coverArtUrl: "/summer-music-album-cover.png",
    duration: "3:24",
    genre: "R&B/Soul",
    id: "track_summer_nights",
    isForSale: true,
    isPublic: true,
    plays: 2_400_000,
    price: "$2.99",
    priceCents: 299,
    title: "Summer Nights",
  },
];

const mockArtists = [
  {
    avatarUrl: "/diverse-user-avatars.png",
    battleCount: 12,
    followers: 124_000,
    genre: "R&B/Soul",
    id: "artist_luna_eclipse",
    location: "Global",
    name: "Luna Eclipse",
    rank: 1,
    roles: ["musician"],
    username: "luna-eclipse",
    verified: true,
    weeklyPlays: 2_400_000,
  },
  {
    avatarUrl: "/diverse-user-avatars.png",
    battleCount: 9,
    followers: 89_000,
    genre: "Electronic",
    id: "artist_neon_pulse",
    location: "Global",
    name: "Neon Pulse",
    rank: 2,
    roles: ["producer"],
    username: "neon-pulse",
    verified: true,
    weeklyPlays: 1_800_000,
  },
];

const mockVideos = [
  {
    creatorName: "Luna Eclipse",
    creatorUsername: "luna-eclipse",
    duration: "3:42",
    id: "video_midnight_vibes_mv",
    muxPlaybackId: null,
    playbackPolicy: "public",
    sourceProvider: "external",
    status: "ready",
    thumbnailUrl: "/music-video-thumbnail.png",
    title: "Midnight Vibes",
    verifiedOnPlatform: true,
    videoKind: "music_video",
    viewCount: "42K",
  },
];

const mockBattles = [
  {
    featuredRank: 1,
    format: "best_of_5",
    genre: "Hip-Hop",
    id: "battle_west_coast_showdown",
    isFeatured: true,
    joinMode: "waiting_room",
    phaseEndsAt: new Date(Date.now() + 120_000).toISOString(),
    queueSize: 128,
    round: {
      current: 1,
      id: "round-1",
      isVoting: true,
      status: "active",
      total: 5,
    },
    status: "live",
    title: "West Coast Showdown",
    tracks: [
      {
        artist: "DJ Nova",
        cover: null,
        id: "battle_west_coast_track_1",
        title: "Coastline",
        votes: 1840,
      },
      {
        artist: "MC Rhythm",
        cover: null,
        id: "battle_west_coast_track_2",
        title: "Urban Flow",
        votes: 1296,
      },
    ],
    viewerCount: 4321,
    visibility: "premium_only",
  },
];

export const createMockApiServer = async ({
  host = "127.0.0.1",
  port = 3000,
  webOrigin = "http://127.0.0.1:4311",
} = {}) => {
  const server = createServer((request, response) => {
    response.setHeader("access-control-allow-origin", webOrigin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("access-control-allow-headers", "content-type,cookie");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    const session = request.headers.cookie
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("soundkit_test_session="))
      ?.split("=")[1];

    if (url.pathname === "/test/session/admin") {
      response.writeHead(302, {
        location: `${webOrigin}/dashboard/admin`,
        "set-cookie": "soundkit_test_session=admin; Path=/; SameSite=Lax",
      });
      response.end();
      return;
    }

    if (url.pathname === "/auth/get-session") {
      if (session !== "admin") {
        json(response, 200, null, webOrigin);
        return;
      }

      json(
        response,
        200,
        {
          session: {
            expiresAt: "2026-07-22T12:00:00.000Z",
            id: "session_admin",
            token: "test-token",
            userId: "user_admin",
          },
          user: {
            banned: false,
            createdAt: "2026-06-22T12:00:00.000Z",
            email: "cg@rocktownlabs.com",
            emailVerified: true,
            id: "user_admin",
            name: "CG Admin",
            role: "admin",
            updatedAt: "2026-06-22T12:00:00.000Z",
          },
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/auth/admin/list-users") {
      json(
        response,
        200,
        {
          limit: 100,
          offset: 0,
          total: 2,
          users: [
            {
              banned: false,
              createdAt: "2026-06-22T12:00:00.000Z",
              email: "cg@rocktownlabs.com",
              emailVerified: true,
              id: "user_admin",
              name: "CG Admin",
              role: "admin",
              updatedAt: "2026-06-22T12:00:00.000Z",
            },
            {
              banned: false,
              createdAt: "2026-06-21T12:00:00.000Z",
              email: "artist@example.com",
              emailVerified: true,
              id: "user_artist_2",
              name: "Arkansas Artist",
              role: "user",
              updatedAt: "2026-06-21T12:00:00.000Z",
            },
          ],
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/admin/access") {
      json(response, 200, { isAdmin: true }, webOrigin);
      return;
    }

    if (url.pathname === "/v1/admin/overview") {
      json(
        response,
        200,
        {
          commerce: {
            grossRevenueCents: 12_500,
            platformFeeCents: 1250,
            successfulTransactions: 4,
          },
          content: {
            communities: 1,
            listeningParties: 2,
            openVerses: 3,
            projects: 4,
            tracks: 8,
            videos: 2,
          },
          operations: {
            activeOpenVerses: 2,
            publishedTracks: 5,
            readyVideos: 1,
            releasedProjects: 1,
            scheduledListeningParties: 1,
          },
          people: {
            admins: 1,
            artists: 1,
            bannedUsers: 0,
            fans: 0,
            users: 2,
          },
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/admin/settings") {
      json(response, 200, platformSettings, webOrigin);
      return;
    }

    if (url.pathname === "/v1/discover/home") {
      json(
        response,
        200,
        {
          featuredArtists: mockArtists,
          featuredBattles: mockBattles,
          featuredTracks: mockTracks,
          settings: platformSettings,
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/tracks" || url.pathname === "/v1/tracks/") {
      json(response, 200, mockTracks, webOrigin);
      return;
    }

    if (url.pathname === "/v1/artists" || url.pathname === "/v1/artists/") {
      json(response, 200, mockArtists, webOrigin);
      return;
    }

    if (url.pathname === "/v1/videos" || url.pathname === "/v1/videos/") {
      json(response, 200, mockVideos, webOrigin);
      return;
    }

    if (url.pathname === "/v1/battles" || url.pathname === "/v1/battles/") {
      json(response, 200, mockBattles, webOrigin);
      return;
    }

    if (
      url.pathname === "/v1/listening-parties" ||
      url.pathname === "/v1/listening-parties/"
    ) {
      json(response, 200, [], webOrigin);
      return;
    }

    if (url.pathname === "/v1/search") {
      json(
        response,
        200,
        {
          artists: mockArtists,
          projects: [],
          tracks: mockTracks,
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/me" || url.pathname === "/v1/me/") {
      const user = mockUser(session);

      if (!user) {
        json(
          response,
          401,
          { message: "Authentication is required." },
          webOrigin
        );
        return;
      }

      json(
        response,
        200,
        {
          activeWorkspace: null,
          entitlements: {
            activePlanCode: null,
            canCreateLiveBattles: false,
            canHostLiveStreams: false,
            canViewLiveBattles: false,
            canVoteLiveBattles: false,
            canWatchCreatorStreams: false,
            isPremium: false,
          },
          user,
          workspaces: [],
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/onboarding/username-availability") {
      const username = (url.searchParams.get("username") ?? "")
        .trim()
        .toLowerCase();
      const reserved = username === "soundkit";

      json(
        response,
        200,
        {
          available: !reserved,
          message: reserved
            ? "That username is reserved."
            : "Username is available.",
          reason: reserved ? "reserved" : "available",
          username,
        },
        webOrigin
      );
      return;
    }

    const liveRoomMatch = url.pathname.match(/^\/v1\/live\/rooms\/([^/]+)$/);

    if (liveRoomMatch) {
      json(response, 200, liveRoom(liveRoomMatch[1]), webOrigin);
      return;
    }

    const liveRoomMutationMatch = url.pathname.match(
      /^\/v1\/live\/rooms\/([^/]+)\/(chat|vote)$/
    );

    if (liveRoomMutationMatch) {
      json(response, 200, liveRoom(liveRoomMutationMatch[1]), webOrigin);
      return;
    }

    json(response, 404, { message: `Not Found - ${url.pathname}` }, webOrigin);
  });

  server.listen(port, host);
  await once(server, "listening");
  return server;
};
