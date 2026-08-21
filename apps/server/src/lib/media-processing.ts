/* eslint-disable one-var, sort-vars */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  genres,
  mediaProcessingJobs,
  openVerseListings,
  trackAssets,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";

import { logError, logInfo } from "@/middleware/structured-logging";

import type { GeneratedMediaPurpose } from "./media-pipeline";
import type {
  GeneratedMedia,
  LoudnessAnalysis,
  SourceInspection,
} from "./media-processor";

const generatedAssetKind = (purpose: GeneratedMediaPurpose) =>
    purpose === "open_verse_snippet"
      ? ("open_verse_clip" as const)
      : ("variant_audio" as const),
  generatedAssetId = ({
    pipelineVersion,
    purpose,
    sourceAssetId,
  }: {
    pipelineVersion: number;
    purpose: GeneratedMediaPurpose;
    sourceAssetId: string;
  }) => `generated:${sourceAssetId}:${purpose}:v${pipelineVersion}`,
  metadataRecord = (metadata: unknown): Record<string, unknown> =>
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {},
  normalizationTarget = (purpose: GeneratedMediaPurpose) => {
    if (purpose === "streaming" || purpose === "open_verse_snippet") {
      return "-12";
    }
    if (purpose === "battle") {
      return "-10";
    }
    return null;
  };

export interface VerifiedMaster {
  asset: typeof trackAssets.$inferSelect;
  r2Object: R2Object;
}

export const verifyCurrentMaster = async ({
  bucket,
  objectKey,
  sourceAssetId,
  trackId,
}: {
  bucket: R2Bucket;
  objectKey: string;
  sourceAssetId: string;
  trackId: string;
}): Promise<VerifiedMaster> => {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for media processing.");
  }

  const currentMasterPurpose = or(
      eq(trackAssets.purpose, "master"),
      isNull(trackAssets.purpose)
    ),
    [asset] = await createDb()
      .select()
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.id, sourceAssetId),
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.assetKind, "master"),
          eq(trackAssets.isCurrent, true),
          currentMasterPurpose
        )
      )
      .limit(1);
  if (!(asset?.objectKey && asset.objectKey === objectKey)) {
    throw new Error("Workflow source is not the current authoritative master.");
  }
  if (asset.status !== "uploaded" && asset.status !== "ready") {
    throw new Error("Current master is not ready for media processing.");
  }

  const r2Object = await bucket.head(objectKey);
  if (!r2Object || r2Object.size <= 0) {
    throw new Error("Current master object is missing from R2.");
  }

  return { asset, r2Object };
};

export const saveSourceInspection = async ({
  analysis,
  assetId,
  inspection,
}: {
  analysis: LoudnessAnalysis;
  assetId: string;
  inspection: SourceInspection;
}): Promise<void> => {
  const [asset] = await createDb()
    .select()
    .from(trackAssets)
    .where(eq(trackAssets.id, assetId))
    .limit(1);
  if (!asset) {
    throw new Error("Authoritative master asset no longer exists.");
  }
  if (asset.checksum && asset.checksum !== inspection.sha256) {
    throw new Error("Immutable master checksum changed after registration.");
  }

  await createDb()
    .update(trackAssets)
    .set({
      checksum: inspection.sha256,
      durationMs: inspection.durationMs,
      integratedLufs: String(analysis.integratedLufs),
      metadata: {
        ...metadataRecord(asset.metadata),
        bitDepth: inspection.bitDepth,
        bitrateKbps: inspection.bitrateKbps,
        channels: inspection.channels,
        codec: inspection.codec,
        container: inspection.container,
        generatedBy: "soundkit",
        isLossless: inspection.isLossless,
        originalFileName:
          metadataRecord(asset.metadata).originalFileName ?? "master-audio",
        sampleRateHz: inspection.sampleRateHz,
        sourceSha256: inspection.sha256,
      },
      purpose: "master",
      sizeBytes: inspection.sizeBytes,
      truePeakDbtp: String(analysis.truePeakDbtp),
      updatedAt: new Date(),
    })
    .where(eq(trackAssets.id, asset.id));

  logInfo({
    assetId: asset.id,
    codec: inspection.codec,
    durationMs: inspection.durationMs,
    event: "media_analysis_completed",
    integratedLufs: analysis.integratedLufs,
    sizeBytes: inspection.sizeBytes,
    trackId: asset.trackId,
    truePeakDbtp: analysis.truePeakDbtp,
  });
};

