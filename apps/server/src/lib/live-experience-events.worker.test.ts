import { describe, expect, it } from "vitest";

import {
  applyBattleBotAction,
  BATTLE_RECORD_THRESHOLD_VIEWERS,
  processRealtimeKitWebhookEnvelope,
  REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL,
  roundVoteWinner,
  updateArtistRecordsForBattle,
  verifyRealtimeKitSignature,
} from "./live-experience-events";

const battleId = "battle_123";

describe("live experience webhook orchestration", () => {
  it("exports a threshold of ten peak concurrent viewers for battle records", () => {
    expect(BATTLE_RECORD_THRESHOLD_VIEWERS).toBe(10);
  });

  it("uses the public RealtimeKit webhook key well-known URL", () => {
    expect(REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL).toBe(
      "https://api.realtime.cloudflare.com/.well-known/webhooks.json"
    );
  });

  it("ignores event types the product does not subscribe to", async () => {
    const outcome = await processRealtimeKitWebhookEnvelope({
      event: "meeting.summary",
      meeting: { id: "meeting_123" },
    });

    expect(outcome).toBe("ignored");
  });
});

describe("RealtimeKit webhook signature verification", () => {
  it("rejects a signature without a matching public key", async () => {
    const generated = (await crypto.subtle.generateKey(
        {
          hash: "SHA-256",
          modulusLength: 2048,
          name: "RSASSA-PKCS1-v1_5",
          publicExponent: new Uint8Array([1, 0, 1]),
        },
        true,
        ["sign", "verify"]
      )) as CryptoKeyPair,
      exported = await crypto.subtle.exportKey("spki", generated.publicKey),
      publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(
        new Uint8Array(exported as ArrayBuffer)
      ).toString("base64")}\n-----END PUBLIC KEY-----`,
      body = new TextEncoder().encode('{"event":"meeting.started"}');

    await expect(
      verifyRealtimeKitSignature({
        body,
        publicKeyPem,
        signature: Buffer.from("wrong-signature-bytes").toString("base64"),
      })
    ).resolves.toBe(false);
  });
});

describe("battle round voting winner resolution", () => {
  const round = {
    trackOneId: "track_a",
    trackOneVotes: 0,
    trackTwoId: "track_b",
    trackTwoVotes: 0,
  };

  it("crowns the higher voted track as the round winner", () => {
    expect(
      roundVoteWinner({ ...round, trackOneVotes: 12, trackTwoVotes: 8 }, false)
    ).toBe("track_a");
    expect(
      roundVoteWinner({ ...round, trackOneVotes: 8, trackTwoVotes: 12 }, false)
    ).toBe("track_b");
  });

  it("leaves a tied non-tiebreaker round without a winner", () => {
    expect(roundVoteWinner(round, false)).toBeNull();
  });

  it("leaves a tied tiebreaker round as a draw", () => {
    expect(roundVoteWinner(round, true)).toBeNull();
  });
});

describe("battle record eligibility", () => {
  it("skips artist record updates when the database is not configured", async () => {
    await expect(
      updateArtistRecordsForBattle({
        battleId: "battle_123",
        peakViewerCount: 500,
      })
    ).resolves.toEqual({ losses: 0, skipped: true, ties: 0, wins: 0 });
  });
});

describe("battle bot state machine fallbacks", () => {
  it("returns a neutral between-rounds fallback without a database", async () => {
    await expect(
      applyBattleBotAction({
        action: "snapshot_voters",
        battleId,
        participants: [{ id: "voter_one", voted: true }],
      })
    ).resolves.toEqual({
      nextPhase: "between_rounds",
      snapshot: { eligible: [], nonVoters: [] },
    });
  });
});
