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
import { and, count, eq, ne } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import type { TrackEnrichmentWorkflowPayload } from "@/lib/media-pipeline";
import { ENRICHMENT_PIPELINE_VERSION } from "@/lib/media-pipeline";
import { createSignedMediaSourceUrl } from "@/lib/media-signing";
import { notifyTrackProcessingComplete } from "@/lib/track-notifications";

const DEFAULT_EMBEDDING_DIMENSIONS = 1536,
  DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2",
  OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions",
  STEMSPLIT_BASE_URL = "https://stemsplit.io/api/v1",
  MAX_OPENAI_TRANSCRIPTION_FILE_BYTES = 25 * 1024 * 1024,
  LYRIC_LINE_BREAK_SECONDS = 1.2,
  MAX_LYRIC_LINE_CHARACTERS = 64,
  MAX_WORDS_PER_LYRIC_LINE = 9;

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

interface OpenAiVerboseTranscriptionResponse {
  duration?: number;
  language?: string;
  text?: string;
  words?: OpenAiTranscriptionWord[];
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
  },
  stemsplitFetch = async <T>(path: string, init?: RequestInit) => {
    const apiKey = getEnvValue("STEMSPLIT_API_KEY");

    if (!apiKey) {
      return null;
    }

    const response = await fetch(`${STEMSPLIT_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`StemSplit request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  },
  mapStemJobStatus = (status: StemSplitJobStatus) => {
    if (status === "COMPLETED") {
      return "completed" as const;
    }

    if (status === "FAILED") {
      return "failed" as const;
    }

    if (status === "PROCESSING") {
      return "processing" as const;
    }

    return "submitted" as const;
  };

export const submitStemSplitJob = ({ sourceUrl }: { sourceUrl: string }) =>
  stemsplitFetch<StemSplitJobResponse>("/jobs", {
    body: JSON.stringify({
      outputFormat: "MP3",
      outputType: "BOTH",
      quality: "BEST",
      sourceUrl,
    }),
    method: "POST",
  });

export const getStemSplitJob = (jobId: string) =>
  stemsplitFetch<StemSplitJobResponse>(`/jobs/${jobId}`, {
    method: "GET",
  });

const copyStemOutputToR2 = async ({
    sourceUrl,
    targetKey,
  }: {
    sourceUrl: string;
    targetKey: string;
  }) => {
    const bucket = getMediaBucket();

    if (!bucket) {
      throw new Error("MEDIA_BUCKET is not configured.");
    }

    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(`Stem output download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer(),
      contentType = response.headers.get("content-type") ?? "audio/mpeg";

    await bucket.put(targetKey, arrayBuffer, {
      httpMetadata: {
        contentType,
      },
    });

    return {
      bucketName: getEnvValue("UPLOAD_BUCKET_NAME") || "soundkit-media",
      mimeType: contentType,
      objectKey: targetKey,
      sizeBytes: arrayBuffer.byteLength,
    };
  },
  saveStemAsset = async ({
    assetKind,
    sourceAssetId,
    sourceOutput,
    stemsplitJobId,
    targetKey,
    trackId,
  }: {
    assetKind: "instrumental" | "vocal_stem";
    sourceAssetId: string;
    sourceOutput: StemSplitOutput;
    stemsplitJobId: string;
    targetKey: string;
    trackId: string;
  }) => {
    if (!sourceOutput.url) {
      return null;
    }

    const copied = await copyStemOutputToR2({
        sourceUrl: sourceOutput.url,
        targetKey,
      }),
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
          eq(trackAssets.isCurrent, true),
          ne(trackAssets.sourceAssetId, sourceAssetId)
        )
      );

    const [asset] = await db
      .insert(trackAssets)
      .values({
        assetKind,
        bucketName: copied.bucketName,
        id: `enrichment:${sourceAssetId}:${assetKind}:v${ENRICHMENT_PIPELINE_VERSION}`,
        isCurrent: true,
        metadata: {
          expiresAt: sourceOutput.expiresAt ?? null,
          generatedBy: "soundkit",
          processingVersion: ENRICHMENT_PIPELINE_VERSION,
          sourceAssetId,
          stemsplitJobId,
        },
        mimeType: copied.mimeType,
        objectKey: copied.objectKey,
        processingVersion: ENRICHMENT_PIPELINE_VERSION,
        purpose: "stem",
        sizeBytes: copied.sizeBytes,
        sourceAssetId,
        status: "ready",
        storageProvider: "r2",
        trackId,
        uploaderUserId: sourceAsset?.uploaderUserId ?? null,
      })
      .onConflictDoUpdate({
        set: {
          assetKind,
          bucketName: copied.bucketName,
          isCurrent: true,
          metadata: {
            expiresAt: sourceOutput.expiresAt ?? null,
            generatedBy: "soundkit",
            processingVersion: ENRICHMENT_PIPELINE_VERSION,
            sourceAssetId,
            stemsplitJobId,
          },
          mimeType: copied.mimeType,
          processingVersion: ENRICHMENT_PIPELINE_VERSION,
          purpose: "stem",
          sizeBytes: copied.sizeBytes,
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

const fetchAudioFileForOpenAi = async (sourceUrl: string) => {
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(`Vocal stem download failed: ${response.status}`);
    }

    const rawAudio = await response.blob(),
      audio =
        rawAudio.size > MAX_OPENAI_TRANSCRIPTION_FILE_BYTES
          ? rawAudio.slice(0, MAX_OPENAI_TRANSCRIPTION_FILE_BYTES)
          : rawAudio;

    return new File([audio], "vocals.mp3", {
      type: response.headers.get("content-type") ?? "audio/mpeg",
    });
  },
  transcribeAudioWithOpenAi = async (sourceUrl: string) => {
    const apiKey = getEnvValue("OPENAI_API_KEY");

    if (!apiKey) {
      return null;
    }

    const formData = new FormData();
    formData.set("file", await fetchAudioFileForOpenAi(sourceUrl));
    formData.set("model", "whisper-1");
    formData.set("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");
    formData.set(
      "prompt",
      "Transcribe song vocals as lyrics. Preserve line-friendly punctuation and avoid adding section labels that are not sung."
    );

    const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
      body: formData,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: "POST",
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn(
        `OpenAI transcription skipped/failed: ${response.status} ${message.slice(0, 160)}`
      );
      return null;
    }

    return response.json() as Promise<OpenAiVerboseTranscriptionResponse>;
  },
  transcribeVocals = async ({
    assetId,
    trackId,
  }: {
    assetId: string;
    trackId: string;
  }) => {
    try {
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

      const sourceUrl = await createSignedMediaSourceUrl({ assetId, trackId }),
        result = await transcribeAudioWithOpenAi(sourceUrl),
        text = result?.text?.trim() ?? "";

      if (!text) {
        return null;
      }

      const timedLines = buildTimedLyricLinesFromWords(result?.words ?? []),
        [lyrics] = await db
          .insert(trackLyrics)
          .values({
            id: crypto.randomUUID(),
            language: "en",
            metadata: {
              duration: result?.duration ?? null,
              language: result?.language ?? null,
              model: "whisper-1",
              provider: "openai",
              timestampGranularity: "word",
            },
            sourceAssetId: assetId,
            sourceType: "machine_transcription",
            status: "pending_review",
            text,
            timedLines: timedLines.length > 0 ? timedLines : null,
            trackId,
          })
          .returning();

      return lyrics ?? null;
    } catch (error) {
      console.warn("Vocal stem lyric transcription skipped", {
        error: error instanceof Error ? error.message : String(error),
        trackId,
      });
      return null;
    }
  },
  embeddingModelName = (): string =>
    getEnvValue("GOOGLE_EMBEDDING_MODEL")
      .replace(/^google\//u, "")
      .trim() || DEFAULT_EMBEDDING_MODEL;

export { embeddingModelName };

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

export const indexSearchEntity = async ({
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

export const saveStemSplitOutput = async ({
  assetId,
  job,
  output,
  trackId,
}: {
  assetId: string;
  job: StemSplitJobResponse;
  output: "instrumental" | "vocals";
  trackId: string;
}) => {
  const sourceOutput = job.outputs?.[output];
  if (!sourceOutput) {
    return null;
  }
  return saveStemAsset({
    assetKind: output === "vocals" ? "vocal_stem" : "instrumental",
    sourceAssetId: assetId,
    sourceOutput,
    stemsplitJobId: job.id,
    targetKey: `processed/tracks/${trackId}/${job.id}/${output}.mp3`,
    trackId,
  });
};

export const transcribeStemSplitVocals = async ({
  trackId,
  vocalsAssetId,
}: {
  trackId: string;
  vocalsAssetId: string | null;
}) => {
  if (!vocalsAssetId) {
    return null;
  }
  return transcribeVocals({ assetId: vocalsAssetId, trackId });
};

export const finalizeTrackEnrichment = async ({
  emailQueue,
  job,
  lyrics,
  trackId,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  job: StemSplitJobResponse;
  lyrics: null | { id: string; text: string };
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
  }

  await db
    .update(trackStemJobs)
    .set({
      completedAt: now,
      creditsCharged: job.creditsCharged,
      progress: 100,
      status: "completed",
      updatedAt: now,
    })
    .where(
      and(
        eq(trackStemJobs.trackId, trackId),
        eq(trackStemJobs.stemsplitJobId, job.id)
      )
    );
  await notifyTrackProcessingComplete({ emailQueue, trackId });
};

export const processCompletedStemSplitJob = async ({
  assetId,
  emailQueue,
  job,
  trackId,
}: {
  assetId: string;
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  job: StemSplitJobResponse;
  trackId: string;
}) => {
  const vocalsAsset = await saveStemSplitOutput({
    assetId,
    job,
    output: "vocals",
    trackId,
  });
  await saveStemSplitOutput({
    assetId,
    job,
    output: "instrumental",
    trackId,
  });
  const lyrics = await transcribeStemSplitVocals({
    trackId,
    vocalsAssetId: vocalsAsset?.id ?? null,
  });
  await finalizeTrackEnrichment({ emailQueue, job, lyrics, trackId });
};

export const processTrackAudio = async ({
  sourceAssetId,
  trackId,
}: TrackEnrichmentWorkflowPayload) => {
  const assetId = sourceAssetId;
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for track processing.");
  }

  const db = createDb(),
    [storedJob] = await db
      .select({ stemsplitJobId: trackStemJobs.stemsplitJobId })
      .from(trackStemJobs)
      .where(eq(trackStemJobs.inputAssetId, assetId))
      .limit(1);
  if (storedJob?.stemsplitJobId) {
    const existingJob = await getStemSplitJob(storedJob.stemsplitJobId);
    if (existingJob) {
      return existingJob;
    }
  }

  const sourceUrl = await createSignedMediaSourceUrl({
      assetId,
      trackId,
    }),
    submittedJob = await submitStemSplitJob({ sourceUrl });

  if (!submittedJob) {
    throw new Error("STEMSPLIT_API_KEY is required for track processing.");
  }

  await db
    .update(trackStemJobs)
    .set({
      creditsRequired: submittedJob.creditsRequired,
      progress: submittedJob.progress ?? 0,
      status: mapStemJobStatus(submittedJob.status),
      stemsplitJobId: submittedJob.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trackStemJobs.trackId, trackId),
        eq(trackStemJobs.inputAssetId, assetId)
      )
    );

  return submittedJob;
};

export const pollStemSplitJob = async ({
  stemsplitJobId,
  trackId,
}: {
  stemsplitJobId: string;
  trackId: string;
}) => {
  const job = await getStemSplitJob(stemsplitJobId);

  if (!job) {
    throw new Error("STEMSPLIT_API_KEY is required for track processing.");
  }

  const db = createDb();

  await db
    .update(trackStemJobs)
    .set({
      creditsCharged: job.creditsCharged,
      progress: job.progress ?? 0,
      status: mapStemJobStatus(job.status),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trackStemJobs.trackId, trackId),
        eq(trackStemJobs.stemsplitJobId, stemsplitJobId)
      )
    );

  return job;
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