export const getSoundKitAudioMetadata = async (
  trackId: string
): Promise<Record<string, string>> => {
  const [row] = await createDb()
    .select({
      artistDisplayName: userProfiles.displayName,
      artistName: authUser.name,
      genre: genres.name,
      isrc: tracks.isrc,
      publishedAt: tracks.publishedAt,
      title: tracks.title,
    })
    .from(tracks)
    .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
    .leftJoin(authUser, eq(authUser.id, tracks.ownerUserId))
    .leftJoin(genres, eq(genres.id, tracks.genreId))
    .where(eq(tracks.id, trackId))
    .limit(1);
  if (!row) {
    throw new Error("Track metadata is unavailable.");
  }

  return Object.fromEntries(
    Object.entries({
      artist: row.artistDisplayName ?? row.artistName ?? "SoundKit Artist",
      date: row.publishedAt?.toISOString().slice(0, 10),
      genre: row.genre ?? undefined,
      isrc: row.isrc ?? undefined,
      title: row.title,
    }).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
};

export const findReusableDerivative = async ({
  bucket,
  pipelineVersion,
  purpose,
  sourceAssetId,
  trackId,
}: {
  bucket: R2Bucket;
  pipelineVersion: number;
  purpose: GeneratedMediaPurpose;
  sourceAssetId: string;
  trackId: string;
}): Promise<typeof trackAssets.$inferSelect | null> => {
  const assetKind = generatedAssetKind(purpose),
    [asset] = await createDb()
      .select()
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.sourceAssetId, sourceAssetId),
          eq(trackAssets.purpose, purpose),
          eq(trackAssets.processingVersion, pipelineVersion),
          eq(trackAssets.assetKind, assetKind),
          eq(trackAssets.isCurrent, true),
          eq(trackAssets.status, "ready")
        )
      )
      .limit(1);
  if (!asset?.objectKey) {
    return null;
  }

  const object = await bucket.head(asset.objectKey);
  if (!object || object.size <= 0) {
    return null;
  }

  logInfo({
    assetId: asset.id,
    event: "media_derivative_reused",
    pipelineVersion,
    purpose,
    sourceAssetId,
    trackId,
  });
  return asset;
};

export const markDerivativeProcessing = async ({
  objectKey,
  pipelineVersion,
  purpose,
  sourceAssetId,
  trackId,
  uploaderUserId,
}: {
  objectKey: string;
  pipelineVersion: number;
  purpose: GeneratedMediaPurpose;
  sourceAssetId: string;
  trackId: string;
  uploaderUserId: null | string;
}): Promise<typeof trackAssets.$inferSelect> => {
  const assetKind = generatedAssetKind(purpose),
    id = generatedAssetId({ pipelineVersion, purpose, sourceAssetId }),
    db = createDb();

  await db.transaction(async (transaction) => {
    await transaction
      .update(trackAssets)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(
        and(
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.purpose, purpose),
          eq(trackAssets.assetKind, assetKind),
          eq(trackAssets.isCurrent, true),
          ne(trackAssets.objectKey, objectKey)
        )
      );
    await transaction
      .insert(trackAssets)
      .values({
        assetKind,
        id,
        isCurrent: true,
        metadata: {
          generatedBy: "soundkit",
          pipelineVersion,
          purpose,
          sourceAssetId,
        },
        mimeType: purpose === "lossless_download" ? "audio/flac" : "audio/mp4",
        objectKey,
        processingVersion: pipelineVersion,
        purpose,
        sourceAssetId,
        status: "processing",
        storageProvider: "r2",
        trackId,
        uploaderUserId,
      })
      .onConflictDoUpdate({
        set: {
          isCurrent: true,
          processingVersion: pipelineVersion,
          purpose,
          sourceAssetId,
          status: "processing",
          updatedAt: new Date(),
        },
        target: [trackAssets.storageProvider, trackAssets.objectKey],
      });
  });

  const [asset] = await db
    .select()
    .from(trackAssets)
    .where(
      and(
        eq(trackAssets.storageProvider, "r2"),
        eq(trackAssets.objectKey, objectKey)
      )
    )
    .limit(1);
  if (!asset) {
    throw new Error("Unable to persist derivative processing state.");
  }

  logInfo({
    assetId: asset.id,
    event: "media_derivative_started",
    pipelineVersion,
    purpose,
    sourceAssetId,
    trackId,
  });
  return asset;
};

