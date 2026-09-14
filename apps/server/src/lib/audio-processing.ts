/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */
import { google } from "@ai-sdk/google";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  projects,
  searchEmbeddings,
  trackAssets,
  trackLyrics,
  trackStemJobs,
  tracks,
  userProfiles,
  videos,
  workflowJobs,
} from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { embed } from "ai";
import { and, count, eq, inArray, ne } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import type { TrackEnrichmentWorkflowPayload } from "@/lib/media-pipeline";
import { notifyTrackProcessingComplete } from "@/lib/track-notifications";

const DEFAULT_EMBEDDING_DIMENSIONS = 1536,
  DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2",
  // Single model for all lyric transcription (cost delta vs base whisper is
  // ~$0.00006/min and tiering doubles code paths/tests for no benefit).
  WORKERS_AI_WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo",
  DEMUCS_SEPARATION_MODEL = "htdemucs",
  // Workers AI Whisper accepts a base64 audio payload; cap single-call bytes
  // so long masters truncate deterministically instead of OOMing the Worker.
  // 3-minute vocal stems at 320k mp3 are ~7MB; longer tracks truncate with
  // metadata truncated:true (byte-chunked transcription is a follow-up).
  MAX_WORKERS_AI_AUDIO_BYTES = 8 * 1024 * 1024,
  // Sequential transcription chunks per vocal stem (~3.5 min each at 320k).
  MAX_TRANSCRIPTION_CHUNKS = 4,
  // Our Demucs container encodes CBR 320k MP3: 320_000 bits/s = 40_000 B/s.
  DEMUCS_MP3_BYTES_PER_SECOND = 40_000,
  LYRIC_LINE_BREAK_SECONDS = 1.2,
  MAX_LYRIC_LINE_CHARACTERS = 64,
  MAX_WORDS_PER_LYRIC_LINE = 9;

/** Demucs in-house separation result (replaces the StemSplit job model). */
export interface DemucsSeparationResult {
  id: string;
  instrumental: { objectKey: string; sizeBytes: number };
  status: "COMPLETED" | "FAILED" | "PROCESSING";
  vocals: { objectKey: string; sizeBytes: number };
}

/** @deprecated StemSplit was removed in favor of in-house Demucs (#257). */
export interface StemSplitJobResponse {
  audioMetadata?: {
    bpm?: number;
    key?: string;
  };
  creditsCharged?: number;
  creditsRequired?: number;
  id: string;
  outputs?: {
    instrumental?: StemSplitOutput;
    vocals?: StemSplitOutput;
  };
  progress?: number;
  status: StemSplitJobStatus;
}

type StemSplitJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface StemSplitOutput {
  expiresAt?: string;
  url?: string;
}

export interface StemSplitJobResponse {
  audioMetadata?: {
    bpm?: number;
    key?: string;
  };
  creditsCharged?: number;
  creditsRequired?: number;
  id: string;
  outputs?: {
    instrumental?: StemSplitOutput;
    vocals?: StemSplitOutput;
  };
  progress?: number;
  status: StemSplitJobStatus;
}

interface OpenAiTranscriptionWord {
  end?: number;
  start?: number;
  word?: string;
}

interface TimedLyricLine {
  endMs: number;
  startMs: number;
  text: string;
}

const getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  getMediaBucket = () =>
    (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET ?? null,
  sha256 = async (value: string) => {
    const data = new TextEncoder().encode(value),
      digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

export const demucsTargetKeys = ({
  pipelineVersion,
  sourceAssetId,
  trackId,
}: {
  pipelineVersion: number;
  sourceAssetId: string;
  trackId: string;
}) => ({
  instrumentalKey: `processed/tracks/${trackId}/demucs-v${pipelineVersion}/${sourceAssetId}/instrumental.mp3`,
  vocalsKey: `processed/tracks/${trackId}/demucs-v${pipelineVersion}/${sourceAssetId}/vocals.mp3`,
});

/** @deprecated StemSplit was removed (#257). Always resolves null. */
export const submitStemSplitJob = (_args: { sourceUrl: string }) =>
  Promise.resolve(null);

/** @deprecated StemSplit was removed (#257). Always resolves null. */
export const getStemSplitJob = (_jobId: string) => Promise.resolve(null);

const saveStemAsset = async ({
    assetKind,
    jobId,
    mimeType,
    objectKey,
    pipelineVersion,
    sizeBytes,
    sourceAssetId,
    trackId,
  }: {
    assetKind: "instrumental" | "vocal_stem";
    jobId: string;
    mimeType: string;
    objectKey: string;
    pipelineVersion: number;
    sizeBytes: number;
    sourceAssetId: string;
    trackId: string;
  }) => {
    // Demucs stems are uploaded straight into R2 by the container, so there
    // is nothing to copy — just register (or refresh) the asset row.
    // Every current row for this track/kind/purpose is cleared first: the
    // partial unique index on (track, purpose, kind) rejects a second
    // current row, so re-runs and pipeline upgrades must not leave the
    // previous version current.
    const bucketName = getEnvValue("UPLOAD_BUCKET_NAME") || "soundkit-media",
      db = createDb(),
      [sourceAsset] = await db
        .select({ uploaderUserId: trackAssets.uploaderUserId })
        .from(trackAssets)
        .where(eq(trackAssets.id, sourceAssetId))
        .limit(1);

    await db
      .update(trackAssets)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(
        and(
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.assetKind, assetKind),
          eq(trackAssets.purpose, "stem"),
          eq(trackAssets.isCurrent, true)
        )
      );

    const [asset] = await db
      .insert(trackAssets)
      .values({
        assetKind,
        bucketName,
        id: `enrichment:${sourceAssetId}:${assetKind}:v${pipelineVersion}`,
        isCurrent: true,
        metadata: {
          generatedBy: "soundkit",
          jobId,
          processingVersion: pipelineVersion,
          separationModel: DEMUCS_SEPARATION_MODEL,
          sourceAssetId,
        },
        mimeType,
        objectKey,
        processingVersion: pipelineVersion,
        purpose: "stem",
        sizeBytes,
        sourceAssetId,
        status: "ready",
        storageProvider: "r2",
        trackId,
        uploaderUserId: sourceAsset?.uploaderUserId ?? null,
      })
      .onConflictDoUpdate({
        set: {
          assetKind,
          bucketName,
          isCurrent: true,
          metadata: {
            generatedBy: "soundkit",
            jobId,
            processingVersion: pipelineVersion,
            separationModel: DEMUCS_SEPARATION_MODEL,
            sourceAssetId,
          },
          mimeType,
          processingVersion: pipelineVersion,
          purpose: "stem",
          sizeBytes,
          sourceAssetId,
          status: "ready",
          trackId,
          updatedAt: new Date(),
          uploaderUserId: sourceAsset?.uploaderUserId ?? null,
        },
        target: [trackAssets.storageProvider, trackAssets.objectKey],
      })
      .returning();

    return asset ?? null;
  },
  secondsToMilliseconds = (seconds: number) =>
    Math.max(0, Math.round(seconds * 1000)),
  cleanTranscriptionWord = (word: string) =>
    word.trim().replaceAll(/\s+/gu, " ");

export const buildTimedLyricLinesFromWords = (
  words: OpenAiTranscriptionWord[]
): TimedLyricLine[] => {
  const lines: TimedLyricLine[] = [];
  let currentWords: string[] = [],
    currentEndMs: null | number = null,
    currentStartMs: null | number = null,
    previousEndSeconds: null | number = null;

  const flushLine = () => {
    const text = currentWords.join(" ").trim();

    if (text && currentStartMs !== null && currentEndMs !== null) {
      lines.push({
        endMs: Math.max(currentEndMs, currentStartMs + 1),
        startMs: currentStartMs,
        text,
      });
    }

    currentWords = [];
    currentStartMs = null;
    currentEndMs = null;
  };

  for (const word of words) {
    if (
      typeof word.start !== "number" ||
      typeof word.end !== "number" ||
      !word.word
    ) {
      continue;
    }

    const text = cleanTranscriptionWord(word.word);

    if (!text) {
      continue;
    }

    const shouldBreakForPause =
        previousEndSeconds !== null &&
        word.start - previousEndSeconds >= LYRIC_LINE_BREAK_SECONDS,
      nextLineText = [...currentWords, text].join(" "),
      shouldBreakForLength =
        currentWords.length >= MAX_WORDS_PER_LYRIC_LINE ||
        nextLineText.length > MAX_LYRIC_LINE_CHARACTERS;

    if (
      currentWords.length > 0 &&
      (shouldBreakForPause || shouldBreakForLength)
    ) {
      flushLine();
    }

    currentStartMs ??= secondsToMilliseconds(word.start);
    currentEndMs = secondsToMilliseconds(word.end);
    currentWords.push(text);
    previousEndSeconds = word.end;
  }

  flushLine();

  return lines;
};

export interface WorkersAiTranscriptionWord {
  end?: number;
  start?: number;
  word?: string;
}

export interface WorkersAiTranscriptionSegment {
  end?: number;
  start?: number;
  text?: string;
  words?: WorkersAiTranscriptionWord[];
}

export interface WorkersAiTranscriptionResponse {
  segments?: WorkersAiTranscriptionSegment[];
  text?: string;
  transcription_info?: {
    duration?: number;
    duration_after_vad?: number;
    language?: string;
    language_probability?: number;
  };
  vtt?: string;
  word_count?: number;
}

export const buildTimedLyricLinesFromSegments = (
  segments: WorkersAiTranscriptionSegment[]
): TimedLyricLine[] => {
  const words: OpenAiTranscriptionWord[] = [];
  for (const segment of segments) {
    if (Array.isArray(segment.words) && segment.words.length > 0) {
      for (const word of segment.words) {
        words.push({ end: word.end, start: word.start, word: word.word });
      }
      continue;
    }
    // No word timings: treat the segment as a single timed line.
    if (
      typeof segment.start === "number" &&
      typeof segment.end === "number" &&
      segment.text?.trim()
    ) {
      words.push({
        end: segment.end,
        start: segment.start,
        word: segment.text.trim(),
      });
    }
  }
  return buildTimedLyricLinesFromWords(words);
};

const vttTimestampToSeconds = (value: string): number | null => {
  const match = value
    .trim()
    .match(/^(?:(\d+):)?([0-5]?\d):([0-5]?\d)\.(\d{3})$/u);
  if (!match) {
    return null;
  }
  const [, hours, minutes, seconds, millis] = match;
  return (
    Number(hours ?? 0) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis) / 1000
  );
};

