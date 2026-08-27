import { describe, expect, it } from "vitest";

import {
  battleMediaPhase,
  buildNotificationFanout,
  buildRealtimeKitChatDumpUrl,
  buildRealtimeKitEndMeetingUrl,
  buildRealtimeKitMeetingUrl,
  buildRealtimeKitParticipantUrl,
  buildRealtimeMeetingPayload,
  createMockParticipantToken,
  createRoundVoterSnapshot,
  findLiveSessionConflict,
  hasRealtimeKitConfig,
  resolveBattleArtistRole,
  resolveRealtimePreset,
} from "./live-experience";

const artistUser = {
  email: "artist@soundkit.test",
  id: "user_artist",
  name: "SoundKit Artist",
  role: "artist",
};

describe("live experience orchestration", () => {
  it("resolves artists consistently when entering by a battle room id", () => {
    expect(
      resolveBattleArtistRole({
        challengerArtistUserId: "artist_a",
        opponentArtistUserId: "artist_b",
        userId: "artist_a",
      })
    ).toBe("artist_a");
    expect(
      resolveBattleArtistRole({
        challengerArtistUserId: "artist_a",
        opponentArtistUserId: "artist_b",
        userId: "artist_b",
      })
    ).toBe("artist_b");
    expect(
      resolveBattleArtistRole({
        challengerArtistUserId: "artist_a",
        opponentArtistUserId: "artist_b",
        userId: "listener",
      })
    ).toBeNull();
  });

  it("maps Durable Object battle phases to media phases", () => {
    expect(battleMediaPhase("artist_a_turn")).toBe("round_active");
    expect(battleMediaPhase("tiebreaker_voting")).toBe("voting");
    expect(battleMediaPhase("waiting_room")).toBe("lobby");
    expect(battleMediaPhase("ended")).toBe("completed");
  });

  it("uses text-only battle lobby presets before the next round", () => {
    expect(
      resolveRealtimePreset({
        kind: "battle",
        phase: "lobby",
        role: "viewer",
      })
    ).toBe("soundkit-battle-lobby-text");
  });

  it("switches battling artists between live and muted presets", () => {
    expect(
      resolveRealtimePreset({
        kind: "battle",
        phase: "round_active",
        role: "artist",
      })
    ).toBe("soundkit-battle-artist-live");
    expect(
      resolveRealtimePreset({
        activeArtistUserId: "artist_a",
        kind: "battle",
        phase: "round_active",
        role: "artist",
        userId: "artist_b",
      })
    ).toBe("soundkit-battle-artist-muted");
    expect(
      resolveRealtimePreset({
        activeArtistUserId: "artist_a",
        kind: "battle",
        phase: "round_active",
        role: "artist",
        userId: "artist_a",
      })
    ).toBe("soundkit-battle-artist-live");
    expect(
      resolveRealtimePreset({
        activeArtistUserId: null,
        kind: "battle",
        phase: "round_active",
        role: "artist",
        userId: "artist_a",
      })
    ).toBe("soundkit-battle-artist-muted");
    expect(
      resolveRealtimePreset({
        kind: "battle",
        phase: "voting",
        role: "artist",
      })
    ).toBe("soundkit-battle-artist-muted");
    expect(
      resolveRealtimePreset({
        kind: "battle",
        phase: "round_active",
        role: "host",
      })
    ).toBe("soundkit-battle-artist-live");
  });

  it("keeps next-round lobby users out of mandatory vote snapshots", () => {
    const snapshot = createRoundVoterSnapshot([
      { id: "voter_one", voted: true },
      { id: "voter_two", voted: false },
      { id: "queued_listener", inLobby: true, voted: false },
    ]);

    expect(snapshot.eligibleUserIds).toEqual(["voter_one", "voter_two"]);
    expect(snapshot.missingVoteUserIds).toEqual(["voter_two"]);
    expect(snapshot.bootedUserIds).toEqual(["voter_two"]);
  });

  it("detects overlapping live session locks for an artist", () => {
    const conflict = findLiveSessionConflict({
      candidateStartsAt: "2026-07-22T20:30:00.000Z",
      locks: [
        {
          experienceId: "stream_live",
          kind: "stream",
          startsAt: "2026-07-22T20:00:00.000Z",
          status: "live",
        },
      ],
    });

    expect(conflict).toEqual({
      conflictingExperienceId: "stream_live",
      kind: "stream",
      message:
        "Artists can only host one live battle, party, or stream at a time.",
      startsAt: "2026-07-22T20:00:00.000Z",
    });
  });

  it("does not block a later scheduled session", () => {
    expect(
      findLiveSessionConflict({
        candidateStartsAt: "2026-07-22T22:30:00.000Z",
        locks: [
          {
            endsAt: "2026-07-22T21:00:00.000Z",
            experienceId: "battle_live",
            kind: "battle",
            startsAt: "2026-07-22T20:00:00.000Z",
            status: "live",
          },
        ],
      })
    ).toBeNull();
  });

  it("builds RealtimeKit URLs from Cloudflare account and app config", () => {
    expect(
      buildRealtimeKitMeetingUrl({
        accountId: "account_123",
        appId: "app_456",
      })
    ).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account_123/realtime/kit/app_456/meetings"
    );
    expect(
      buildRealtimeKitParticipantUrl({
        accountId: "account_123",
        appId: "app_456",
        meetingId: "meeting_789",
      })
    ).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account_123/realtime/kit/app_456/meetings/meeting_789/participants"
    );
    expect(
      buildRealtimeKitChatDumpUrl({
        accountId: "account_123",
        appId: "app_456",
        meetingId: "meeting_789",
      })
    ).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account_123/realtime/kit/app_456/meetings/meeting_789/chat-dump"
    );
    expect(
      buildRealtimeKitEndMeetingUrl({
        accountId: "account_123",
        appId: "app_456",
        meetingId: "meeting_789",
      })
    ).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account_123/realtime/kit/app_456/meetings/meeting_789/end"
    );
  });

  it("configures text-only chat and simulcast video payload for RealtimeKit meetings", () => {
    const payload = buildRealtimeMeetingPayload({ title: "Battle Room" });

    expect(payload).toEqual({
      persist_chat: true,
      record_on_start: true,
      recording_config: {
        audio_config: {
          channel: "stereo",
          codec: "MP3",
          export_file: true,
        },
        file_name_prefix: "soundkit-live",
        max_seconds: 14_400,
        realtimekit_bucket_config: {
          enabled: true,
        },
        video_config: {
          codec: "H264",
          export_file: true,
          height: 720,
          watermark: {
            position: "right bottom",
            size: {
              height: 20,
              width: 100,
            },
            url: "https://mysoundkit.com/brand/logo.png",
          },
          width: 1280,
        },
      },
      session_keep_alive_time_in_secs: 300,
      title: "Battle Room",
    });
  });

  it("reports RealtimeKit config only when all required values are present", () => {
    expect(
      hasRealtimeKitConfig({
        accountId: "account_123",
        apiToken: "token",
        appId: "app_456",
      })
    ).toBe(true);
    expect(
      hasRealtimeKitConfig({
        accountId: "account_123",
        apiToken: "token",
      })
    ).toBe(false);
  });

  it("returns mock participant tokens with the selected preset", () => {
    const token = createMockParticipantToken({
      kind: "battle",
      meetingId: "rtk_battle_123",
      phase: "lobby",
      role: "viewer",
      user: artistUser,
    });

    expect(token).toMatchObject({
      authToken:
        "mock_rtk_rtk_battle_123_participant_user_artist_soundkit-battle-lobby-text",
      breakoutRoomId: "rtk_battle_123_lobby",
      meetingId: "rtk_battle_123",
      participantId: "participant_user_artist",
      presetName: "soundkit-battle-lobby-text",
    });
  });

  it("builds notification fanout with the right room CTA", () => {
    expect(
      buildNotificationFanout({
        experienceId: "party_123",
        kind: "party",
        title: "Midnight EP Premiere",
      })
    ).toEqual([
      {
        audience: "artists",
        ctaHref: "/live/parties/party_123",
        message:
          "Midnight EP Premiere is ready. Join the room when it is time to go live.",
        title: "Your listening party is ready",
      },
      {
        audience: "followers",
        ctaHref: "/live/parties/party_123",
        message:
          "Midnight EP Premiere is scheduled. We will bring everyone to the room when it starts.",
        title: "New listening party scheduled",
      },
      {
        audience: "watchers",
        ctaHref: "/live/parties/party_123",
        message:
          "Midnight EP Premiere is live. Tap in to watch, chat, and react.",
        title: "Midnight EP Premiere is live",
      },
    ]);
  });

  it("builds battle challenge notification fanout with room CTA", () => {
    expect(
      buildNotificationFanout({
        experienceId: "battle_456",
        kind: "battle",
        title: "Club Knockout Showdown",
      })
    ).toEqual([
      {
        audience: "artists",
        ctaHref: "/live/battles/battle_456",
        message:
          "Club Knockout Showdown is ready. Join the room when it is time to go live.",
        title: "Your battle is ready",
      },
      {
        audience: "followers",
        ctaHref: "/live/battles/battle_456",
        message:
          "Club Knockout Showdown is scheduled. We will bring everyone to the room when it starts.",
        title: "New battle scheduled",
      },
      {
        audience: "watchers",
        ctaHref: "/live/battles/battle_456",
        message:
          "Club Knockout Showdown is live. Tap in to watch, chat, and react.",
        title: "Club Knockout Showdown is live",
      },
    ]);
  });
});
