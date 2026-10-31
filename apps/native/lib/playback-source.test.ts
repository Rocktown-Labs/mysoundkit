/* eslint-disable one-var, sort-vars */
import { describe, expect, it, vi } from "vitest";

import {
  isCredentialedPlaybackUrl,
  resolvePlaybackSource,
} from "./playback-source";

const apiBaseUrl = "https://api.soundkit.test";
const guarded = `${apiBaseUrl}/v1/tracks/track/playback?context=ordinary`;

describe("native playback credential destinations", () => {
  it("adds a dummy cookie only to the configured guarded playback route", async () => {
    const getCookie = vi.fn(() => Promise.resolve("dummy-session"));
    expect(
      await resolvePlaybackSource({ apiBaseUrl, getCookie, uri: guarded })
    ).toEqual({ headers: { cookie: "dummy-session" }, uri: guarded });
    expect(getCookie).toHaveBeenCalledOnce();
  });
  it.each([
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://api.soundkit.test.attacker.test/v1/tracks/track/playback",
    "http://api.soundkit.test/v1/tracks/track/playback",
    "https://api.soundkit.test:8443/v1/tracks/track/playback",
    "https://api.soundkit.test/v1/tracks/track/playback/extra",
    "https://api.soundkit.test/v1/tracks/track/assets/private/download",
    "https://api.soundkit.test/v1/tracks/track/redirect?url=https://outside.test",
    "https://user:password@api.soundkit.test/v1/tracks/track/playback",
    "/v1/tracks/track/playback",
    "file:///tmp/preview.wav",
    "blob:preview",
    "not-a-url",
  ])("does not read or attach credentials for %s", async (uri) => {
    const getCookie = vi.fn(() => Promise.resolve("dummy-session"));
    expect(await resolvePlaybackSource({ apiBaseUrl, getCookie, uri })).toEqual(
      { uri }
    );
    expect(getCookie).not.toHaveBeenCalled();
  });
  it.each([null, undefined, ""])(
    "supports anonymous playback when cookie is %s",
    async (cookie) => {
      expect(
        await resolvePlaybackSource({
          apiBaseUrl,
          getCookie: () => Promise.resolve(cookie),
          uri: guarded,
        })
      ).toEqual({ uri: guarded });
    }
  );
  it("keeps credential storage failures from stopping public playback", async () => {
    expect(
      await resolvePlaybackSource({
        apiBaseUrl,
        getCookie: () => Promise.reject(new Error("Dummy storage failure")),
        uri: guarded,
      })
    ).toEqual({ uri: guarded });
  });
  it("matches a configured loopback development origin without trusting another port", () => {
    expect(
      isCredentialedPlaybackUrl(
        "http://127.0.0.1:3000/v1/tracks/t/playback",
        "http://127.0.0.1:3000"
      )
    ).toBe(true);
    expect(
      isCredentialedPlaybackUrl(
        "http://127.0.0.1:3001/v1/tracks/t/playback",
        "http://127.0.0.1:3000"
      )
    ).toBe(false);
  });
});
