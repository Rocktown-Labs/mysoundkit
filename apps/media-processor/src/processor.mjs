import { spawn } from "node:child_process";
/* eslint-disable one-var, sort-vars, no-nested-ternary, promise/avoid-new, promise/prefer-await-to-callbacks, unicorn/import-style, unicorn/no-await-expression-member */
/* oxlint-disable unicorn/max-nested-calls */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";

export class DerivativeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DerivativeValidationError";
  }
}

const INTERNAL_R2_ORIGIN = "http://soundkit-r2.internal",
  COMMAND_TIMEOUT_MS = 30 * 60 * 1000,
  SOURCE_CACHE_DIR = join(tmpdir(), "soundkit-media-source-cache"),
  MAX_COMMAND_OUTPUT_BYTES = 2 * 1024 * 1024,
  STREAMING_TARGET_LUFS = -13,
  // The canonical streaming/battle profile accepts -14 through -12 LUFS.
  // AAC encoding and peak limiting can shift integrated loudness slightly.
  // Two-pass normalization followed by AAC encoding reliably lands within ±1 LU
  // of target; tighter gates reject healthy encodes (EBU/Apple-style
  // delivery tolerances are ±0.5-1 LU).
  LOUDNESS_TOLERANCE_LU = 1,
  NORMALIZED_TRUE_PEAK_DBTP = -1.5,
  TRUE_PEAK_LIMIT_DBTP = -1,
  PEAK_CORRECTION_MARGIN_DB = 0.25,
  MIN_LIMITER_CEILING_DBTP = -18,
  NORMALIZATION_MAX_ATTEMPTS = 3,
  AAC_BITRATE = "256k",
  MAX_DELIVERY_SAMPLE_RATE_HZ = 48_000,
  LOSSLESS_CODECS = new Set([
    "alac",
    "ape",
    "flac",
    "mlp",
    "shorten",
    "truehd",
    "tta",
    "wavpack",
  ]),
  purposeContentType = {
    battle: "audio/mp4",
    download: "audio/mp4",
    lossless_download: "audio/flac",
    open_verse_snippet: "audio/mp4",
    project_export: "audio/mp4",
    streaming: "audio/mp4",
  },
  appendBoundedOutput = (current, chunk) => {
    const next = current + chunk.toString();
    return next.length <= MAX_COMMAND_OUTPUT_BYTES
      ? next
      : next.slice(-MAX_COMMAND_OUTPUT_BYTES);
  },
  runCommand = (command, args, { timeoutMs = COMMAND_TIMEOUT_MS } = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env: { ...process.env, LC_ALL: "C" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "",
        stdout = "";
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`${command} exceeded its processing timeout.`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout = appendBoundedOutput(stdout, chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr = appendBoundedOutput(stderr, chunk);
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(
            new Error(
              `${command} exited with code ${code ?? "unknown"}: ${stderr.slice(-4000)}`
            )
          );
          return;
        }
        resolve({ stderr, stdout });
      });
    }),
  finiteNumber = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new TypeError(`FFmpeg did not return a finite ${fieldName}.`);
    }
    return parsed;
  },
  encodedObjectPath = (objectKey) =>
    objectKey.split("/").map(encodeURIComponent).join("/"),
  objectUrl = (objectKey) =>
    `${INTERNAL_R2_ORIGIN}/objects/${encodedObjectPath(objectKey)}`,
  downloadObject = async (objectKey, destination) => {
    const response = await fetch(objectUrl(objectKey));
    if (!response.ok || !response.body) {
      throw new Error(`Unable to read source object: ${response.status}.`);
    }
    await pipeline(response.body, createWriteStream(destination));
  },
  uploadObject = async ({ contentType, objectKey, sourcePath }) => {
    const sourceStat = await stat(sourcePath),
      response = await fetch(objectUrl(objectKey), {
        body: createReadStream(sourcePath),
        duplex: "half",
        headers: {
          "content-length": String(sourceStat.size),
          "content-type": contentType,
        },
        method: "PUT",
      });
    if (!response.ok) {
      throw new Error(`Unable to write derivative object: ${response.status}.`);
    }
    return sourceStat.size;
  },
  sha256File = async (filePath) => {
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(filePath)) {
      digest.update(chunk);
    }
    return digest.digest("hex");
  },
  firstAudioStream = (probe) =>
    probe.streams?.find((stream) => stream.codec_type === "audio") ?? null,
  clipArguments = (clip) =>
    clip
      ? [
          "-ss",
          (clip.startMs / 1000).toFixed(3),
          "-t",
          ((clip.endMs - clip.startMs) / 1000).toFixed(3),
        ]
      : [];

