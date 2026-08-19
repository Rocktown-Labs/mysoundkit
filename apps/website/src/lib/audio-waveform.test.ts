import { describe, expect, it } from "vitest";

import { extractAmplitudeBuckets } from "./audio-waveform";

describe("audio waveform extraction", () => {
  it("uses the uploaded audio samples instead of generated bars", () => {
    const samples = new Float32Array([0, 0.25, -0.5, 1, 0.1, -0.8, 0, 0.4]),
     result = extractAmplitudeBuckets(
      {
        duration: 2,
        getChannelData: () => samples,
        length: samples.length,
        numberOfChannels: 1,
      },
      4
    );

    expect(result.durationSeconds).toBe(2);
    expect(result.amplitudes[0]).toBeCloseTo(0.25);
    expect(result.amplitudes[1]).toBeCloseTo(1);
    expect(result.amplitudes[2]).toBeCloseTo(0.8);
    expect(result.amplitudes[3]).toBeCloseTo(0.4);
  });
});
