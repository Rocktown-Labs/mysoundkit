import { describe, expect, it } from "vitest";

import {
  classifyAudioDevice,
  formatPlaybackTime,
  getRepeatTooltipLabel,
} from "./player-device";

describe("Player Device & UI Helpers", () => {
  describe("classifyAudioDevice", () => {
    it("identifies Bluetooth devices", () => {
      expect(classifyAudioDevice("AirPods Pro Bluetooth")).toBe("bluetooth");
      expect(classifyAudioDevice("Sony WH-1000XM4 (BT Audio)")).toBe(
        "bluetooth"
      );
      expect(classifyAudioDevice("Wireless Speaker")).toBe("bluetooth");
    });

    it("identifies wired and wireless headphones", () => {
      expect(classifyAudioDevice("USB Headphone Output")).toBe("headphones");
      expect(classifyAudioDevice("Gaming Headset")).toBe("headphones");
      expect(classifyAudioDevice("In-Ear Earphones")).toBe("headphones");
    });

    it("identifies built-in computer outputs", () => {
      expect(classifyAudioDevice("MacBook Pro Speakers (Built-in)")).toBe(
        "computer"
      );
      expect(classifyAudioDevice("Internal Laptop Audio")).toBe("computer");
      expect(classifyAudioDevice("This Computer")).toBe("computer");
    });

    it("identifies external speakers as default fallback", () => {
      expect(classifyAudioDevice("External Studio Monitors")).toBe("speaker");
      expect(classifyAudioDevice("Line Out (Realtek Audio)")).toBe("speaker");
    });
  });

  describe("getRepeatTooltipLabel", () => {
    it("returns correct user-facing labels for repeat states", () => {
      expect(getRepeatTooltipLabel("off")).toBe("Repeat: Off");
      expect(getRepeatTooltipLabel("all")).toBe("Repeat: All");
      expect(getRepeatTooltipLabel("one")).toBe("Repeat: One");
    });
  });

  describe("formatPlaybackTime", () => {
    it("formats seconds into mm:ss string", () => {
      expect(formatPlaybackTime(0)).toBe("0:00");
      expect(formatPlaybackTime(45)).toBe("0:45");
      expect(formatPlaybackTime(65)).toBe("1:05");
      expect(formatPlaybackTime(185)).toBe("3:05");
      expect(formatPlaybackTime(-1)).toBe("0:00");
      expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
    });
  });
});
