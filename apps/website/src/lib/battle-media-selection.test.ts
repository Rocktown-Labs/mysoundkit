import { describe, expect, it } from "vitest";

import { resolveBattleMediaDeviceSelection } from "./battle-media-selection";

const devices = [
  { deviceId: "camera-1", kind: "videoinput" },
  { deviceId: "microphone-1", kind: "audioinput" },
];

describe("battle media device selection", () => {
  it("falls back to available devices when saved IDs are stale", () => {
    expect(
      resolveBattleMediaDeviceSelection(devices, {
        audioDeviceId: "missing-microphone",
        videoDeviceId: "missing-camera",
      })
    ).toEqual({
      audioDeviceId: "microphone-1",
      videoDeviceId: "camera-1",
    });
  });

  it("preserves saved IDs when both devices are still available", () => {
    expect(
      resolveBattleMediaDeviceSelection(devices, {
        audioDeviceId: "microphone-1",
        videoDeviceId: "camera-1",
      })
    ).toEqual({
      audioDeviceId: "microphone-1",
      videoDeviceId: "camera-1",
    });
  });
});
