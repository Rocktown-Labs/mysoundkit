/* eslint-disable complexity, no-bitwise, no-lonely-if, no-nested-ternary, no-unused-vars, one-var, prefer-destructuring, prefer-named-capture-group, require-unicode-regexp, sort-vars */
/* eslint-disable unicorn/no-abusive-eslint-disable, unicorn/number-literal-case, unicorn/prefer-code-point */
/**
 * Lightweight, zero-dependency binary audio duration parser.
 * Reads headers using DataView in < 1ms without loading full audio files into memory.
 */

const MPEG_BITRATES = {
  v1l1: [
    0, 32_000, 64_000, 96_000, 128_000, 160_000, 192_000, 224_000, 256_000,
    288_000, 320_000, 352_000, 384_000, 416_000, 448_000, 0,
  ],
  v1l2: [
    0, 32_000, 48_000, 56_000, 64_000, 80_000, 96_000, 112_000, 128_000,
    160_000, 192_000, 224_000, 256_000, 320_000, 384_000, 0,
  ],
  v1l3: [
    0, 32_000, 40_000, 48_000, 56_000, 64_000, 80_000, 96_000, 112_000, 128_000,
    160_000, 192_000, 224_000, 256_000, 320_000, 0,
  ],
  v2l12: [
    0, 8000, 16_000, 24_000, 32_000, 40_000, 48_000, 56_000, 64_000, 80_000,
    96_000, 112_000, 128_000, 144_000, 160_000, 0,
  ],
  v2l3: [
    0, 8000, 16_000, 24_000, 32_000, 40_000, 48_000, 56_000, 64_000, 80_000,
    96_000, 112_000, 128_000, 144_000, 160_000, 0,
  ],
};

const MPEG_SAMPLE_RATES: Record<number, number[]> = {
  0: [11_025, 12_000, 8000],
  2: [22_050, 24_000, 16_000],
  3: [44_100, 48_000, 32_000],
};

/**
 * Parses WAV / RIFF headers.
 */
export function parseWavDurationMs(data: Uint8Array): number | null {
  if (data.byteLength < 44) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Check "RIFF" (0x52494646) and "WAVE" (0x57415645)
  if (
    view.getUint32(0, false) !== 0x52_49_46_46 ||
    view.getUint32(8, false) !== 0x57_41_56_45
  ) {
    return null;
  }

  let offset = 12;
  let byteRate: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= data.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);

    // "fmt " = 0x666D7420
    if (chunkId === 0x66_6d_74_20 && offset + 20 <= data.byteLength) {
      byteRate = view.getUint32(offset + 16, true);
    } else if (chunkId === 0x64_61_74_61) {
      // "data" = 0x64617461
      dataSize = chunkSize;
    }

    if (byteRate && dataSize !== null) {
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (byteRate && byteRate > 0 && dataSize && dataSize > 0) {
    return Math.round((dataSize * 1000) / byteRate);
  }

  return null;
}

/**
 * Parses FLAC STREAMINFO header.
 */
export function parseFlacDurationMs(data: Uint8Array): number | null {
  if (data.byteLength < 42) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // "fLaC" = 0x664C6143
  if (view.getUint32(0, false) !== 0x66_4c_61_43) {
    return null;
  }

  const blockType = view.getUint8(4) & 0x7f;
  if (blockType !== 0) {
    return null;
  }

  const b10 = view.getUint8(18);
  const b11 = view.getUint8(19);
  const b12 = view.getUint8(20);
  const b13 = view.getUint8(21);
  const b14 = view.getUint8(22);
  const b15 = view.getUint8(23);
  const b16 = view.getUint8(24);
  const b17 = view.getUint8(25);

  const sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
  const totalSamples =
    (b13 & 0x0f) * 0x1_00_00_00_00 +
    b14 * 0x1_00_00_00 +
    (b15 << 16) +
    (b16 << 8) +
    b17;

  if (sampleRate > 0 && totalSamples > 0) {
    return Math.round((totalSamples * 1000) / sampleRate);
  }

  return null;
}

/**
 * Parses MP3 / MPEG Audio Frame & VBR/CBR headers.
 */
