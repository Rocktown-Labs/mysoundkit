/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */
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
  },
  liveRoom = (roomId) => {
    const isBattle = roomId.includes("battle"),
      isStream = roomId.includes("stream");
    let kind = "party",
      title = "Single Album Spotlight";

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
            artists: [
              {
                avatarUrl: "/soundkit-default-avatar.svg",
                id: "artist-dj-nova",
                isMuted: false,
                name: "DJ Nova",
                roundsWon: 1,
                stagePosition: "left",
                verified: true,
              },
              {
                avatarUrl: "/soundkit-default-avatar.svg",
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
      price: "$2.99",
      priceCents: 299,
      title: "Summer Nights",
    },
  ],
  mockProjects = [
    {
      artistName: "Luna Eclipse",
      artistUsername: "luna-eclipse",
      collaboratorCount: 1,
      coverArtUrl: "/summer-music-album-cover.webp",
      duration: "12:44",
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
      id: "video_midnight_vibes_mv",
      muxPlaybackId: null,
      playbackPolicy: "public",
      sourceProvider: "external",
      status: "ready",
      thumbnailUrl: "/music-video-thumbnail.webp",
      title: "Midnight Vibes",
      verifiedOnPlatform: true,
      videoKind: "music_video",
      viewCount: "42K",
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

    if (url.pathname === "/v1/tracks" || url.pathname === "/v1/tracks/") {
      json(response, 200, mockTracks, webOrigin);
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
      json(response, 200, mockArtists, webOrigin);
      return;
    }

    if (url.pathname === "/v1/videos" || url.pathname === "/v1/videos/") {
      json(response, 200, mockVideos, webOrigin);
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
      const complete = session === "complete" || session === "admin";
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

    const liveRoomMatch = url.pathname.match(/^\/v1\/live\/rooms\/([^/]+)$/);

    if (liveRoomMatch) {
      json(response, 200, liveRoom(liveRoomMatch[1]), webOrigin);
      return;
    }

    const liveExperienceMatch = url.pathname.match(
      /^\/v1\/live\/experiences\/([^/]+)$/
    );

    if (liveExperienceMatch) {
      json(response, 200, liveRoom(liveExperienceMatch[1]), webOrigin);
      return;
    }

    const listeningPartyDetailMatch = url.pathname.match(
      /^\/v1\/listening-parties\/([^/]+)$/
    );

    if (listeningPartyDetailMatch) {
      json(response, 200, liveRoom(listeningPartyDetailMatch[1]), webOrigin);
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