export const isLosslessCodec = (codecName) =>
  codecName.startsWith("pcm_") || LOSSLESS_CODECS.has(codecName);

export const parseFfprobeOutput = (rawOutput) => {
  const probe = JSON.parse(rawOutput),
    audioStream = firstAudioStream(probe);
  if (!audioStream) {
    throw new Error("The uploaded source does not contain an audio stream.");
  }

  const codec = String(audioStream.codec_name ?? "unknown"),
    channels = finiteNumber(audioStream.channels ?? 0, "channel count"),
    durationSeconds = finiteNumber(probe.format?.duration ?? 0, "duration"),
    sampleRateHz = finiteNumber(audioStream.sample_rate ?? 0, "sample rate"),
    bitDepthValue =
      audioStream.bits_per_raw_sample ?? audioStream.bits_per_sample ?? null,
    bitrateValue = audioStream.bit_rate ?? probe.format?.bit_rate ?? null;

  if (channels < 1 || durationSeconds <= 0 || sampleRateHz <= 0) {
    throw new Error(
      "The uploaded source has invalid technical audio metadata."
    );
  }

  return {
    bitDepth: bitDepthValue ? finiteNumber(bitDepthValue, "bit depth") : null,
    bitrateKbps: bitrateValue
      ? Math.round(finiteNumber(bitrateValue, "bitrate") / 1000)
      : null,
    channels,
    codec,
    container: String(probe.format?.format_name ?? "unknown").split(",")[0],
    durationMs: Math.round(durationSeconds * 1000),
    isLossless: isLosslessCodec(codec),
    sampleRateHz,
  };
};

export const parseLoudnormOutput = (rawOutput) => {
  const matches = [
      ...rawOutput.matchAll(
        /\{\s*"input_i"[\s\S]*?"target_offset"\s*:\s*"[^"]+"\s*\}/gu
      ),
    ],
    latest = matches.at(-1)?.[0];
  if (!latest) {
    throw new Error("FFmpeg loudness analysis did not return JSON output.");
  }
  const result = JSON.parse(latest);
  return {
    inputI: finiteNumber(result.input_i, "Integrated LUFS"),
    inputLra: finiteNumber(result.input_lra, "loudness range"),
    inputThreshold: finiteNumber(result.input_thresh, "loudness threshold"),
    inputTp: finiteNumber(result.input_tp, "True Peak"),
    targetOffset: finiteNumber(result.target_offset, "target offset"),
  };
};

export const buildMetadataArguments = (metadata = {}) => {
  const allowedKeys = [
      "album",
      "album_artist",
      "artist",
      "date",
      "genre",
      "isrc",
      "lyrics",
      "title",
      "track",
    ],
    args = ["-map_metadata", "-1"];
  for (const key of allowedKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      args.push("-metadata", `${key}=${value.trim().slice(0, 10_000)}`);
    }
  }
  args.push("-metadata", "encoded_by=SoundKit");
  return args;
};

