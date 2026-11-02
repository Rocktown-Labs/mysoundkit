import { describe, expect, it } from "vitest";

import { canCompleteBioTip, isBioAuthHandoffMessage } from "./auth-handoff";

const origin = "https://mysoundkit.com",
  popup = {} as Window,
  valid = {
    data: { token: "test-session", type: "soundkit-auth-handoff" },
    origin,
    source: popup,
  };

describe("Bio session handoff boundary", () => {
  it("accepts a token only from the opened SoundKit popup", () => {
    expect(isBioAuthHandoffMessage(valid, origin, popup)).toBe(true);
  });

  it.each([
    { ...valid, origin: "https://mysoundkit.com.attacker.test" },
    { ...valid, source: {} as Window },
    { ...valid, source: null },
    { ...valid, data: null },
    { ...valid, data: { token: "test", type: "other" } },
    { ...valid, data: { token: "", type: "soundkit-auth-handoff" } },
    { ...valid, data: { token: 123, type: "soundkit-auth-handoff" } },
  ])("rejects untrusted or malformed messages %#", (event) => {
    expect(isBioAuthHandoffMessage(event, origin, popup)).toBe(false);
  });

  it("rejects unsolicited messages before a popup is opened", () => {
    expect(
      isBioAuthHandoffMessage({ ...valid, source: null }, origin, null)
    ).toBe(false);
  });
});

describe("Bio pending tip destination", () => {
  const requested = {
    artistId: "artist-one",
    canReceiveTips: true,
    username: "one",
  };
  it("allows the initiating artist after verified sign-in", () => {
    expect(
      canCompleteBioTip(requested, { ...requested, username: "ONE" })
    ).toBe(true);
  });
  it.each([
    null,
    { ...requested, artistId: "artist-two", username: "two" },
    { ...requested, username: "two" },
    { ...requested, canReceiveTips: false },
  ])(
    "does not redirect a pending tip after navigation or eligibility changes %#",
    (current) => {
      expect(canCompleteBioTip(requested, current)).toBe(false);
    }
  );
  it("requires an initiating target", () => {
    expect(canCompleteBioTip(null, requested)).toBe(false);
  });
});
