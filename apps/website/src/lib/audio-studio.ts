/* eslint-disable complexity, no-nested-ternary, unicorn/no-nested-ternary, unicorn/prefer-number-properties, sort-vars, one-var, no-unused-vars */
import { registerAacEncoder } from "@mediabunny/aac-encoder";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

let aacEncoderRegistered = false;

export const ensureMediaBunnyAacEncoder = async () => {
  if (typeof window === "undefined" || aacEncoderRegistered) {
    return;
  }

  try {
    const hasNativeAac = await canEncodeAudio("aac");
    if (!hasNativeAac) {
      registerAacEncoder();
    }
    aacEncoderRegistered = true;
  } catch (error) {
    console.warn("MediaBunny AAC polyfill setup skipped:", error);
  }
};

export interface AudioMetadataResult {
  channels: number;
  durationMs: number;
  format: string;
  sampleRate: number;
}

export const readAudioFileMetadata = async (
  file: File | Blob
): Promise<AudioMetadataResult | null> => {
  try {
    const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(file),
      }),
      audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      return null;
    }

    const durationSec = (await input.computeDuration()) ?? 0,
      format = (await input.getFormat()) ?? "unknown";

    return {
      channels: audioTrack.numberOfChannels ?? 2,
      durationMs: Math.round(durationSec * 1000),
      format: typeof format === "string" ? format : format.name,
      sampleRate: audioTrack.sampleRate ?? 44_100,
    };
  } catch (error) {
    console.warn(
      "MediaBunny metadata parse error, falling back to WebAudio:",
      error
    );
    return null;
  }
};

export const extractAudioWaveformPeaks = async (
  file: File | Blob,
  barCount = 64
): Promise<number[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer(),
      AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

    if (!AudioContextClass) {
      return Array.from({ length: barCount }, () => 0.5);
    }

    const audioCtx = new AudioContextClass();
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer),
        channelData = audioBuffer.getChannelData(0),
        blockSize = Math.floor(channelData.length / barCount),
        peaks: number[] = [];

      for (let i = 0; i < barCount; i += 1) {
        const start = i * blockSize;
        let sum = 0;
        for (let j = 0; j < blockSize; j += 1) {
          sum += Math.abs(channelData[start + j] ?? 0);
        }
        peaks.push(Math.min(1, Math.max(0.05, (sum / blockSize) * 4)));
      }

      return peaks;
    } finally {
      await audioCtx.close();
    }
  } catch (error) {
    console.warn("Waveform extraction fallback triggered:", error);
    return Array.from(
      { length: barCount },
      (_, index) => Math.abs(Math.sin((index / barCount) * Math.PI)) * 0.8 + 0.1
    );
  }
};

export const createOptimizedAudioPreview = async (
  file: File,
  maxDurationSeconds = 30
): Promise<File | null> => {
  if (!file.type.startsWith("audio/")) {
    return null;
  }

  await ensureMediaBunnyAacEncoder();

  try {
    const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(file),
      }),
      output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
      }),
      conversion = await Conversion.init({
        input,
        output,
        trim: {
          end: maxDurationSeconds,
          start: 0,
        },
      });

    await conversion.execute();

    const outputBuffer = output.target.buffer;
    if (!outputBuffer) {
      return null;
    }

    const baseName = file.name.replace(/\.[^.]+$/u, "");
    return new File([outputBuffer], `${baseName}.preview.m4a`, {
      type: "audio/mp4",
    });
  } catch (error) {
    console.warn("MediaBunny conversion fallback:", error);
    return null;
  }
};
