/* eslint-disable one-var, sort-vars */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  audioDiagnosticJobs,
  trackAssets,
  tracks,
  userNotifications,
} from "@soundkit/db/schema/app";
import { desc, eq } from "drizzle-orm";

import { MEDIA_PIPELINE_VERSION } from "@/lib/media-pipeline";
import type { MediaProcessor } from "@/lib/media-processor";
import { resolveTrackAssetFromRows } from "@/lib/track-asset-resolver";

export const AUDIO_DIAGNOSTIC_TESTS = [
  "playback_resolution",
  "derivative_loudness",
  "gain_estimate",
  "master_headroom",
] as const;

export type AudioDiagnosticTest = (typeof AUDIO_DIAGNOSTIC_TESTS)[number];

export const AUDIO_DIAGNOSTIC_TEST_META: Record<
  AudioDiagnosticTest,
  { description: string; label: string }
> = {
  derivative_loudness: {
    description:
      "Fresh loudness analysis of the streaming file: integrated LUFS vs the -13 target and true peak vs the -1 dBTP ceiling.",
    label: "Derivative loudness + true peak",
  },
  gain_estimate: {
    description:
      "Estimated normalization gain (derivative LUFS minus master LUFS). Large upward gain flags noise-floor lift.",
    label: "Normalization gain estimate",
  },
  master_headroom: {
    description:
      "Whether the uploaded master already exceeds 0 dBTP — distinguishes baked-in clipping from pipeline-introduced clipping.",
    label: "Master headroom",
  },
  playback_resolution: {
    description:
      "Which asset actually serves playback: normalized streaming derivative, legacy fallback, or master — plus pipeline version.",
    label: "Playback resolution",
  },
};

export const MAX_DIAGNOSTIC_TRACKS = 25,
  STREAMING_TARGET_LUFS = -13,
  STREAMING_LUFS_TOLERANCE = 1,
  TRUE_PEAK_CEILING_DBTP = -1,
  UPWARD_GAIN_WARN_DB = 6;

export type DiagnosticVerdict = "pass" | "warn" | "fail" | "skipped";

export interface DiagnosticCheck {
  detail: string;
  test: AudioDiagnosticTest;
  verdict: DiagnosticVerdict;
}

export interface TrackDiagnosticResult {
  checks: DiagnosticCheck[];
  trackId: string;
  trackTitle: string;
  verdict: DiagnosticVerdict;
}

const finiteOrNull = (value: unknown): number | null => {
    const parsed =
      typeof value === "string" || typeof value === "number"
        ? Number(value)
        : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  },
  worstVerdict = (verdicts: DiagnosticVerdict[]): DiagnosticVerdict => {
    if (verdicts.includes("fail")) {
      return "fail";
    }
    if (verdicts.includes("warn")) {
      return "warn";
    }
    if (verdicts.every((verdict) => verdict === "skipped")) {
      return "skipped";
    }
    return "pass";
  };

export const evaluateDerivativeLoudness = ({
  integratedLufs,
  truePeakDbtp,
}: {
  integratedLufs: number | null;
  truePeakDbtp: number | null;
}): DiagnosticCheck => {
  if (integratedLufs === null || truePeakDbtp === null) {
    return {
      detail: "Streaming file could not be analyzed.",
      test: "derivative_loudness",
      verdict: "skipped",
    };
  }
  const lufsDelta = integratedLufs - STREAMING_TARGET_LUFS,
    lines = [
      `Integrated ${integratedLufs.toFixed(1)} LUFS (target ${STREAMING_TARGET_LUFS}, Δ ${lufsDelta >= 0 ? "+" : ""}${lufsDelta.toFixed(1)})`,
      `True peak ${truePeakDbtp.toFixed(1)} dBTP (ceiling ${TRUE_PEAK_CEILING_DBTP})`,
    ];
  if (truePeakDbtp > 0) {
    return {
      detail: `${lines.join(" · ")}. Inter-sample peaks exceed 0 dBFS — will clip on many DACs/phones.`,
      test: "derivative_loudness",
      verdict: "fail",
    };
  }
  if (
    truePeakDbtp > TRUE_PEAK_CEILING_DBTP ||
    Math.abs(lufsDelta) > STREAMING_LUFS_TOLERANCE
  ) {
    return {
      detail: `${lines.join(" · ")}. Outside delivery gates.`,
      test: "derivative_loudness",
      verdict: "warn",
    };
  }
  return {
    detail: `${lines.join(" · ")}. Within delivery gates.`,
    test: "derivative_loudness",
    verdict: "pass",
  };
};