export const buildTimedLyricLinesFromVtt = (vtt: string): TimedLyricLine[] => {
  const lines: TimedLyricLine[] = [],
    cuePattern =
      /((?:\d+:)?\d{2}:\d{2}\.\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}\.\d{3})\s*\r?\n([\s\S]*?)(?=\r?\n\r?\n|\r?\n*$)/gu;
  let match: RegExpExecArray | null;
  match = cuePattern.exec(vtt);
  while (match !== null) {
    const startRaw = match[1] ?? "",
      endRaw = match[2] ?? "",
      textRaw = match[3] ?? "",
      start = vttTimestampToSeconds(startRaw),
      end = vttTimestampToSeconds(endRaw),
      text = textRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");
    if (start !== null && end !== null && end > start && text) {
      lines.push({
        endMs: secondsToMilliseconds(end),
        startMs: secondsToMilliseconds(start),
        text,
      });
    }
    match = cuePattern.exec(vtt);
  }
  return lines;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    const chunkSize = 8192;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(offset, offset + chunkSize)
      );
    }
    return btoa(binary);
  },
  // Workers AI Whisper input is a base64 audio string (see
  // Ai_Cf_Openai_Whisper_Large_V3_Turbo_Input.audio in
  // @cloudflare/workers-types), not a byte array.
  transcribeAudioChunkWithCloudflareWorkersAi = async ({
    ai,
    audioBytes,
  }: {
    ai: Ai;
    audioBytes: Uint8Array;
  }): Promise<WorkersAiTranscriptionResponse> => {
    const response = (await ai.run(WORKERS_AI_WHISPER_MODEL, {
      audio: bytesToBase64(audioBytes),
      beam_size: 5,
      compression_ratio_threshold: 2.4,
      condition_on_previous_text: false,
      hallucination_silence_threshold: 2,
      initial_prompt:
        "Transcribe song vocals as lyrics. Preserve line-friendly punctuation and avoid adding section labels that are not sung.",
      log_prob_threshold: -1,
      no_speech_threshold: 0.6,
      task: "transcribe",
      vad_filter: true,
    })) as unknown as WorkersAiTranscriptionResponse;
    return {
      ...response,
      text: typeof response.text === "string" ? response.text : "",
    };
  },
  // Long vocal stems are transcribed in sequential bounded R2 range reads so
  // Worker memory never holds more than one chunk and no song is cut to a
  // prefix. Chunk start offsets are estimated from our deterministic CBR 320k
  // Demucs output; word timings shift by that estimate.
  transcribeVocalStemWithCloudflareWorkersAi = async ({
    ai,
    bucket,
    objectKey,
  }: {
    ai: Ai;
    bucket: R2Bucket;
    objectKey: string;
  }): Promise<{
    detectedLanguage: string | null;
    duration: number | null;
    text: string;
    timedLines: TimedLyricLine[];
    truncated: boolean;
    wordCount: number | null;
  }> => {
    const head = await bucket.head(objectKey);
    if (!head) {
      throw new Error("Vocal stem object is missing from R2.");
    }
    const totalBytes = head.size,
      chunkCount = Math.min(
        MAX_TRANSCRIPTION_CHUNKS,
        Math.max(1, Math.ceil(totalBytes / MAX_WORKERS_AI_AUDIO_BYTES))
      ),
      truncated = totalBytes > chunkCount * MAX_WORKERS_AI_AUDIO_BYTES,
      texts: string[] = [],
      words: OpenAiTranscriptionWord[] = [];
    let detectedLanguage: string | null = null,
      duration: number | null = null,
      fallbackVtt = "";
    for (let index = 0; index < chunkCount; index += 1) {
      const offset = index * MAX_WORKERS_AI_AUDIO_BYTES,
        // eslint-disable-next-line no-await-in-loop
        chunk = await bucket.get(objectKey, {
          range: { length: MAX_WORKERS_AI_AUDIO_BYTES, offset },
        });
      if (!chunk) {
        throw new Error(
          `Vocal stem range read failed at byte ${offset} (chunk ${index + 1}/${chunkCount}).`
        );
      }
      // eslint-disable-next-line no-await-in-loop
      const result = await transcribeAudioChunkWithCloudflareWorkersAi({
          ai,
          audioBytes: new Uint8Array(await chunk.arrayBuffer()),
        }),
        offsetSeconds = offset / DEMUCS_MP3_BYTES_PER_SECOND;
      if ((result.text ?? "").trim()) {
        texts.push((result.text ?? "").trim());
      }
      detectedLanguage ??= result.transcription_info?.language ?? null;
      duration ??= result.transcription_info?.duration ?? null;
      for (const segment of result.segments ?? []) {
        if (Array.isArray(segment.words) && segment.words.length > 0) {
          for (const word of segment.words) {
            words.push({
              end:
                typeof word.end === "number"
                  ? word.end + offsetSeconds
                  : undefined,
              start:
                typeof word.start === "number"
                  ? word.start + offsetSeconds
                  : undefined,
              word: word.word,
            });
          }
        } else if (
          typeof segment.start === "number" &&
          typeof segment.end === "number" &&
          segment.text?.trim()
        ) {
          words.push({
            end: segment.end + offsetSeconds,
            start: segment.start + offsetSeconds,
            word: segment.text.trim(),
          });
        }
      }
      if (!fallbackVtt && result.vtt) {
        fallbackVtt = result.vtt;
      }
    }
    if (truncated) {
      console.warn("Vocal stem exceeds transcription chunk budget", {
        objectKey,
        totalBytes,
      });
    }
    const text = texts.join(" ").trim(),
      fromWords = buildTimedLyricLinesFromWords(words);
    return {
      detectedLanguage,
      duration,
      text,
      timedLines:
        fromWords.length > 0
          ? fromWords
          : fallbackVtt
            ? buildTimedLyricLinesFromVtt(fallbackVtt)
            : [],
      truncated,
      wordCount: words.length > 0 ? words.length : null,
    };
  },
  transcribeVocals = async ({
    ai,
    assetId,
    bucket,
    trackId,
  }: {
    ai?: Ai | null;
    assetId: string;
    bucket?: R2Bucket | null;
    trackId: string;
  }) => {
    const db = createDb(),
      [existingLyrics] = await db
        .select()
        .from(trackLyrics)
        .where(
          and(
            eq(trackLyrics.trackId, trackId),
            eq(trackLyrics.sourceAssetId, assetId),
            eq(trackLyrics.sourceType, "machine_transcription")
          )
        )
        .limit(1);
    if (existingLyrics) {
      return existingLyrics;
    }

    const resolvedBucket = bucket ?? getMediaBucket();
    if (!resolvedBucket) {
      throw new Error("MEDIA_BUCKET is required for vocal transcription.");
    }
    if (!ai) {
      throw new Error("Workers AI binding is required for transcription.");
    }
    const [vocalAsset] = await db
      .select({
        objectKey: trackAssets.objectKey,
      })
      .from(trackAssets)
      .where(eq(trackAssets.id, assetId))
      .limit(1);
    if (!vocalAsset?.objectKey) {
      return null;
    }
    // Provider/storage errors throw so the Workflow step retry policy reruns
    // them; only "nothing to transcribe" resolves to null.
    const result = await transcribeVocalStemWithCloudflareWorkersAi({
        ai,
        bucket: resolvedBucket,
        objectKey: vocalAsset.objectKey,
      }),
      text = result.text.trim();

    if (!text) {
      return null;
    }

    const [lyrics] = await db
      .insert(trackLyrics)
      .values({
        id: crypto.randomUUID(),
        language: result.detectedLanguage ?? "en",
        metadata: {
          duration: result.duration,
          language: result.detectedLanguage,
          model: WORKERS_AI_WHISPER_MODEL,
          provider: "cloudflare-workers-ai",
          separationModel: DEMUCS_SEPARATION_MODEL,
          timestampGranularity: "word",
          truncated: result.truncated,
          wordCount: result.wordCount,
        },
        sourceAssetId: assetId,
        sourceType: "machine_transcription",
        status: "pending_review",
        text,
        timedLines: result.timedLines.length > 0 ? result.timedLines : null,
        trackId,
      })
      .returning();

    return lyrics ?? null;
  },
  embeddingModelName = (): string =>
    getEnvValue("GOOGLE_EMBEDDING_MODEL")
      .replace(/^google\//u, "")
      .trim() || DEFAULT_EMBEDDING_MODEL;

export { embeddingModelName };
export { transcribeVocals as transcribeDemucsVocals };

export const backfillSearchEmbeddings = async (limit = 100) => {
  if (!isDatabaseConfigured()) {
    return { indexed: 0, skipped: 0 };
  }

  // Dynamic import avoids a module cycle: semantic-search builds on
  // the embedding primitives in this file.
  const { getTrackIndexText, indexTrackLyrics } =
    await import("@/lib/semantic-search");
  const db = createDb(),
    cappedLimit = Math.min(Math.max(limit, 1), 500);
  let indexed = 0,
    skipped = 0;
  const tally = (status: SaveEmbeddingStatus) => {
    if (status === "inserted") {
      indexed += 1;
    } else {
      skipped += 1;
    }
  };
  const trackRows = await db.select().from(tracks).limit(cappedLimit);
  for (const row of trackRows) {
    tally(
      await indexSearchEntity({
        entityId: row.id,
        entityType: "track",
        organizationId: row.organizationId,
        text: await getTrackIndexText(db, row),
      })
    );
  }
  // Lyrics backfill: join lyrics to their tracks for org + track mapping.
  // The textHash gate inside saveEmbedding makes reruns cheap.
  const lyricRows = await db
    .select({ lyrics: trackLyrics, track: tracks })
    .from(trackLyrics)
    .innerJoin(tracks, eq(tracks.id, trackLyrics.trackId))
    .limit(cappedLimit);
  for (const row of lyricRows) {
    const counts = await indexTrackLyrics({
      lyricsId: row.lyrics.id,
      organizationId: row.track.organizationId,
      text: row.lyrics.text,
      trackId: row.track.id,
    });
    indexed += counts.inserted;
    skipped += counts.skipped;
  }
  const projectRows = await db.select().from(projects).limit(cappedLimit);
  for (const row of projectRows) {
    tally(
      await indexSearchEntity({
        entityId: row.id,
        entityType: "project",
        organizationId: row.organizationId,
        text: [row.title, row.description].filter(Boolean).join("\n"),
      })
    );
  }
  const videoRows = await db.select().from(videos).limit(cappedLimit);
  for (const row of videoRows) {
    tally(
      await indexSearchEntity({
        entityId: row.id,
        entityType: "video",
        organizationId: null,
        text: [row.title, row.description].filter(Boolean).join("\n"),
      })
    );
  }
  const artistRows = await db
    .select({ profile: artistProfiles, profileDetails: userProfiles })
    .from(artistProfiles)
    .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
    .limit(cappedLimit);
  for (const row of artistRows) {
    tally(
      await indexSearchEntity({
        entityId: row.profile.userId,
        entityType: "artist",
        organizationId: row.profile.primaryOrganizationId,
        text: [
          row.profile.stageName,
          row.profileDetails.username,
          row.profileDetails.city,
          row.profileDetails.state,
        ]
          .filter(Boolean)
          .join("\n"),
      })
    );
  }

  return { indexed, skipped };
};

export const loadEmbeddingStatus = async () => {
  if (!isDatabaseConfigured()) {
    return { byEntityType: {}, total: 0 };
  }

  const rows = await createDb()
    .select({ count: count(), entityType: searchEmbeddings.entityType })
    .from(searchEmbeddings)
    .groupBy(searchEmbeddings.entityType);
  return {
    byEntityType: Object.fromEntries(
      rows.map((row) => [row.entityType, row.count])
    ),
    total: rows.reduce((sum, row) => sum + row.count, 0),
  };
};

export type SaveEmbeddingStatus = "failed" | "inserted" | "skipped";

export const normalizeEmbeddingVector = (values: number[]): number[] => {
  if (values.length >= DEFAULT_EMBEDDING_DIMENSIONS) {
    // Slicing is valid for Matryoshka-style models (leading dims carry
    // the most signal). Padding is not: zero-fill corrupts cosine
    // geometry, so short vectors fail loud instead of storing garbage.
    return values.slice(0, DEFAULT_EMBEDDING_DIMENSIONS);
  }
  throw new Error(
    `Embedding model returned ${values.length} dimensions, expected at least ${DEFAULT_EMBEDDING_DIMENSIONS}.`
  );
};

export const indexSearchEntity = ({
  entityId,
  entityType,
  metadata,
  organizationId,
  text,
}: {
  entityId: string;
  entityType: "artist" | "lyrics" | "project" | "track" | "video";
  metadata?: Record<string, unknown>;
  organizationId: null | string;
  text: string;
}): Promise<SaveEmbeddingStatus> =>
  saveEmbedding({ entityId, entityType, metadata, organizationId, text });

export const saveEmbedding = async ({
  entityId,
  entityType,
  metadata,
  organizationId,
  text,
}: {
  entityId: string;
  entityType: "artist" | "lyrics" | "project" | "track" | "video";
  metadata?: Record<string, unknown>;
  organizationId: null | string;
  text: string;
}): Promise<SaveEmbeddingStatus> => {
  if (!text.trim() || !getEnvValue("GOOGLE_GENERATIVE_AI_API_KEY")) {
    return "skipped";
  }

  try {
    const model = embeddingModelName(),
      textHash = await sha256(text),
      db = createDb(),
      [existing] = await db
        .select({ textHash: searchEmbeddings.textHash })
        .from(searchEmbeddings)
        .where(
          and(
            eq(searchEmbeddings.entityType, entityType),
            eq(searchEmbeddings.entityId, entityId),
            eq(searchEmbeddings.model, model)
          )
        )
        .limit(1);
    if (existing && existing.textHash === textHash) {
      return "skipped";
    }

    const result = await embed({
        model: google.embedding(model),
        value: text,
      }),
      embedding = normalizeEmbeddingVector(result.embedding);

    await db
      .insert(searchEmbeddings)
      .values({
        dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
        embedding,
        entityId,
        entityType,
        id: crypto.randomUUID(),
        metadata: metadata ?? null,
        model,
        organizationId,
        textHash,
        textSnapshot: text,
      })
      .onConflictDoUpdate({
        set: {
          embedding,
          indexedAt: new Date(),
          metadata: metadata ?? null,
          textHash,
          textSnapshot: text,
        },
        target: [
          searchEmbeddings.entityType,
          searchEmbeddings.entityId,
          searchEmbeddings.model,
        ],
      });
    return "inserted";
  } catch (error) {
    // Indexing must never break the request that triggered it.
    console.warn("Search embedding skipped", {
      entityId,
      entityType,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
};

export const saveDemucsStemAsset = ({
  assetKind,
  pipelineVersion,
  separation,
  sourceAssetId,
  trackId,
}: {
  assetKind: "instrumental" | "vocal_stem";
  pipelineVersion: number;
  separation: { objectKey: string; sizeBytes: number };
  sourceAssetId: string;
  trackId: string;
}) =>
  saveStemAsset({
    assetKind,
    jobId: `demucs:${sourceAssetId}:v${pipelineVersion}`,
    mimeType: "audio/mpeg",
    objectKey: separation.objectKey,
    pipelineVersion,
    sizeBytes: separation.sizeBytes,
    sourceAssetId,
    trackId,
  });

export const findCurrentDemucsStems = async ({
  pipelineVersion,
  sourceAssetId,
  trackId,
}: {
  pipelineVersion: number;
  sourceAssetId: string;
  trackId: string;
}) => {
  const rows = await createDb()
    .select({
      assetKind: trackAssets.assetKind,
      id: trackAssets.id,
      objectKey: trackAssets.objectKey,
    })
    .from(trackAssets)
    .where(
      and(
        eq(trackAssets.trackId, trackId),
        inArray(trackAssets.assetKind, ["vocal_stem", "instrumental"]),
        eq(trackAssets.purpose, "stem"),
        eq(trackAssets.isCurrent, true),
        eq(trackAssets.sourceAssetId, sourceAssetId),
        eq(trackAssets.processingVersion, pipelineVersion)
      )
    );
  const vocals = rows.find((row) => row.assetKind === "vocal_stem") ?? null,
    instrumental = rows.find((row) => row.assetKind === "instrumental") ?? null;
  return { instrumental, vocals };
};

/** @deprecated Use findCurrentDemucsStems (#257). */
export const findCurrentDemucsVocalStem = async (args: {
  pipelineVersion: number;
  sourceAssetId: string;
  trackId: string;
}) => (await findCurrentDemucsStems(args)).vocals;

/** @deprecated StemSplit was removed (#257). Always returns null. */
export const saveStemSplitOutput = (_args: {
  assetId: string;
  job: StemSplitJobResponse;
  output: "instrumental" | "vocals";
  trackId: string;
}) => null;

export const transcribeStemSplitVocals = ({
  ai,
  bucket,
  trackId,
  vocalsAssetId,
}: {
  ai?: Ai | null;
  bucket?: R2Bucket | null;
  trackId: string;
  vocalsAssetId: string | null;
}) => {
  if (!vocalsAssetId) {
    return null;
  }
  return transcribeVocals({ ai, assetId: vocalsAssetId, bucket, trackId });
};

export const finalizeTrackEnrichment = async ({
  emailQueue,
  inputAssetId,
  jobId,
  lyrics,
  suppressNotifications = false,
  trackId,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  inputAssetId: string;
  jobId: string;
  lyrics: null | { id: string; text: string };
  /** Backfill/admin runs set this so artists get no 1am lyric emails. */
  suppressNotifications?: boolean;
  trackId: string;
}) => {
  const db = createDb(),
    now = new Date();
  await db
    .update(tracks)
    .set({
      lyricsStatus: lyrics ? "pending_review" : "failed",
      updatedAt: now,
    })
    .where(
      lyrics
        ? and(eq(tracks.id, trackId), ne(tracks.lyricsStatus, "approved"))
        : and(eq(tracks.id, trackId), eq(tracks.lyricsStatus, "generating"))
    );

  const [track] = await db
    .select()
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);
  if (track) {
    // Dynamic import avoids a module cycle: semantic-search builds on
    // the embedding primitives in this file.
    const { getTrackIndexText, indexTrackLyrics } =
      await import("@/lib/semantic-search");
    await saveEmbedding({
      entityId: track.id,
      entityType: "track",
      organizationId: track.organizationId,
      text: await getTrackIndexText(db, track),
    });
    if (lyrics) {
      await indexTrackLyrics({
        lyricsId: lyrics.id,
        organizationId: track.organizationId,
        text: lyrics.text,
        trackId: track.id,
      });
    }
    // Audio-native vectors: enabled in deployed env via
    // AUDIO_EMBEDDINGS_ENABLED; failures never break enrichment.
    try {
      const audioEmbeddings = await import("@/lib/audio-embeddings");
      if (audioEmbeddings.audioEmbeddingsEnabled()) {
        const { resolveTrackAssetFromRows } =
            await import("@/lib/track-asset-resolver"),
          bucket = getMediaBucket(),
          assets = await db
            .select()
            .from(trackAssets)
            .where(eq(trackAssets.trackId, track.id)),
          streaming = resolveTrackAssetFromRows({
            allowLegacyFallback: false,
            assets: assets.filter((asset) => asset.isCurrent),
            purpose: "streaming",
            trackId: track.id,
          });
        if (bucket && streaming?.objectKey) {
          const object = await bucket.get(streaming.objectKey);
          if (object) {
            const bytes = await object.arrayBuffer();
            if (bytes.byteLength <= 8 * 1024 * 1024) {
              await audioEmbeddings.indexTrackAudio({
                audioBytes: bytes,
                mimeType: "audio/mp4",
                organizationId: track.organizationId,
                trackId: track.id,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn("Track audio embedding skipped", {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
    }
  }

  await db
    .update(trackStemJobs)
    .set({
      completedAt: now,
      progress: 100,
      status: "completed",
      stemsplitJobId: jobId,
      updatedAt: now,
    })
    .where(
      and(
        eq(trackStemJobs.trackId, trackId),
        eq(trackStemJobs.inputAssetId, inputAssetId)
      )
    );
  if (!suppressNotifications) {
    await notifyTrackProcessingComplete({ emailQueue, trackId });
  }
};

/** @deprecated StemSplit was removed (#257). No-op for legacy webhooks. */
export const processCompletedStemSplitJob = async (_args: {
  assetId: string;
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  job: StemSplitJobResponse;
  trackId: string;
}) => null;

/** @deprecated StemSplit submission was removed (#257). Use the Demucs container. */
export const processTrackAudio = async (
  _args: TrackEnrichmentWorkflowPayload
): Promise<never> => {
  throw new Error(
    "StemSplit submission was removed; use Demucs separation (#257)."
  );
};

/** @deprecated StemSplit polling was removed (#257). Use the Demucs container. */
export const pollStemSplitJob = async (_args: {
  stemsplitJobId: string;
  trackId: string;
}): Promise<never> => {
  throw new Error(
    "StemSplit polling was removed; use Demucs separation (#257)."
  );
};

export const createWorkflowJobRow = async ({
  input,
  jobType,
  targetId,
  targetType,
}: {
  input: unknown;
  jobType: string;
  targetId: string;
  targetType: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb(),
    [job] = await db
      .insert(workflowJobs)
      .values({
        id: crypto.randomUUID(),
        input,
        jobType,
        targetId,
        targetType,
      })
      .returning();

  return job ?? null;
};