export function parseMp3DurationMs(
  data: Uint8Array,
  totalFileSize?: number
): number | null {
  if (data.byteLength < 10) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  // Check ID3v2 tag: "ID3"
  if (
    view.getUint8(0) === 0x49 &&
    view.getUint8(1) === 0x44 &&
    view.getUint8(2) === 0x33
  ) {
    const id3Size =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);
    offset = 10 + id3Size;
  }

  while (offset + 4 < data.byteLength) {
    if (
      view.getUint8(offset) === 0xff &&
      (view.getUint8(offset + 1) & 0xe0) === 0xe0
    ) {
      const b1 = view.getUint8(offset + 1);
      const b2 = view.getUint8(offset + 2);
      const b3 = view.getUint8(offset + 3);

      const versionBits = (b1 >> 3) & 0x03;
      const layerBits = (b1 >> 1) & 0x03;
      const bitrateIndex = (b2 >> 4) & 0x0f;
      const sampleRateIndex = (b2 >> 2) & 0x03;
      const channelMode = (b3 >> 6) & 0x03;

      if (
        versionBits !== 1 &&
        layerBits !== 0 &&
        bitrateIndex !== 0 &&
        bitrateIndex !== 15 &&
        sampleRateIndex !== 3
      ) {
        const sampleRates = MPEG_SAMPLE_RATES[versionBits];
        const sampleRate = sampleRates
          ? sampleRates[sampleRateIndex]
          : undefined;

        let bitrate = 0;
        let samplesPerFrame = 1152;

        if (versionBits === 3) {
          if (layerBits === 1) {
            bitrate = MPEG_BITRATES.v1l3[bitrateIndex] ?? 0;
            samplesPerFrame = 1152;
          } else if (layerBits === 2) {
            bitrate = MPEG_BITRATES.v1l2[bitrateIndex] ?? 0;
            samplesPerFrame = 1152;
          } else if (layerBits === 3) {
            bitrate = MPEG_BITRATES.v1l1[bitrateIndex] ?? 0;
            samplesPerFrame = 384;
          }
        } else {
          if (layerBits === 1) {
            bitrate = MPEG_BITRATES.v2l3[bitrateIndex] ?? 0;
            samplesPerFrame = 576;
          } else {
            bitrate = MPEG_BITRATES.v2l12[bitrateIndex] ?? 0;
            samplesPerFrame = 1152;
          }
        }

        if (sampleRate && bitrate > 0) {
          const sideInfoSize =
            versionBits === 3
              ? channelMode === 3
                ? 17
                : 32
              : channelMode === 3
                ? 9
                : 17;
          const xingOffset = offset + 4 + sideInfoSize;

          if (xingOffset + 12 <= data.byteLength) {
            const xingTag = view.getUint32(xingOffset, false);

            // "Xing" = 0x58696E67, "Info" = 0x496E666F
            if (xingTag === 0x58_69_6e_67 || xingTag === 0x49_6e_66_6f) {
              const flags = view.getUint32(xingOffset + 4, false);

              if ((flags & 0x01) !== 0) {
                const totalFrames = view.getUint32(xingOffset + 8, false);

                if (totalFrames > 0) {
                  return Math.round(
                    (totalFrames * samplesPerFrame * 1000) / sampleRate
                  );
                }
              }
            }
          }

          const vbriOffset = offset + 36;
          if (vbriOffset + 18 <= data.byteLength) {
            const vbriTag = view.getUint32(vbriOffset, false);

            // "VBRI" = 0x56425249
            if (vbriTag === 0x56_42_52_49) {
              const totalFrames = view.getUint32(vbriOffset + 14, false);

              if (totalFrames > 0) {
                return Math.round(
                  (totalFrames * samplesPerFrame * 1000) / sampleRate
                );
              }
            }
          }

          const fileSize = totalFileSize ?? data.byteLength;
          const audioBytes = Math.max(0, fileSize - offset);
          if (audioBytes > 0) {
            return Math.round((audioBytes * 8 * 1000) / bitrate);
          }
        }
      }
    }

    offset += 1;
  }

  return null;
}

/**
 * Universal fast header duration parser.
 */
export function parseAudioHeaderDurationMs(
  data: Uint8Array,
  totalFileSize?: number
): number | null {
  if (!data || data.byteLength < 12) {
    return null;
  }

  const wav = parseWavDurationMs(data);
  if (wav && wav > 0) {
    return wav;
  }

  const flac = parseFlacDurationMs(data);
  if (flac && flac > 0) {
    return flac;
  }

  const mp3 = parseMp3DurationMs(data, totalFileSize);
  if (mp3 && mp3 > 0) {
    return mp3;
  }

  return null;
}