export const evaluateGainEstimate = ({
  derivativeLufs,
  masterLufs,
}: {
  derivativeLufs: number | null;
  masterLufs: number | null;
}): DiagnosticCheck => {
  if (derivativeLufs === null || masterLufs === null) {
    return {
      detail:
        "Gain estimate needs stored master loudness and a derivative measurement.",
      test: "gain_estimate",
      verdict: "skipped",
    };
  }
  const gainDb = derivativeLufs - masterLufs,
    detail = `Estimated applied gain ${gainDb >= 0 ? "+" : ""}${gainDb.toFixed(1)} dB (master ${masterLufs.toFixed(1)} → streaming ${derivativeLufs.toFixed(1)} LUFS)`;
  if (gainDb > UPWARD_GAIN_WARN_DB) {
    return {
      detail: `${detail}. Large upward lift raises the noise floor and hiss on quiet material.`,
      test: "gain_estimate",
      verdict: "warn",
    };
  }
  return { detail: `${detail}.`, test: "gain_estimate", verdict: "pass" };
};

export const evaluateMasterHeadroom = (
  masterTruePeak: number | null
): DiagnosticCheck => {
  if (masterTruePeak === null) {
    return {
      detail: "No stored master true-peak measurement.",
      test: "master_headroom",
      verdict: "skipped",
    };
  }
  if (masterTruePeak > 0) {
    return {
      detail: `Master true peak ${masterTruePeak.toFixed(1)} dBTP already exceeds 0 dBFS — clipping is baked into the upload, not introduced by normalization.`,
      test: "master_headroom",
      verdict: "warn",
    };
  }
  return {
    detail: `Master true peak ${masterTruePeak.toFixed(1)} dBTP — clean headroom at upload.`,
    test: "master_headroom",
    verdict: "pass",
  };
};

export interface PlaybackResolutionInput {
  assetKind: string | null;
  assetPurpose: string | null;
  processingVersion: number | null;
}

export const evaluatePlaybackResolution = ({
  assetKind,
  assetPurpose,
  processingVersion,
}: PlaybackResolutionInput): DiagnosticCheck => {
  if (!assetPurpose) {
    return {
      detail: "No playable asset resolves for this track.",
      test: "playback_resolution",
      verdict: "fail",
    };
  }
  if (assetPurpose === "streaming") {
    const stale =
      processingVersion !== null && processingVersion < MEDIA_PIPELINE_VERSION;
    return {
      detail: stale
        ? `Normalized streaming derivative, but pipeline v${processingVersion} (current v${MEDIA_PIPELINE_VERSION}) — pending backfill.`
        : `Normalized streaming derivative (pipeline v${processingVersion ?? "?"}, current v${MEDIA_PIPELINE_VERSION}).`,
      test: "playback_resolution",
      verdict: stale ? "warn" : "pass",
    };
  }
  return {
    detail: `Playback serves ${assetPurpose} / ${assetKind ?? "?"} — bypasses normalization and limiting entirely.`,
    test: "playback_resolution",
    verdict: "warn",
  };
};

export const runTrackDiagnostics = async ({
  processor,
  requestedTests,
  trackId,
  trackTitle,
}: {
  processor: Pick<MediaProcessor, "analyzeLoudness"> | null;
  requestedTests: AudioDiagnosticTest[];
  trackId: string;
  trackTitle: string;
}): Promise<TrackDiagnosticResult> => {
  const checks: DiagnosticCheck[] = [];
  if (!isDatabaseConfigured()) {
    return { checks, trackId, trackTitle, verdict: "skipped" };
  }
  const db = createDb(),
    [track] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);
  if (!track) {
    checks.push({
      detail: "Track not found.",
      test: "playback_resolution",
      verdict: "skipped",
    });
    return { checks, trackId, trackTitle, verdict: "skipped" };
  }
  const assets = await db
    .select()
    .from(trackAssets)
    .where(eq(trackAssets.trackId, trackId));
  const currentAssets = assets.filter((asset) => asset.isCurrent),
    streamingAsset = resolveTrackAssetFromRows({
      allowLegacyFallback: true,
      assets: currentAssets,
      purpose: "streaming",
      trackId,
    }),
    masterAsset =
      currentAssets.find(
        (asset) => asset.assetKind === "master" && asset.purpose === "master"
      ) ?? null;

  if (requestedTests.includes("playback_resolution")) {
    checks.push(
      evaluatePlaybackResolution({
        assetKind: streamingAsset?.assetKind ?? null,
        assetPurpose: streamingAsset?.purpose ?? null,
        processingVersion: streamingAsset?.processingVersion ?? null,
      })
    );
  }

  let freshDerivativeLufs: number | null = null,
    freshDerivativeTp: number | null = null;
  const needsDerivativeAnalysis =
    requestedTests.includes("derivative_loudness") ||
    requestedTests.includes("gain_estimate");
  if (
    needsDerivativeAnalysis &&
    streamingAsset?.purpose === "streaming" &&
    streamingAsset.objectKey &&
    processor
  ) {
    try {
      const analysis = await processor.analyzeLoudness({
        sourceObjectKey: streamingAsset.objectKey,
      });
      freshDerivativeLufs = finiteOrNull(analysis.integratedLufs);
      freshDerivativeTp = finiteOrNull(analysis.truePeakDbtp);
    } catch {
      freshDerivativeLufs = null;
      freshDerivativeTp = null;
    }
  }
  const storedDerivativeLufs = finiteOrNull(streamingAsset?.integratedLufs),
    storedDerivativeTp = finiteOrNull(streamingAsset?.truePeakDbtp),
    derivativeLufs = freshDerivativeLufs ?? storedDerivativeLufs,
    derivativeTp = freshDerivativeTp ?? storedDerivativeTp;

  if (requestedTests.includes("derivative_loudness")) {
    checks.push(
      evaluateDerivativeLoudness({
        integratedLufs: derivativeLufs,
        truePeakDbtp: derivativeTp,
      })
    );
  }
  if (requestedTests.includes("gain_estimate")) {
    checks.push(
      evaluateGainEstimate({
        derivativeLufs,
        masterLufs: finiteOrNull(masterAsset?.integratedLufs),
      })
    );
  }
  if (requestedTests.includes("master_headroom")) {
    checks.push(
      evaluateMasterHeadroom(finiteOrNull(masterAsset?.truePeakDbtp))
    );
  }

  return {
    checks,
    trackId,
    trackTitle: track.title,
    verdict: worstVerdict(checks.map((check) => check.verdict)),
  };
};