export const registerGeneratedDerivative = async ({
  bucket,
  generated,
  pipelineVersion,
  purpose,
  sourceAssetId,
  trackId,
}: {
  bucket: R2Bucket;
  generated: GeneratedMedia;
  pipelineVersion: number;
  purpose: GeneratedMediaPurpose;
  sourceAssetId: string;
  trackId: string;
}): Promise<typeof trackAssets.$inferSelect> => {
  const r2Object = await bucket.head(generated.objectKey);
  if (
    !(r2Object && r2Object.size > 0 && r2Object.size === generated.sizeBytes)
  ) {
    throw new Error("Generated derivative failed R2 verification.");
  }

  const [asset] = await createDb()
    .update(trackAssets)
    .set({
      checksum: generated.sha256,
      durationMs: generated.technical.durationMs,
      integratedLufs: String(generated.integratedLufs),
      metadata: {
        bitDepth: generated.technical.bitDepth,
        bitrateKbps: generated.technical.bitrateKbps,
        channels: generated.technical.channels,
        codec: generated.technical.codec,
        container: generated.technical.container,
        generatedBy: "soundkit",
        isLossless: generated.isLossless,
        pipelineVersion,
        purpose,
        sampleRateHz: generated.technical.sampleRateHz,
        sourceAssetId,
        sourceSha256: generated.sha256,
      },
      mimeType: generated.contentType,
      normalizationTargetLufs: normalizationTarget(purpose),
      sizeBytes: generated.sizeBytes,
      status: "ready",
      truePeakDbtp: String(generated.truePeakDbtp),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trackAssets.trackId, trackId),
        eq(trackAssets.sourceAssetId, sourceAssetId),
        eq(trackAssets.purpose, purpose),
        eq(trackAssets.processingVersion, pipelineVersion),
        eq(trackAssets.objectKey, generated.objectKey)
      )
    )
    .returning();
  if (!asset) {
    throw new Error("Generated derivative registration failed.");
  }

  logInfo({
    assetId: asset.id,
    bytes: generated.sizeBytes,
    codec: generated.technical.codec,
    event: "media_derivative_completed",
    integratedLufs: generated.integratedLufs,
    pipelineVersion,
    purpose,
    sourceAssetId,
    trackId,
    truePeakDbtp: generated.truePeakDbtp,
  });
  return asset;
};

export const markOpenVerseSnippetReady = async ({
  listingId,
  sourceAssetId,
  trackId,
}: {
  listingId: string;
  sourceAssetId: string;
  trackId: string;
}): Promise<void> => {
  const [snippet] = await createDb()
    .select({ id: trackAssets.id })
    .from(trackAssets)
    .where(
      and(
        eq(trackAssets.trackId, trackId),
        eq(trackAssets.sourceAssetId, sourceAssetId),
        eq(trackAssets.purpose, "open_verse_snippet"),
        eq(trackAssets.isCurrent, true),
        eq(trackAssets.status, "ready")
      )
    )
    .limit(1);
  if (!snippet) {
    throw new Error("Open Verse snippet was not registered.");
  }
  await createDb()
    .update(openVerseListings)
    .set({ previewAssetId: snippet.id, updatedAt: new Date() })
    .where(
      and(
        eq(openVerseListings.id, listingId),
        eq(openVerseListings.trackId, trackId)
      )
    );
};

export const markDerivativeFailed = async ({
  error,
  objectKey,
  pipelineVersion,
  purpose,
  sourceAssetId,
  trackId,
}: {
  error: unknown;
  objectKey: string;
  pipelineVersion: number;
  purpose: GeneratedMediaPurpose;
  sourceAssetId: string;
  trackId: string;
}): Promise<void> => {
  const errorMessage =
    error instanceof Error ? error.message : "Derivative generation failed.";
  await createDb()
    .update(trackAssets)
    .set({
      metadata: {
        errorMessage,
        generatedBy: "soundkit",
        pipelineVersion,
        purpose,
        sourceAssetId,
      },
      status: "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trackAssets.trackId, trackId),
        eq(trackAssets.objectKey, objectKey)
      )
    );
  logError({
    error: errorMessage,
    event: "media_derivative_failed",
    pipelineVersion,
    purpose,
    sourceAssetId,
    trackId,
  });
};