const inspectFile = async (filePath) => {
    const { stdout } = await runCommand("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=format_name,duration,bit_rate,size:stream=index,codec_type,codec_name,sample_rate,channels,bits_per_raw_sample,bits_per_sample,bit_rate",
      "-of",
      "json",
      filePath,
    ]);
    return parseFfprobeOutput(stdout);
  },
  analyzeFile = async (filePath, clip) => {
    const { stderr } = await runCommand("ffmpeg", [
        "-hide_banner",
        "-nostats",
        "-i",
        filePath,
        ...clipArguments(clip),
        "-map",
        "0:a:0",
        "-af",
        "loudnorm=I=-12:TP=-1:LRA=11:dual_mono=true:print_format=json",
        "-f",
        "null",
        "-",
      ]),
      analysis = parseLoudnormOutput(stderr);
    return {
      integratedLufs: analysis.inputI,
      truePeakDbtp: analysis.inputTp,
      ...analysis,
    };
  },
  // AAC can introduce substantial transient overshoot even when a linear gain
  // prediction looks safe. Always keep a limiter in the render chain; adaptive
  // verification lowers its ceiling without attenuating the whole mix.
  linearGainChain = ({
    analysis,
    gainAdjustmentDb = 0,
    limiterDbtp = NORMALIZED_TRUE_PEAK_DBTP,
    targetLufs,
  }) => {
    const gainDb = targetLufs - analysis.inputI + gainAdjustmentDb,
      limitLinear = 10 ** (limiterDbtp / 20);

    return [
      `volume=${gainDb.toFixed(2)} dB`,
      `alimiter=limit=${limitLinear.toFixed(4)}:attack=5:release=80:level=false`,
    ].join(",");
  },
  nextNormalizationSettings = ({
    gainAdjustmentDb,
    limiterDbtp,
    targetLufs,
    verification,
  }) => {
    const loudnessDelta = targetLufs - verification.integratedLufs,
      peakOvershoot = verification.truePeakDbtp - TRUE_PEAK_LIMIT_DBTP;

    return {
      gainAdjustmentDb:
        Math.abs(loudnessDelta) > LOUDNESS_TOLERANCE_LU
          ? gainAdjustmentDb + loudnessDelta
          : gainAdjustmentDb,
      limiterDbtp:
        peakOvershoot > 0
          ? Math.max(
              MIN_LIMITER_CEILING_DBTP,
              limiterDbtp - peakOvershoot - PEAK_CORRECTION_MARGIN_DB
            )
          : limiterDbtp,
    };
  },
  renderAac = async ({
    analysis,
    clip,
    gainAdjustmentDb,
    inputPath,
    inspection,
    limiterDbtp,
    metadata,
    outputPath,
    targetLufs,
  }) => {
    if (targetLufs !== null && !analysis) {
      throw new Error("Normalized AAC rendering requires source analysis.");
    }

    const channels = Math.min(inspection.channels, 2),
      sampleRateHz = Math.min(
        inspection.sampleRateHz,
        MAX_DELIVERY_SAMPLE_RATE_HZ
      ),
      args = [
        "-hide_banner",
        "-nostats",
        "-y",
        "-i",
        inputPath,
        ...clipArguments(clip),
        "-map",
        "0:a:0",
        "-vn",
        ...buildMetadataArguments(metadata),
        ...(analysis
          ? [
              "-af",
              linearGainChain({
                analysis,
                gainAdjustmentDb,
                limiterDbtp,
                targetLufs,
              }),
            ]
          : []),
        "-c:a",
        "aac",
        "-profile:a",
        "aac_low",
        "-b:a",
        AAC_BITRATE,
        "-ar",
        String(sampleRateHz),
        "-ac",
        String(channels),
        "-movflags",
        "+faststart",
        outputPath,
      ];
    await runCommand("ffmpeg", args);
  },
  renderProjectExport = async ({ inputPath, metadata, outputPath }) => {
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-vn",
      ...buildMetadataArguments(metadata),
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  },
  renderLossless = async ({ inputPath, metadata, outputPath }) => {
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-vn",
      ...buildMetadataArguments(metadata),
      "-c:a",
      "flac",
      "-compression_level",
      "8",
      outputPath,
    ]);
  };

export const requireDerivativeVerification = (verification) => {
  if (!verification) {
    throw new DerivativeValidationError(
      "Derivative loudness verification did not complete."
    );
  }
  return verification;
};

export const assertVerifiedDerivative = ({
  sourceLoudness,
  targetLufs,
  verification,
}) => {
  if (targetLufs !== null) {
    if (
      Math.abs(verification.integratedLufs - targetLufs) > LOUDNESS_TOLERANCE_LU
    ) {
      throw new DerivativeValidationError(
        `Derivative loudness ${verification.integratedLufs} LUFS missed target ${targetLufs} LUFS.`
      );
    }
    if (verification.truePeakDbtp > -1) {
      throw new DerivativeValidationError(
        `Derivative True Peak ${verification.truePeakDbtp} dBTP exceeds -1 dBTP.`
      );
    }
    return;
  }

  if (
    sourceLoudness &&
    Math.abs(verification.integratedLufs - sourceLoudness.integratedLufs) > 1
  ) {
    throw new DerivativeValidationError(
      "Consumer download did not preserve source loudness."
    );
  }
};

