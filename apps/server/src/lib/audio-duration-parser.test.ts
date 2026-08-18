/* eslint-disable no-inline-comments, one-var, unicorn/number-literal-case, unicorn/numeric-separators-style */
import { describe, expect, it } from "vitest";

import {
  parseAudioHeaderDurationMs,
  parseFlacDurationMs,
  parseMp3DurationMs,
  parseWavDurationMs,
} from "./audio-duration-parser";

describe("audio duration parser", () => {
  it("parses WAV header duration accurately", () => {
    // 44.1kHz, 16-bit stereo = 176,400 bytes/sec. 1,764,000 data bytes = 10,000 ms.
    const header = new Uint8Array(44);
    // "RIFF"
    header.set([0x52, 0x49, 0x46, 0x46], 0);
    // Size (36 + dataSize)
    header.set([0x4c, 0xeb, 0x1a, 0x00], 4);
    // "WAVE"
    header.set([0x57, 0x41, 0x56, 0x45], 8);
    // "fmt "
    header.set([0x66, 0x6d, 0x74, 0x20], 12);
    // fmt chunk size (16)
    header.set([16, 0, 0, 0], 16);
    // PCM (1), 2 channels
    header.set([1, 0, 2, 0], 20);
    // Sample rate: 44100 (0xAC44)
    header.set([0x44, 0xac, 0x00, 0x00], 24);
    // Byte rate: 176400 (0x02B110)
    header.set([0x10, 0xb1, 0x02, 0x00], 28);
    // Block align (4), bits per sample (16)
    header.set([4, 0, 16, 0], 32);
    // "data"
    header.set([0x64, 0x61, 0x74, 0x61], 36);
    // Data size: 1,764,000 (0x1AEAA0)
    header.set([0xa0, 0xea, 0x1a, 0x00], 40);

    const duration = parseWavDurationMs(header);
    expect(duration).toBe(10000);
    expect(parseAudioHeaderDurationMs(header)).toBe(10000);
  });

  it("parses FLAC STREAMINFO header duration accurately", () => {
    // 44.1kHz, 441,000 total samples = 10,000 ms.
    const header = new Uint8Array(42);
    // "fLaC"
    header.set([0x66, 0x4c, 0x61, 0x43], 0);
    // Block type 0 (STREAMINFO), length 34
    header.set([0x00, 0x00, 0x00, 0x22], 4);
    // min/max block size (16-32), min/max frame size (0-0)
    header.set([0x10, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 8);
    // sample rate 44100 (0x0AC44), 2 channels, 16 bps, total samples 441000 (0x06BA68)
    // byte 18: (44100 >> 12) = 0x0A
    // byte 19: (44100 >> 4) & 0xFF = 0xC4
    // byte 20: ((44100 & 0x0F) << 4) | (1 << 1) | (15 >> 4) = 0x42
    // byte 21: (15 << 4) | (0x06BA68 >> 32) = 0xF0
    // byte 22: (441000 >> 24) = 0x00
    // byte 23: (441000 >> 16) & 0xFF = 0x06
    // byte 24: (441000 >> 8) & 0xFF = 0xBA
    // byte 25: 441000 & 0xFF = 0xA8
    header.set([0x0a, 0xc4, 0x42, 0xf0, 0x00, 0x06, 0xba, 0xa8], 18);

    const duration = parseFlacDurationMs(header);
    expect(duration).toBe(10000);
    expect(parseAudioHeaderDurationMs(header)).toBe(10000);
  });

  it("parses MP3 CBR header duration accurately", () => {
    // MPEG-1 Layer 3, 128 kbps (16000 B/s), 44.1 kHz, stereo
    const header = new Uint8Array(128);
    // Frame header: 0xFF 0xFB 0x90 0x64 (Sync, MPEG-1 Layer 3, 128kbps, 44.1kHz, Stereo)
    header.set([0xff, 0xfb, 0x90, 0x64], 0);

    const totalFileSize = 160000; // 10 seconds of 128kbps
    const duration = parseMp3DurationMs(header, totalFileSize);
    expect(duration).toBe(10000);
    expect(parseAudioHeaderDurationMs(header, totalFileSize)).toBe(10000);
  });
});