export const STALE_RUNNING_JOB_MS = 5 * 60 * 1000;

export const processDiagnosticJob = async ({
  jobId,
  processor,
}: {
  jobId: string;
  processor: Pick<MediaProcessor, "analyzeLoudness"> | null;
}): Promise<void> => {
  if (!isDatabaseConfigured()) {
    return;
  }
  const db = createDb(),
    [job] = await db
      .select()
      .from(audioDiagnosticJobs)
      .where(eq(audioDiagnosticJobs.id, jobId))
      .limit(1);
  if (!job || job.status === "completed" || job.status === "failed") {
    return;
  }
  await db
    .update(audioDiagnosticJobs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(audioDiagnosticJobs.id, jobId));

  const trackIds = (job.trackIds ?? []) as string[],
    tests = ((job.tests ?? []) as string[]).filter(
      (test): test is AudioDiagnosticTest =>
        (AUDIO_DIAGNOSTIC_TESTS as readonly string[]).includes(test)
    ),
    existingResults = (job.results ?? []) as unknown as TrackDiagnosticResult[],
    completedIds = new Set(existingResults.map((result) => result.trackId));

  try {
    for (const trackId of trackIds) {
      if (completedIds.has(trackId)) {
        continue;
      }
      const [track] = await db
        .select({ title: tracks.title })
        .from(tracks)
        .where(eq(tracks.id, trackId))
        .limit(1);
      const result = await runTrackDiagnostics({
        processor,
        requestedTests: tests,
        trackId,
        trackTitle: track?.title ?? trackId,
      });
      existingResults.push(result);
      await db
        .update(audioDiagnosticJobs)
        .set({
          progressDone: existingResults.length,
          results: existingResults as unknown as Record<string, unknown>[],
          updatedAt: new Date(),
        })
        .where(eq(audioDiagnosticJobs.id, jobId));
    }
    await db
      .update(audioDiagnosticJobs)
      .set({
        completedAt: new Date(),
        progressDone: trackIds.length,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(audioDiagnosticJobs.id, jobId));

    if (job.createdByUserId) {
      const fails = existingResults.filter(
          (result) => result.verdict === "fail"
        ).length,
        warns = existingResults.filter(
          (result) => result.verdict === "warn"
        ).length;
      await db.insert(userNotifications).values({
        entityId: jobId,
        entityType: "audio_diagnostic_job",
        id: crypto.randomUUID(),
        link: "/dashboard/admin?tab=audio",
        message: `${existingResults.length} tracks analyzed — ${fails} failed, ${warns} warnings.`,
        title: "Audio diagnostics complete",
        type: "audio_diagnostics",
        userId: job.createdByUserId,
      });
    }
  } catch (error) {
    await db
      .update(audioDiagnosticJobs)
      .set({
        error: error instanceof Error ? error.message : String(error),
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(audioDiagnosticJobs.id, jobId));
  }
};

export const listDiagnosticJobs = async (limit = 10) => {
  if (!isDatabaseConfigured()) {
    return [];
  }
  return createDb()
    .select()
    .from(audioDiagnosticJobs)
    .orderBy(desc(audioDiagnosticJobs.createdAt))
    .limit(limit);
};
