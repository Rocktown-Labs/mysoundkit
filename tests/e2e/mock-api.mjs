/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */
import { once } from "node:events";
import { createServer } from "node:http";

const normalizeGenre = (value) =>
    value
      ?.toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-+|-+$/gu, "")
      .replace(/^hip-hop-rap$/u, "hip-hop"),
  json = (response, status, body, origin) => {
    response.writeHead(status, {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type,cookie",
      "access-control-allow-origin": origin,
      "content-type": "application/json",
    });
    response.end(JSON.stringify(body));
  },
  mockUser = (session) => {
    if (session === "admin") {
      return {
        accountType: "artist",
        displayName: "CG Admin",
        id: "user_admin",
        onboardingCompletedAt: "2026-06-22T12:00:00.000Z",
        username: "cg_admin",
      };
    }

    if (session === "complete" || session === "participant") {
      return {
        accountType: "artist",
        avatarUrl: "/summer-music-album-cover.webp",
        displayName: "Complete Artist",
        id: "user_complete",
        onboardingCompletedAt: "2026-05-24T12:00:00.000Z",
        username: "complete_artist",
      };
    }

    if (session === "nonparticipant") {
      return {
        accountType: "artist",
        displayName: "Other Artist",
        id: "user_other_artist",
        onboardingCompletedAt: "2026-05-24T12:00:00.000Z",
        username: "other_artist",
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
  },
  liveRoom = (roomId, session) => {
    const isBattle = roomId.includes("battle"),
      isStream = roomId.includes("stream"),
      isParty = !isBattle && !isStream,
      isWaitingArtistBattle = roomId === "battle-waiting-artist";
    let kind = "party",
      title = "Single Album Spotlight";

    if (isBattle) {
      kind = "battle";
      title = isWaitingArtistBattle
        ? "Artist Battle Waiting Room"
        : "Artist Battle - Hip-Hop";
    } else if (isStream) {
      kind = "stream";
      title = "Beat Making From The First Drum Hit";
    }

    const track = {
      artistName: isBattle ? "DJ Nova" : "Luna Eclipse",
      coverArtUrl: isStream
        ? "/music-battle-video-thumbnail.jpg"
        : "/summer-music-album-cover.webp",
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
            artistControls:
              isWaitingArtistBattle &&
              (session === "complete" || session === "participant")
                ? {
                    availableTrackIds: [],
                    currentTrackId: null,
                    selectedKitId: null,
                    selectedNextTrackId: null,
                    usedTrackIds: [],
                  }
                : undefined,
            artists: [
              {
                avatarUrl: "/soundkit-default-avatar.svg",
                id:
                  isWaitingArtistBattle || session === "participant"
                    ? "user_complete"
                    : "artist-dj-nova",
                isMuted: false,
                name:
                  isWaitingArtistBattle || session === "participant"
                    ? "Complete Artist"
                    : "DJ Nova",
                rank: 1,
                roundsWon: 1,
                stagePosition: "left",
                verified: true,
              },
              {
                avatarUrl: "/soundkit-default-avatar.svg",
                id: "artist-mc-rhythm",
                isMuted: true,
                name: "MC Rhythm",
                rank: 7,
                roundsWon: 1,
                stagePosition: "right",
                verified: false,
              },
            ],
            coordination: isWaitingArtistBattle
              ? {
                  battleId: roomId,
                  format: "best_of_3",
                  phase: "scheduled",
                  phaseEndsAt: Date.now() + 300_000,
                  phaseStartedAt: Date.now(),
                  roundNumber: 0,
                }
              : undefined,
            currentRoundId: isWaitingArtistBattle ? "" : "round-1",
            rounds: isWaitingArtistBattle ? [] : [
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
        ...(isBattle
          ? [
              {
                id: `${roomId}-bot-chat-1`,
                message: isWaitingArtistBattle
                  ? "BattleBot: both artists are preparing the stage."
                  : "BattleBot: the next round is ready.",
                sentAt: "2026-05-26T11:59:00.000Z",
                userId: "soundkit-battlebot",
                userName: "BattleBot",
              },
            ]
          : []),
        {
          id: `${roomId}-chat-1`,
          message: "This room is synced.",
          sentAt: "2026-05-26T12:00:00.000Z",
          userName: "Listener",
        },
      ],
      createdAt: "2026-05-26T12:00:00.000Z",
      currentTrackId: isWaitingArtistBattle ? "" : track.id,
      hostName: isStream ? "Neon Pulse" : "Luna Eclipse",
      id: roomId,
      kind,
      party: isParty
        ? {
            playback: {
              hostMode: "off_camera",
              hostUserId: "user_complete",
              mediaAvailable: true,
              playbackState: "playing",
              positionMs: 0,
              stateChangedAt: Date.now(),
              trackId: track.id,
              trackIndex: 0,
            },
          }
        : undefined,
      role:
        (isWaitingArtistBattle || (isBattle && session === "participant")) &&
        (session === "complete" || session === "participant")
          ? "artist_a"
          : isParty && session === "complete"
            ? "host"
            : "fan",
      serverNow: Date.now(),
      status: isWaitingArtistBattle ? "upcoming" : "live",
      summary: "A live room with chat, track context, and lyrics.",
      title,
      tracklist: [track],
      viewerCount: 512,
    };
  },
  mockTracks = [
    {
      artistName: "Luna Eclipse",
      artistUsername: "luna-eclipse",
      coverArtUrl: "/summer-music-album-cover.webp",
      duration: "3:24",
      genre: "R&B/Soul",
      id: "track_summer_nights",
      isForSale: true,
      isPublic: true,
      plays: 2_400_000,
      releaseAt: null,
      releaseStrategy: "publish_when_ready",
      price: "$2.99",
      priceCents: 299,
      title: "Summer Nights",
    },
    {
      artistName: "Luna Eclipse",
      artistUsername: "luna-eclipse",
      coverArtUrl: "/hip-hop-album-cover.webp",
      duration: "3:12",
      genre: "Hip-Hop",
      id: "track_city_lights",
      isForSale: false,
      isPublic: true,
      plays: 1200,
      price: "$0.00",
      priceCents: 0,
      releaseAt: null,
      releaseStrategy: "publish_when_ready",
      title: "City Lights",
    },
    {
      artistName: "Luna Eclipse",
      artistUsername: "luna-eclipse",
      coverArtUrl: "/night-music-album-cover.webp",
      duration: "2:58",
      genre: "Hip-Hop",
      id: "track_after_hours",
      isForSale: false,
      isPublic: true,
      plays: 980,
      price: "$0.00",
      priceCents: 0,
      releaseAt: null,
      releaseStrategy: "publish_when_ready",
      title: "After Hours",
    },
    {
      artistName: "Luna Eclipse",
      artistUsername: "luna-eclipse",
      coverArtUrl: "/music-battle-video-thumbnail.jpg",
      duration: "4:01",
      genre: "Hip-Hop",
      id: "track_battle_ready",
      isForSale: false,
      isPublic: true,
      plays: 750,
      price: "$0.00",
      priceCents: 0,
      releaseAt: null,
      releaseStrategy: "publish_when_ready",
      title: "Battle Ready",
    },
  ],
  mockProjects = [
    {
      artistName: "Luna Eclipse",
      artistUsername: "luna-eclipse",
      collaboratorCount: 1,
      coverArtUrl: "/summer-music-album-cover.webp",
      duration: "12:44",
      genre: "Hip-Hop",
      id: "project_after_dark",
      isForSale: false,
      isPublic: true,
      projectType: "ep",
      slug: "after-dark",
      status: "released",
      title: "After Dark",
      trackCount: 4,
    },
  ],
  mockCommunities = [
    {
      artist: {
        avatarUrl: "/soundkit-default-avatar.svg",
        name: "Luna Eclipse",
        username: "luna-eclipse",
      },
      artistUserId: "artist_luna_eclipse",
      coverImageUrl: "/summer-music-album-cover.webp",
      currency: "USD",
      description: "Release notes, studio conversations, and listening rooms.",
      genre: { id: "genre-hip-hop", name: "Hip-Hop", slug: "hip-hop" },
      id: "community_luna",
      isMember: false,
      isOwner: false,
      memberCount: 128,
      monthlyPriceCents: 0,
      name: "Luna Eclipse Circle",
      slug: "luna-eclipse-circle",
      updatedAt: "2026-08-28T12:00:00.000Z",
    },
  ],
  mockCommunityMessages = [],
  mockCommunityPosts = [],
  mockCommunityMembers = [
    {
      avatarUrl: "/soundkit-default-avatar.svg",
      joinedAt: "2026-07-01T12:00:00.000Z",
      name: "Luna Eclipse",
      role: "owner",
      userId: "artist_luna_eclipse",
      username: "luna-eclipse",
    },
  ],
  mockNotificationSettings = {
    communityMentions: true,
    communityPosts: true,
    emailCollaborations: true,
    emailComments: true,
    emailFollowers: true,
    emailLive: true,
    emailMessages: true,
    emailSales: true,
    emailTrackProcessing: true,
    pushMentions: true,
    pushMessages: true,
    pushReleases: true,
  },
  mockArtists = [
    {
      avatarUrl: "/soundkit-default-avatar.svg",
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
      avatarUrl: "/soundkit-default-avatar.svg",
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
  ],
  mockVideos = [
    {
      creatorName: "Luna Eclipse",
      creatorUsername: "luna-eclipse",
      duration: "3:42",
      genre: "Hip-Hop",
      id: "video_midnight_vibes_mv",
      muxPlaybackId: "mux_midnight_vibes_mv",
      playbackPolicy: "public",
      sourceProvider: "mux",
      status: "ready",
      thumbnailUrl: "/music-video-thumbnail.webp",
      title: "Midnight Vibes",
      verifiedOnPlatform: true,
      videoKind: "music_video",
      viewCount: "42K",
    },
    {
      creatorName: "CG Stewart",
      creatorUsername: "cgstewart",
      duration: "0:00",
      externalPlaybackUrl: "https://www.youtube.com/watch?v=4U4tFM8iapc",
      genre: "Hip-Hop",
      id: "video_all_votes_matter",
      muxPlaybackId: null,
      playbackPolicy: "public",
      sourceProvider: "external",
      status: "ready",
      thumbnailUrl: "/music-video-thumbnail.webp",
      title: "All Votes Matter",
      verifiedOnPlatform: false,
      videoKind: "music_video",
      viewCount: "0",
    },
  ],
  mockArtistMedia = {
    credits: [
      {
        contentId: "track_city_lights",
        contentType: "track",
        coverArtUrl: "/hip-hop-album-cover.webp",
        ownerName: "Neon Pulse",
        ownerUsername: "neon-pulse",
        role: "songwriter",
        slug: "city-lights",
        title: "City Lights",
      },
    ],
    featuredProjects: [
      {
        ...mockProjects[0],
        artistName: "Neon Pulse",
        artistUsername: "neon-pulse",
        id: "project_neon_city",
        slug: "neon-city",
        title: "Neon City",
      },
    ],
    featuredTracks: [
      {
        ...mockTracks[0],
        artistName: "Neon Pulse",
        artistUsername: "neon-pulse",
        id: "track_city_lights",
        slug: "city-lights",
        title: "City Lights",
      },
    ],
    projects: mockProjects,
    tracks: mockTracks,
    videos: mockVideos,
  },
  mockBattles = [
    {
      featuredRank: 1,
      format: "best_of_5",
      genre: "Hip-Hop",
      id: "battle_west_coast_showdown",
      isFeatured: true,
      joinMode: "waiting_room",
      participants: [
        {
          avatarUrl: "/soundkit-default-avatar.svg",
          id: "mock-artist-dj-nova",
          name: "DJ Nova",
          username: "dj-nova",
        },
        {
          avatarUrl: "/soundkit-default-avatar.svg",
          id: "mock-artist-mc-rhythm",
          name: "MC Rhythm",
          username: "mc-rhythm",
        },
      ],
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
      title: "Artist Battle - Hip-Hop",
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
    {
      format: "best_of_3",
      genre: "Hip-Hop",
      id: "battle-waiting-artist",
      isFeatured: false,
      joinMode: "waiting_room",
      participants: [
        {
          avatarUrl: "/soundkit-default-avatar.svg",
          id: "user_complete",
          name: "Complete Artist",
          username: "complete_artist",
        },
        {
          avatarUrl: "/soundkit-default-avatar.svg",
          id: "artist-mc-rhythm",
          name: "MC Rhythm",
          username: "mc-rhythm",
        },
      ],
      phaseEndsAt: null,
      queueSize: 0,
      round: null,
      status: "live",
      title: "Artist Battle Waiting Room",
      tracks: [],
      viewerCount: 0,
      visibility: "public",
    },
    {
      format: "best_of_3",
      genre: "Hip-Hop",
      id: "battle_upcoming_duel",
      isFeatured: false,
      joinMode: "watch_now",
      participants: [
        {
          avatarUrl: "/soundkit-default-avatar.svg",
          id: "mock-artist-luna",
          name: "Luna Eclipse",
          username: "luna-eclipse",
        },
        {
          avatarUrl: "/soundkit-default-avatar.svg",
          id: "mock-artist-neon",
          name: "Neon Pulse",
          username: "neon-pulse",
        },
      ],
      queueSize: 0,
      startsAt: "2026-09-30T20:00:00.000Z",
      status: "scheduled",
      title: "Artist Battle - Hip-Hop",
      tracks: [],
      viewerCount: 0,
      visibility: "public",
    },
  ];

export const createMockApiServer = async ({
  host = "127.0.0.1",
  port = 3000,
  webOrigin = "http://127.0.0.1:4311",
} = {}) => {
  const mockBattleChallengesByClient = new Map(),
    mockBattleKitsByClient = new Map(),
    getMockBattleChallenges = (request) => {
      const clientKey = request.headers["user-agent"] ?? "default",
        existing = mockBattleChallengesByClient.get(clientKey);
      if (existing) {
        return existing;
      }

      const challenges = [
        {
          challengerUsername: "mattalvis",
          createdAt: "2026-08-28T08:00:00.000Z",
          direction: "incoming",
          expiresAt: "2026-09-04T08:00:00.000Z",
          format: "best_of_3",
          genre: "Hip-Hop",
          id: "mock-incoming-challenge",
          message: "Let’s run it.",
          opponentUsername: "complete_artist",
          proposedDate: "2026-08-29T20:00:00.000Z",
          proposedTimeLabel: "Aug 29, 2026, 8:00 PM",
          status: "pending",
        },
        {
          challengerUsername: "complete_artist",
          createdAt: "2026-07-01T12:00:00.000Z",
          direction: "outgoing",
          expiresAt: "2026-07-08T12:00:00.000Z",
          format: "best_of_3",
          genre: "Hip-Hop",
          id: "mock-expired-challenge",
          message: null,
          opponentUsername: "stale-artist",
          proposedDate: null,
          proposedTimeLabel: null,
          status: "expired",
        },
        {
          challengerUsername: "complete_artist",
          createdAt: "2026-08-20T12:00:00.000Z",
          direction: "outgoing",
          expiresAt: "2026-08-27T12:00:00.000Z",
          format: "best_of_3",
          genre: "Hip-Hop",
          id: "mock-accepted-challenge",
          message: null,
          opponentUsername: "accepted-artist",
          proposedDate: "2026-09-30T20:00:00.000Z",
          proposedTimeLabel: "Sep 30, 2026, 8:00 PM",
          status: "accepted",
        },
      ];
      mockBattleChallengesByClient.set(clientKey, challenges);
      return challenges;
    },
    getMockBattleKits = (request) => {
      const clientKey = request.headers["user-agent"] ?? "default",
        existing = mockBattleKitsByClient.get(clientKey);
      if (existing) {
        return existing;
      }

      const kits = [];
      mockBattleKitsByClient.set(clientKey, kits);
      return kits;
    },
    server = createServer((request, response) => {
    const effectiveOrigin = request.headers.origin || webOrigin;
    response.setHeader("access-control-allow-origin", effectiveOrigin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("access-control-allow-headers", "content-type,cookie");
    response.setHeader(
      "access-control-allow-methods",
      "GET,POST,PATCH,PUT,DELETE,OPTIONS"
    );

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    console.log("[MockAPI]", request.method, url.pathname);
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
      if (
        session !== "admin" &&
        session !== "complete" &&
        session !== "participant" &&
        session !== "nonparticipant"
      ) {
        json(response, 200, null, webOrigin);
        return;
      }

      const authenticatedUser = mockUser(session),
        isAdminSession = session === "admin";
      json(
        response,
        200,
        {
          session: {
            expiresAt: "2026-07-22T12:00:00.000Z",
            id: `session_${session}`,
            token: "test-token",
            userId: authenticatedUser.id,
          },
          user: {
            banned: false,
            createdAt: "2026-06-22T12:00:00.000Z",
            email: isAdminSession
              ? "cg@rocktownlabs.com"
              : "complete@rocktownlabs.com",
            emailVerified: true,
            id: authenticatedUser.id,
            name: authenticatedUser.displayName,
            role: isAdminSession ? "admin" : "user",
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

    if (url.pathname === "/v1/admin/finance/payments/users") {
      json(
        response,
        200,
        {
          users: [
            {
              accountType: "artist",
              banned: false,
              createdAt: "2026-06-22T12:00:00.000Z",
              email: "cg@rocktownlabs.com",
              id: "user_admin",
              name: "CG Admin",
              premiumPlan: "artist_premium",
              premiumStatus: "active",
              role: "admin",
              username: "cg_admin",
            },
            {
              accountType: "artist",
              banned: false,
              createdAt: "2026-06-21T12:00:00.000Z",
              email: "artist@example.com",
              id: "user_artist_2",
              name: "Arkansas Artist",
              premiumPlan: null,
              premiumStatus: null,
              role: "user",
              username: "arkansas_artist",
            },
          ],
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/discover/genres") {
      const genres = [
        "hip-hop",
        "rb-soul",
        "electronic",
        "pop",
        "spoken-word",
        "rock",
        "jazz",
        "afrobeats",
        "latin",
        "country",
        "reggae",
        "indie",
        "metal",
      ].map((slug) => ({
        id: `genre_${slug}`,
        name: slug === "hip-hop" ? "Hip Hop" : slug.replaceAll("-", " "),
        slug,
        totalCount: slug === "hip-hop" ? 8 : 0,
        trackCount: slug === "hip-hop" ? 3 : 0,
        videoCount: slug === "hip-hop" ? 1 : 0,
      }));
      json(response, 200, genres, webOrigin);
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

    if (url.pathname === "/v1/admin/open-verses") {
      json(
        response,
        200,
        [
          {
            accessRequestCount: 0,
            baseMasterAssetId: null,
            createdAt: "2026-06-01T12:00:00.000Z",
            genre: "Hip Hop",
            id: "legacy_open_verse",
            ownerDisplayName: "Matt Alvis",
            ownerUserId: "user_artist_2",
            ownerUsername: "mattalvis",
            previewAssetId: null,
            status: "open",
            submissionCount: 0,
            title: "IYKYK open verse listing title",
            trackId: "track_iykyk",
            trackTitle: "IYKYK",
          },
        ],
        webOrigin
      );
      return;
    }

    if (
      request.method === "DELETE" &&
      url.pathname === "/v1/open-verses/legacy_open_verse"
    ) {
      json(
        response,
        200,
        { message: "Open verse listing deleted." },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/admin/genres") {
      json(
        response,
        200,
        [
          {
            battleCount: 1,
            description: "Rhythm, rhyme, and lyrical competition.",
            id: "genre_hip_hop",
            name: "Hip Hop",
            openVerseCount: 1,
            partyCount: 1,
            projectCount: 1,
            slug: "hip-hop",
            totalCount: 8,
            trackCount: 3,
            videoCount: 1,
          },
        ],
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/admin/regions") {
      json(
        response,
        200,
        {
          missingCountryCount: 0,
          missingStateCount: 0,
          regions: [
            {
              artistCount: 1,
              country: "United States",
              profileCount: 2,
              projectCount: 1,
              state: "Arkansas",
              totalUploadCount: 5,
              trackCount: 3,
              videoCount: 1,
            },
          ],
          totalProfileCount: 2,
        },
        webOrigin
      );
      return;
    }

    if (
      url.pathname === "/v1/projects/public" ||
      url.pathname === "/v1/projects/public/"
    ) {
      const requestedGenre = url.searchParams.get("genre"),
        projects =
          requestedGenre && requestedGenre !== "all"
            ? mockProjects.filter(
                (project) =>
                  normalizeGenre(project.genre) === normalizeGenre(requestedGenre)
              )
            : mockProjects;
      json(response, 200, projects, webOrigin);
      return;
    }

    if (url.pathname === "/v1/tracks" || url.pathname === "/v1/tracks/") {
      const requestedGenre = url.searchParams.get("genre"),
        tracks =
          requestedGenre && requestedGenre !== "all"
            ? mockTracks.filter(
                (track) =>
                  normalizeGenre(track.genre) === normalizeGenre(requestedGenre)
              )
            : mockTracks;
      json(response, 200, tracks, webOrigin);
      return;
    }

    const trackDetailMatch = url.pathname.match(/^\/v1\/tracks\/([^/]+)$/);
    if (trackDetailMatch) {
      json(
        response,
        200,
        {
          ...mockTracks[0],
          artist: {
            avatarUrl: mockArtists[0].avatarUrl,
            handle: "luna-eclipse",
            id: "artist_luna_eclipse",
            name: "Luna Eclipse",
            roles: ["musician"],
            username: "luna-eclipse",
            verified: true,
          },
          credits: {
            artists: [
              {
                avatarUrl: null,
                displayName: "Luna Eclipse",
                id: "credit_artist_1",
                legalName: null,
                role: "artist",
                splitBps: null,
                username: "luna-eclipse",
              },
            ],
            engineers: [
              {
                avatarUrl: null,
                displayName: "Reese Nakamura",
                id: "credit_engineer_1",
                legalName: null,
                role: "engineer",
                splitBps: null,
                username: null,
              },
            ],
            producers: [
              {
                avatarUrl: null,
                displayName: "Marcus Holt",
                id: "credit_producer_1",
                legalName: null,
                role: "producer",
                splitBps: null,
                username: "marcus-holt",
              },
            ],
            vocalists: [
              {
                avatarUrl: null,
                displayName: "Cassandra Vale, Lena Ortiz",
                id: "credit_vocalist_1",
                legalName: null,
                role: "vocalist",
                splitBps: null,
                username: null,
              },
            ],
            writers: [
              {
                avatarUrl: null,
                displayName: "Cassandra Vale, Priya Desmond",
                id: "credit_writer_1",
                legalName: null,
                role: "songwriter",
                splitBps: null,
                username: null,
              },
            ],
          },
          listeningAccess: "public",
          playbackUrl: "/v1/tracks/track_summer_nights/playback",
        },
        webOrigin
      );
      return;
    }

    const artistMediaMatch = url.pathname.match(
      /^\/v1\/artists\/([^/]+)\/media$/
    );
    if (artistMediaMatch) {
      json(response, 200, mockArtistMedia, webOrigin);
      return;
    }

    const artistDetailMatch = url.pathname.match(/^\/v1\/artists\/([^/]+)$/);
    if (artistDetailMatch) {
      const artist =
        mockArtists.find((entry) => entry.username === artistDetailMatch[1]) ??
        mockArtists[0];
      json(response, 200, artist, webOrigin);
      return;
    }

    if (url.pathname === "/v1/artists" || url.pathname === "/v1/artists/") {
      const requestedGenre = url.searchParams.get("genre"),
        artists =
          requestedGenre && requestedGenre !== "all"
            ? mockArtists.filter(
                (artist) =>
                  normalizeGenre(artist.genre) === normalizeGenre(requestedGenre)
              )
            : mockArtists;
      json(response, 200, artists, webOrigin);
      return;
    }

    if (url.pathname === "/v1/videos" || url.pathname === "/v1/videos/") {
      const requestedGenre = url.searchParams.get("genre"),
        videos =
          requestedGenre && requestedGenre !== "all"
            ? mockVideos.filter(
                (video) =>
                  normalizeGenre(video.genre) === normalizeGenre(requestedGenre)
              )
            : mockVideos;
      json(response, 200, videos, webOrigin);
      return;
    }

    const videoAnalyticsMatch = url.pathname.match(
      /^\/v1\/videos\/([^/]+)\/analytics$/
    );
    if (videoAnalyticsMatch) {
      const premium =
        session === "complete" ||
        session === "participant" ||
        session === "nonparticipant" ||
        session === "admin";
      json(
        response,
        200,
        {
          geography: {
            hasEnoughData: true,
            level: premium ? "region" : "country",
            locations: [
              {
                countryCode: "US",
                label: premium ? "Arkansas, USA" : "USA",
                percentage: 100,
                regionCode: premium ? "AR" : null,
                regionName: premium ? "Arkansas" : null,
                viewers: 42,
              },
            ],
            totalViewers: 42,
          },
          range: url.searchParams.get("range") ?? "28d",
          summary: {
            averageWatchPercent: 68,
            completionRate: 54,
            totalWatchedSeconds: 5400,
            uniqueViewers: 42,
            views: 56,
          },
          timeseries: [
            {
              date: "2026-06-01",
              label: "Jun 1",
              uniqueViewers: 42,
              views: 56,
              watchedSeconds: 5400,
            },
          ],
        },
        webOrigin
      );
      return;
    }

    const videoCommentsMatch = url.pathname.match(
      /^\/v1\/videos\/([^/]+)\/comments$/
    );
    if (videoCommentsMatch) {
      json(
        response,
        200,
        [
          {
            authorAvatarUrl: "/soundkit-default-avatar.svg",
            authorName: "MusicFan99",
            body: "Incredible production quality!",
            createdAt: "2026-05-26T12:00:00.000Z",
            id: "comment-1",
          },
        ],
        webOrigin
      );
      return;
    }

    const videoDetailMatch = url.pathname.match(/^\/v1\/videos\/([^/]+)$/);
    if (videoDetailMatch) {
      const video = mockVideos.find((v) => v.id === videoDetailMatch[1]) ?? {
        ...mockVideos[0],
        id: videoDetailMatch[1],
      };
      json(response, 200, video, webOrigin);
      return;
    }

    if (
      url.pathname === "/v1/battles/kits" ||
      url.pathname === "/v1/battles/kits/"
    ) {
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

      const mockBattleKits = getMockBattleKits(request);
      if (request.method === "GET") {
        const requestedFormat = url.searchParams.get("format");
        if (requestedFormat) {
          const requiredMainTracks = Number(requestedFormat.slice(-1)),
            tracks = mockTracks
              .slice(0, requiredMainTracks + 1)
              .map((track, index) => ({
                coverArtUrl: track.coverArtUrl,
                id: `mock-waiting-kit-track-${index}`,
                mainSlot: index < requiredMainTracks ? index + 1 : null,
                role: index < requiredMainTracks ? "main" : "tiebreaker",
                title: track.title,
                trackId: track.id,
              }));
          json(
            response,
            200,
            [
              {
                createdAt: "2026-08-01T12:00:00.000Z",
                format: requestedFormat,
                id: "mock-waiting-kit",
                isBattleReady: true,
                mainTrackCount: requiredMainTracks,
                name: `${requestedFormat.replaceAll("_", " ").toUpperCase()} Warmup Kit`,
                reason: null,
                requiredMainTracks,
                tiebreakerCount: 1,
                totalRequiredTracks: requiredMainTracks + 1,
                totalUniqueTracks: tracks.length,
                tracks,
                updatedAt: "2026-08-01T12:00:00.000Z",
              },
            ],
            webOrigin
          );
          return;
        }
        json(response, 200, mockBattleKits, webOrigin);
        return;
      }

      if (request.method === "POST") {
        let bodyText = "";
        request.on("data", (chunk) => {
          bodyText += chunk;
        });
        request.on("end", () => {
          const body = JSON.parse(bodyText || "{}"),
            inputTracks = Array.isArray(body.tracks) ? body.tracks : [],
            tracks = inputTracks.map((track, index) => {
              const source = mockTracks.find(
                (candidate) => candidate.id === track.trackId
              );
              return {
                coverArtUrl: source?.coverArtUrl ?? null,
                id: `mock-kit-track-${Date.now()}-${index}`,
                mainSlot: track.mainSlot ?? null,
                role: track.role,
                title: source?.title ?? `Track ${index + 1}`,
                trackId: track.trackId,
              };
            }),
            mainTrackCount = tracks.filter(
              (track) => track.role === "main"
            ).length,
            tiebreakerCount = tracks.filter(
              (track) => track.role === "tiebreaker"
            ).length,
            kit = {
              createdAt: new Date().toISOString(),
              format: body.format,
              id: `mock-kit-${Date.now()}`,
              isBattleReady: mainTrackCount >= 3 && tiebreakerCount === 1,
              mainTrackCount,
              name: body.name,
              reason: null,
              requiredMainTracks: Number(String(body.format).slice(-1)),
              tiebreakerCount,
              totalRequiredTracks: Number(String(body.format).slice(-1)) + 1,
              totalUniqueTracks: new Set(
                tracks.map((track) => track.trackId)
              ).size,
              tracks,
              updatedAt: new Date().toISOString(),
            };
          mockBattleKits.push(kit);
          json(response, 201, kit, webOrigin);
        });
        return;
      }
    }

    const battleChallengeMatch = url.pathname.match(
      /^\/v1\/battles\/challenges\/([^/]+)$/
    );
    if (battleChallengeMatch) {
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

      const mockBattleChallenges = getMockBattleChallenges(request),
        challengeId = battleChallengeMatch[1],
        challengeIndex = mockBattleChallenges.findIndex(
          (challenge) => challenge.id === challengeId
        );
      if (challengeIndex < 0) {
        json(
          response,
          404,
          { message: "Battle challenge not found." },
          webOrigin
        );
        return;
      }

      if (request.method === "DELETE") {
        mockBattleChallenges.splice(challengeIndex, 1);
        json(
          response,
          200,
          { message: "Battle challenge dismissed." },
          webOrigin
        );
        return;
      }

      if (request.method === "PATCH") {
        let bodyText = "";
        request.on("data", (chunk) => {
          bodyText += chunk;
        });
        request.on("end", () => {
          const body = JSON.parse(bodyText || "{}"),
            status = body.status === "accepted" ? "accepted" : body.status;
          mockBattleChallenges[challengeIndex].status = status;
          if (status === "accepted") {
            const challenge = mockBattleChallenges[challengeIndex],
              battleId = `mock-battle-${challenge.id}`;
            if (!mockBattles.some((battle) => battle.id === battleId)) {
              mockBattles.push({
                format: challenge.format,
                genre: challenge.genre,
                id: battleId,
                isFeatured: false,
                joinMode: "watch_now",
                participants: [
                  {
                    avatarUrl: "/soundkit-default-avatar.svg",
                    id: "mock-artist-mattalvis",
                    name: "Matt Alvis",
                    username: challenge.challengerUsername,
                  },
                  {
                    avatarUrl: "/soundkit-default-avatar.svg",
                    id: "user_complete",
                    name: "Complete Artist",
                    username: "complete_artist",
                  },
                ],
                startsAt: challenge.proposedDate,
                status: "scheduled",
                title: "Artist Battle - Hip-Hop",
                tracks: [],
                viewerCount: 0,
                visibility: "public",
              });
            }
          }
          json(
            response,
            200,
            { message: `Battle challenge ${status}.` },
            webOrigin
          );
        });
        return;
      }
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/battles/challenges"
    ) {
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

      const mockBattleChallenges = getMockBattleChallenges(request);
      json(
        response,
        200,
        {
          incoming: mockBattleChallenges.filter(
            (challenge) => challenge.direction === "incoming"
          ),
          outgoing: mockBattleChallenges.filter(
            (challenge) => challenge.direction === "outgoing"
          ),
        },
        webOrigin
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/me/notification-settings"
    ) {
      json(response, 200, mockNotificationSettings, webOrigin);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname === "/v1/me/notification-settings"
    ) {
      let bodyText = "";
      request.on("data", (chunk) => {
        bodyText += chunk;
      });
      request.on("end", () => {
        Object.assign(mockNotificationSettings, JSON.parse(bodyText || "{}"));
        json(response, 200, mockNotificationSettings, webOrigin);
      });
      return;
    }

    if (
      url.pathname === "/v1/communities" ||
      url.pathname === "/v1/communities/"
    ) {
      json(response, 200, mockCommunities, webOrigin);
      return;
    }

    const communityDetailMatch = url.pathname.match(
      /^\/v1\/communities\/([^/]+)$/
    );
    if (communityDetailMatch && request.method === "GET") {
      const community = mockCommunities.find(
        (entry) => entry.id === communityDetailMatch[1]
      );
      json(
        response,
        community ? 200 : 404,
        community ?? { message: "Community not found." },
        webOrigin
      );
      return;
    }

    const communityJoinMatch = url.pathname.match(
      /^\/v1\/communities\/([^/]+)\/join$/
    );
    if (communityJoinMatch && request.method === "POST") {
      const community = mockCommunities.find(
        (entry) => entry.id === communityJoinMatch[1]
      );
      if (community && !community.isMember) {
        community.isMember = true;
        community.memberCount += 1;
        mockCommunityMembers.push({
          avatarUrl: "/summer-music-album-cover.webp",
          joinedAt: new Date().toISOString(),
          name: "Complete Artist",
          role: "member",
          userId: "user_complete",
          username: "complete_artist",
        });
      }
      json(
        response,
        community ? 201 : 404,
        community
          ? { message: "Community joined." }
          : { message: "Community not found." },
        webOrigin
      );
      return;
    }

    const communityMessagesMatch = url.pathname.match(
      /^\/v1\/communities\/([^/]+)\/messages$/
    );
    if (communityMessagesMatch) {
      if (request.method === "GET") {
        json(response, 200, mockCommunityMessages, webOrigin);
        return;
      }
      if (request.method === "POST") {
        let bodyText = "";
        request.on("data", (chunk) => {
          bodyText += chunk;
        });
        request.on("end", () => {
          const body = JSON.parse(bodyText || "{}"),
            message = {
              author: {
                avatarUrl: "/summer-music-album-cover.webp",
                name: "Complete Artist",
                username: "complete_artist",
              },
              body: body.body,
              createdAt: new Date().toISOString(),
              id: body.clientMessageId ?? `mock-message-${Date.now()}`,
              userId: "user_complete",
            };
          mockCommunityMessages.push(message);
          json(response, 201, message, webOrigin);
        });
        return;
      }
    }

    const communityPostsMatch = url.pathname.match(
      /^\/v1\/communities\/([^/]+)\/posts$/
    );
    if (communityPostsMatch) {
      if (request.method === "GET") {
        json(response, 200, mockCommunityPosts, webOrigin);
        return;
      }
      if (request.method === "POST") {
        let bodyText = "";
        request.on("data", (chunk) => {
          bodyText += chunk;
        });
        request.on("end", () => {
          const body = JSON.parse(bodyText || "{}"),
            post = {
              author: {
                avatarUrl: "/summer-music-album-cover.webp",
                name: "Complete Artist",
                username: "complete_artist",
              },
              body: body.body ?? null,
              createdAt: new Date().toISOString(),
              id: `mock-post-${Date.now()}`,
              isPinned: false,
              mediaUrl: null,
              metadata: null,
              postType: body.postType ?? "text",
              userId: "user_complete",
            };
          mockCommunityPosts.push(post);
          json(response, 201, post, webOrigin);
        });
        return;
      }
    }

    const communityMembersMatch = url.pathname.match(
      /^\/v1\/communities\/([^/]+)\/members$/
    );
    if (communityMembersMatch && request.method === "GET") {
      json(response, 200, mockCommunityMembers, webOrigin);
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/battles/opponents"
    ) {
      const normalizedQuery = (url.searchParams.get("q") ?? "")
        .replace(/^@+/u, "")
        .toLowerCase();
      json(
        response,
        200,
        normalizedQuery && "new-opponent".includes(normalizedQuery)
          ? [
              {
                genre: "Hip-Hop",
                name: "New Opponent",
                username: "new-opponent",
              },
            ]
          : [],
        webOrigin
      );
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/v1/battles/challenge"
    ) {
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

      const mockBattleChallenges = getMockBattleChallenges(request),
        createdAt = new Date().toISOString();
      mockBattleChallenges.push({
        challengerUsername: user.username,
        createdAt,
        direction: "outgoing",
        expiresAt: new Date(
          Date.parse(createdAt) + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        format: "best_of_5",
        genre: "Hip-Hop",
        id: `mock-challenge-${Date.now()}`,
        message: null,
        opponentUsername: "new-opponent",
        proposedDate: null,
        proposedTimeLabel: null,
        status: "pending",
      });
      json(response, 201, { message: "Challenge created." }, webOrigin);
      return;
    }

    const battleDeleteMatch = url.pathname.match(/^\/v1\/battles\/([^/]+)$/);
    if (request.method === "DELETE" && battleDeleteMatch) {
      const battleIndex = mockBattles.findIndex(
        (battle) => battle.id === battleDeleteMatch[1]
      );
      if (battleIndex >= 0) {
        mockBattles.splice(battleIndex, 1);
      }
      json(
        response,
        200,
        { message: "Scheduled battle deleted." },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/battles/record") {
      json(
        response,
        200,
        {
          history: [],
          participation: {
            battles: 0,
            canceled: 0,
            ducks: 0,
            forfeits: 0,
            losses: 0,
            quits: 0,
            roundsPlayed: 0,
            ties: 0,
            wins: 0,
          },
          ranked: {
            battles: 0,
            canceled: 0,
            ducks: 0,
            forfeits: 0,
            losses: 0,
            quits: 0,
            ties: 0,
            wins: 0,
          },
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/battles/stats") {
      json(response, 200, [], webOrigin);
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

    if (
      url.pathname === "/v1/artist-setup-guide" ||
      url.pathname === "/v1/artist-setup-guide/"
    ) {
      const complete =
        session === "complete" ||
        session === "participant" ||
        session === "nonparticipant" ||
        session === "admin";
      json(
        response,
        200,
        {
          battleKits: {
            canStart: complete,
            count: complete ? 1 : 0,
            minimumReleasedTracks: 4,
          },
          capabilities: {
            canCreateLiveBattles: complete,
            canHostLiveStreams: complete,
            canOperatePaidCommunity: complete,
            canReceivePayouts: complete,
            canSellProducts: complete,
            isPremium: complete,
          },
          catalog: {
            hasPlayablePublicRelease: complete,
            hasProject: complete,
            hasSellableItem: complete,
            hasTrack: complete,
            releasedPlayableTrackCount: complete ? 4 : 0,
            trackCount: complete ? 4 : 0,
          },
          community: { hasOwnedCommunity: complete },
          creatorTools: {
            hasLiveExperience: complete,
            hasOpenVerse: complete,
            hasVideo: complete,
          },
          monetization: {
            chargesEnabled: complete,
            detailsSubmitted: complete,
            onboardingStatus: complete ? "enabled" : "not_started",
            payoutsEnabled: complete,
          },
          profile: { isPublicReady: true },
          referrals: { inviteSent: complete },
        },
        webOrigin
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/referrals/invite") {
      json(
        response,
        200,
        {
          alreadyInvited: false,
          message: "Invitation sent.",
          sent: true,
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/me/entitlements") {
      const complete =
        session === "complete" ||
        session === "participant" ||
        session === "nonparticipant" ||
        session === "admin";
      json(
        response,
        200,
        {
          activePlanCode: complete ? "soundkit_premium_artist" : null,
          canCreateLiveBattles: complete,
          canHostLiveStreams: complete,
          canOperatePaidCommunity: complete,
          canReceivePayouts: complete,
          canSellProducts: complete,
          canViewLiveBattles: complete,
          canVoteLiveBattles: complete,
          canWatchCreatorStreams: complete,
          canWatchVod: complete,
          isPremium: complete,
          referenceId: complete ? "workspace_complete" : null,
          status: complete ? "active" : null,
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
          .toLowerCase(),
        reserved = username === "soundkit";

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

    if (url.pathname === "/v1/live/experiences/me") {
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

      json(response, 200, [], webOrigin);
      return;
    }

    if (url.pathname === "/v1/live/rooms/queue") {
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
          battles: [],
          participatingBattles:
            session === "participant"
              ? [
                  {
                    battleId: "battle-west-coast-showdown",
                    role: "artist_a",
                    startsAt: null,
                    status: "live",
                    title: "West Coast Showdown",
                  },
                ]
              : [],
        },
        webOrigin
      );
      return;
    }

    const liveRoomMatch = url.pathname.match(/^\/v1\/live\/rooms\/([^/]+)$/);

    if (liveRoomMatch) {
      json(response, 200, liveRoom(liveRoomMatch[1], session), webOrigin);
      return;
    }

    const liveExperienceMatch = url.pathname.match(
      /^\/v1\/live\/experiences\/([^/]+)$/
    );

    if (liveExperienceMatch) {
      json(
        response,
        200,
        liveRoom(liveExperienceMatch[1], session),
        webOrigin
      );
      return;
    }

    const liveExperienceJoinMatch = url.pathname.match(
      /^\/v1\/live\/experiences\/([^/]+)\/join$/
    );

    if (liveExperienceJoinMatch && request.method === "POST") {
      json(
        response,
        201,
        {
          participant: {
            authToken: "mock-party-token",
            meetingId: `meeting-${liveExperienceJoinMatch[1]}`,
            participantId: `participant-${session ?? "anonymous"}`,
            presetName:
              session === "complete"
                ? "soundkit-party-host"
                : "soundkit-party-listener",
          },
          setupScreen: true,
        },
        webOrigin
      );
      return;
    }

    const listeningPartyDetailMatch = url.pathname.match(
      /^\/v1\/listening-parties\/([^/]+)$/
    );

    if (listeningPartyDetailMatch) {
      json(
        response,
        200,
        liveRoom(listeningPartyDetailMatch[1], session),
        webOrigin
      );
      return;
    }

    const liveRoomBattleKitMatch = url.pathname.match(
      /^\/v1\/live\/rooms\/([^/]+)\/battle\/kit$/
    );

    if (liveRoomBattleKitMatch) {
      json(
        response,
        200,
        {
          battleId: liveRoomBattleKitMatch[1],
          kitId: "mock-waiting-kit",
          role: "artist_a",
        },
        webOrigin
      );
      return;
    }

    const liveRoomBattleActionMatch = url.pathname.match(
      /^\/v1\/live\/rooms\/([^/]+)\/battle\/(ready|disposition)$/
    );

    if (liveRoomBattleActionMatch && request.method === "POST") {
      let bodyText = "";
      request.on("data", (chunk) => {
        bodyText += chunk;
      });
      request.on("end", () => {
        const body = JSON.parse(bodyText || "{}"),
          room = liveRoom(liveRoomBattleActionMatch[1], session);
        if (liveRoomBattleActionMatch[2] === "ready" && room.battle) {
          room.battle.coordination.artistReadyUserIds = body.ready
            ? [room.battle.artists[0].id]
            : [];
        }
        json(response, 200, room, webOrigin);
      });
      return;
    }

    const liveRoomQueueMutationMatch = url.pathname.match(
      /^\/v1\/live\/rooms\/([^/]+)\/(queue|leave)$/
    );

    if (liveRoomQueueMutationMatch && request.method === "POST") {
      const room = liveRoom(liveRoomQueueMutationMatch[1], session);
      if (room.battle) {
        room.battle.viewerQueueStatus =
          liveRoomQueueMutationMatch[2] === "queue" ? "queued" : null;
        room.battle.queueSize =
          liveRoomQueueMutationMatch[2] === "queue" ? 1 : 0;
      }
      json(response, 200, room, webOrigin);
      return;
    }

    const liveRoomPartyPlaybackMatch = url.pathname.match(
      /^\/v1\/live\/rooms\/([^/]+)\/party\/playback$/
    );

    if (liveRoomPartyPlaybackMatch && request.method === "POST") {
      let bodyText = "";
      request.on("data", (chunk) => {
        bodyText += chunk;
      });
      request.on("end", () => {
        const body = JSON.parse(bodyText || "{}"),
          room = liveRoom(liveRoomPartyPlaybackMatch[1], session),
          playback = room.party?.playback;
        if (playback) {
          playback.playbackState =
            body.type === "pause"
              ? "paused"
              : body.type === "resume"
                ? "playing"
                : playback.playbackState;
          if (body.trackId) {
            playback.trackId = body.trackId;
            playback.positionMs = 0;
          }
        }
        json(response, 200, room, webOrigin);
      });
      return;
    }

    const liveRoomMutationMatch = url.pathname.match(
      /^\/v1\/live\/rooms\/([^/]+)\/(chat|vote)$/
    );

    if (liveRoomMutationMatch) {
      json(
        response,
        200,
        liveRoom(liveRoomMutationMatch[1], session),
        webOrigin
      );
      return;
    }

    json(response, 404, { message: `Not Found - ${url.pathname}` }, webOrigin);
  });

  server.listen(port, host);
  await once(server, "listening");
  return server;
};