const renderDerivative = async ({
    clip,
    inputPath,
    inspection,
    metadata,
    outputPath,
    purpose,
    sourceLoudness,
  }) => {
    const targetLufs =
      purpose === "battle" ||
      purpose === "streaming" ||
      purpose === "open_verse_snippet"
        ? STREAMING_TARGET_LUFS
        : null;

    let verification = null;

    if (purpose === "lossless_download") {
      if (!inspection.isLossless) {
        throw new Error("Lossy sources are not eligible for lossless output.");
      }
      await renderLossless({ inputPath, metadata, outputPath });
      verification = await analyzeFile(outputPath);
    } else if (purpose === "project_export") {
      await renderProjectExport({ inputPath, metadata, outputPath });
      verification = await analyzeFile(outputPath);
    } else if (targetLufs === null) {
      await renderAac({
        clip,
        inputPath,
        inspection,
        metadata,
        outputPath,
        targetLufs: null,
      });
      verification = await analyzeFile(outputPath);
      assertVerifiedDerivative({
        sourceLoudness,
        targetLufs,
        verification,
      });
    } else {
      const normalizationAnalysis = clip
        ? await analyzeFile(inputPath, clip)
        : sourceLoudness;
      let gainAdjustmentDb = 0,
        limiterDbtp = NORMALIZED_TRUE_PEAK_DBTP;

      for (
        let attempt = 0;
        attempt < NORMALIZATION_MAX_ATTEMPTS;
        attempt += 1
      ) {
        await renderAac({
          analysis: normalizationAnalysis,
          clip,
          gainAdjustmentDb,
          inputPath,
          inspection,
          limiterDbtp,
          metadata,
          outputPath,
          targetLufs,
        });
        verification = await analyzeFile(outputPath);

        const loudnessMissed =
            Math.abs(verification.integratedLufs - targetLufs) >
            LOUDNESS_TOLERANCE_LU,
          tpExceeded = verification.truePeakDbtp > TRUE_PEAK_LIMIT_DBTP;

        if (!loudnessMissed && !tpExceeded) {
          break;
        }

        ({ gainAdjustmentDb, limiterDbtp } = nextNormalizationSettings({
          gainAdjustmentDb,
          limiterDbtp,
          targetLufs,
          verification,
        }));
      }

      assertVerifiedDerivative({
        sourceLoudness,
        targetLufs,
        verification,
      });
    }

    verification = requireDerivativeVerification(verification);

    const outputInspection = await inspectFile(outputPath);
    if (purpose === "lossless_download" && !outputInspection.isLossless) {
      throw new Error("Lossless derivative verification failed.");
    }
    return { outputInspection, targetLufs, verification };
  },
  sourceFilePromises = new Map(),
  cachedSourceFile = async (sourceObjectKey) => {
    const existing = sourceFilePromises.get(sourceObjectKey);
    if (existing) {
      return existing;
    }

    const sourcePromise = (async () => {
      await mkdir(SOURCE_CACHE_DIR, { recursive: true });
      const cacheKey = createHash("sha256")
          .update(sourceObjectKey)
          .digest("hex"),
        sourcePath = join(
          SOURCE_CACHE_DIR,
          `${cacheKey}-${basename(sourceObjectKey)}`
        );
      try {
        await stat(sourcePath);
        return sourcePath;
      } catch {
        const temporaryPath = `${sourcePath}.${randomUUID()}.tmp`;
        await downloadObject(sourceObjectKey, temporaryPath);
        await rename(temporaryPath, sourcePath);
        return sourcePath;
      }
    })();
    sourceFilePromises.set(sourceObjectKey, sourcePromise);
    try {
      return await sourcePromise;
    } catch (error) {
      sourceFilePromises.delete(sourceObjectKey);
      throw error;
    }
  },
  withSourceFile = async (sourceObjectKey, callback) => {
    const [workspace, sourcePath] = await Promise.all([
      mkdtemp(join(tmpdir(), "soundkit-media-")),
      cachedSourceFile(sourceObjectKey),
    ]);
    try {
      return await callback({ sourcePath, workspace });
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  };

export const inspectSourceObject = (sourceObjectKey) =>
  withSourceFile(sourceObjectKey, async ({ sourcePath }) => ({
    ...(await inspectFile(sourcePath)),
    sha256: await sha256File(sourcePath),
    sizeBytes: (await stat(sourcePath)).size,
  }));

export const analyzeSourceObject = (sourceObjectKey, clip) =>
  withSourceFile(sourceObjectKey, ({ sourcePath }) =>
    analyzeFile(sourcePath, clip)
  );

export const createDerivativeObject = ({
  clip,
  metadata,
  purpose,
  sourceObjectKey,
  targetObjectKey,
}) =>
  withSourceFile(sourceObjectKey, async ({ sourcePath, workspace }) => {
    const inspection = await inspectFile(sourcePath),
      sourceLoudness = await analyzeFile(sourcePath),
      extension = purpose === "lossless_download" ? "flac" : "m4a",
      outputPath = join(workspace, `output.${extension}`),
      result = await renderDerivative({
        clip,
        inputPath: sourcePath,
        inspection,
        metadata,
        outputPath,
        purpose,
        sourceLoudness,
      }),
      sizeBytes = await uploadObject({
        contentType: purposeContentType[purpose],
        objectKey: targetObjectKey,
        sourcePath: outputPath,
      });

    return {
      contentType: purposeContentType[purpose],
      integratedLufs: result.verification.integratedLufs,
      isLossless: result.outputInspection.isLossless,
      objectKey: targetObjectKey,
      sha256: await sha256File(outputPath),
      sizeBytes,
      technical: result.outputInspection,
      truePeakDbtp: result.verification.truePeakDbtp,
    };
  });

export { linearGainChain, nextNormalizationSettings };