type PurposeStatus =
  | "failed"
  | "not_applicable"
  | "processing"
  | "ready"
  | "waiting";
type OverallMediaStatus =
  | "failed"
  | "not_started"
  | "partial"
  | "queued"
  | "ready"
  | "running";

interface TrackMediaProcessingStatus {
  assets: {
    battle: PurposeStatus;
    download: PurposeStatus;
    lossless: PurposeStatus;
    master: PurposeStatus;
    streaming: PurposeStatus;
  };
  currentStage: null | string;
  jobId: null | string;
  mediaReady: boolean;
  processingComplete: boolean;
  retryable: boolean;
  status: OverallMediaStatus;
  workflowInstanceId: null | string;
}

const purposeStatus = (
  asset: typeof trackAssets.$inferSelect | undefined
): PurposeStatus => {
  if (!asset) {
    return "waiting";
  }
  if (asset.status === "ready") {
    return "ready";
  }
  if (asset.status === "failed") {
    return "failed";
  }
  return "processing";
};

const losslessPurposeStatus = (
  isLossless: unknown,
  asset: typeof trackAssets.$inferSelect | undefined
): PurposeStatus => {
  if (isLossless === true) {
    return purposeStatus(asset);
  }
  if (isLossless === false) {
    return "not_applicable";
  }
  return "waiting";
};

export const getTrackMediaProcessingStatus = async (
  trackId: string
): Promise<TrackMediaProcessingStatus> => {
  const db = createDb(),
    [master] = await db
      .select()
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.assetKind, "master"),
          eq(trackAssets.isCurrent, true)
        )
      )
      .orderBy(desc(trackAssets.updatedAt))
      .limit(1);
  if (!master) {
    return {
      assets: {
        battle: "waiting" as const,
        download: "waiting" as const,
        lossless: "waiting" as const,
        master: "waiting" as const,
        streaming: "waiting" as const,
      },
      currentStage: null,
      jobId: null,
      mediaReady: false,
      processingComplete: false,
      retryable: false,
      status: "not_started" as const,
      workflowInstanceId: null,
    };
  }

  const jobWhere = and(
      eq(mediaProcessingJobs.trackId, trackId),
      eq(mediaProcessingJobs.sourceAssetId, master.id),
      eq(mediaProcessingJobs.workflowType, "media_processing")
    ),
    derivativesWhere = and(
      eq(trackAssets.trackId, trackId),
      eq(trackAssets.sourceAssetId, master.id),
      eq(trackAssets.isCurrent, true)
    ),
    [jobRows, derivativeRows] = await Promise.all([
      db
        .select()
        .from(mediaProcessingJobs)
        .where(jobWhere)
        .orderBy(desc(mediaProcessingJobs.updatedAt))
        .limit(1),
      db.select().from(trackAssets).where(derivativesWhere),
    ]),
    job = jobRows[0] ?? null,
    byPurpose = new Map(
      derivativeRows
        .filter((asset) => asset.purpose)
        .map((asset) => [asset.purpose, asset])
    ),
    masterMetadata = metadataRecord(master.metadata),
    assetStates = {
      battle: purposeStatus(byPurpose.get("battle")),
      download: purposeStatus(byPurpose.get("download")),
      lossless: losslessPurposeStatus(
        masterMetadata.isLossless,
        byPurpose.get("lossless_download")
      ),
      master:
        master.status === "ready" || master.status === "uploaded"
          ? ("ready" as const)
          : purposeStatus(master),
      streaming: purposeStatus(byPurpose.get("streaming")),
    },
    mediaReady = assetStates.streaming === "ready",
    processingComplete = Object.values(assetStates).every(
      (status) =>
        status === "ready" || status === "failed" || status === "not_applicable"
    ),
    status: OverallMediaStatus = job?.status ?? "not_started";

  return {
    assets: assetStates,
    currentStage: job?.currentStage ?? null,
    jobId: job?.id ?? null,
    mediaReady,
    processingComplete,
    retryable: status === "failed" || status === "partial" || !job,
    status,
    workflowInstanceId: job?.workflowInstanceId ?? null,
  };
};
