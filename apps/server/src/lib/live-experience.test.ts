import { describe, expect, it } from "vitest";

import {
  buildNotificationFanout,
  buildRealtimeKitMeetingUrl,
  buildRealtimeKitParticipantUrl,
  createMockParticipantToken,
  createRoundVoterSnapshot,
  findLiveSessionConflict,
  hasRealtimeKitConfig,
  resolveRealtimePreset,
} from "./live-experience";

const artistUser = {
  email: "artist@soundkit.test",
  id: "user_artist",
  name: "SoundKit Artist",
  role: "artist",
};

describe("live experience orchestration", () => {
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
        kind: "battle",
        phase: "voting",
        role: "artist",
      })
    ).toBe("soundkit-battle-artist-muted");
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
