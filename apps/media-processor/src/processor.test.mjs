import assert from "node:assert/strict";
import test from "node:test";

import {
  assertVerifiedDerivative,
  buildMetadataArguments,
  isLosslessCodec,
  parseFfprobeOutput,
  parseLoudnormOutput,
} from "./processor.mjs";

test("technical inspection ignores descriptive tags", () => {
  const result = parseFfprobeOutput(
    JSON.stringify({
      format: {
        bit_rate: "2304000",
        duration: "180.25",
        format_name: "wav",
        tags: { album: "Untrusted Album", artist: "Wrong Artist" },
      },
      streams: [
        {
          bits_per_sample: 24,
          channels: 2,
          codec_name: "pcm_s24le",
          codec_type: "audio",
          sample_rate: "48000",
        },
      ],
    })
  );

  assert.deepEqual(result, {
    bitDepth: 24,
    bitrateKbps: 2304,
    channels: 2,
    codec: "pcm_s24le",
    container: "wav",
    durationMs: 180_250,
    isLossless: true,
    sampleRateHz: 48_000,
  });
  assert.equal("artist" in result, false);
});

test("loudnorm output yields Integrated LUFS and True Peak", () => {
  const result = parseLoudnormOutput(`
    [Parsed_loudnorm_0] summary
    {
      "input_i" : "-7.83",
      "input_tp" : "-0.12",
      "input_lra" : "4.10",
      "input_thresh" : "-18.20",
      "output_i" : "-12.01",
      "output_tp" : "-1.50",
      "output_lra" : "4.00",
      "output_thresh" : "-22.20",
      "normalization_type" : "dynamic",
      "target_offset" : "0.01"
    }
  `);

  assert.equal(result.inputI, -7.83);
  assert.equal(result.inputTp, -0.12);
});

test("lossless eligibility is based on the decoded codec", () => {
  assert.equal(isLosslessCodec("pcm_s24le"), true);
  assert.equal(isLosslessCodec("flac"), true);
  assert.equal(isLosslessCodec("mp3"), false);
  assert.equal(isLosslessCodec("aac"), false);
});

test("SoundKit metadata is allowlisted and source tags are removed", () => {
  const args = buildMetadataArguments({
    artist: "SoundKit Artist",
    comment: "not copied",
    title: "SoundKit Title",
  });

  assert.deepEqual(args.slice(0, 2), ["-map_metadata", "-1"]);
  assert.equal(args.includes("artist=SoundKit Artist"), true);
  assert.equal(args.includes("title=SoundKit Title"), true);
  assert.equal(args.includes("comment=not copied"), false);
});

test("normalized derivatives enforce loudness and True Peak", () => {
  assert.doesNotThrow(() =>
    assertVerifiedDerivative({
      sourceLoudness: { integratedLufs: -7.8 },
      targetLufs: -12,
      verification: { integratedLufs: -12.1, truePeakDbtp: -1.2 },
    })
  );
  assert.throws(
    () =>
      assertVerifiedDerivative({
        sourceLoudness: { integratedLufs: -7.8 },
        targetLufs: -12,
        verification: { integratedLufs: -12, truePeakDbtp: -0.7 },
      }),
    /True Peak/u
  );
});
