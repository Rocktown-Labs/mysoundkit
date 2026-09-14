import { describe, expect, it } from "vitest";

import { isMockRealtimeKitToken } from "./realtimekit-token";

describe("isMockRealtimeKitToken", () => {
  it("recognizes local fallback participant tokens", () => {
    expect(
      isMockRealtimeKitToken(
        "mock_rtk_rtk_party_123_participant_user_artist_soundkit-party-host"
      )
    ).toBe(true);
  });

  it("does not treat vendor participant tokens as local fallbacks", () => {
    expect(
      isMockRealtimeKitToken("eyJhbGciOiJIUzI1NiJ9.payload.signature")
    ).toBe(false);
  });
});
