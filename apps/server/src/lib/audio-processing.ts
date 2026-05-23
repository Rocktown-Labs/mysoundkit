import { google } from "@ai-sdk/google";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  searchEmbeddings,
  trackAssets,
  trackLyrics,
  trackStemJobs,
  tracks,
  workflowJobs,
} from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { embed, generateText } from "ai";
import { and, eq, ne } from "drizzle-orm";

const STEMSPLIT_BASE_URL = "https://stemsplit.io/api/v1";
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

type StemSplitJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface StemSplitOutput {
  expiresAt?: string;
  url?: string;
}

interface StemSplitJobResponse {
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

export interface TrackProcessingWorkflowPayload {
  assetId: string;
  objectKey: string;
  trackId: string;
}

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const getMediaBucket = () =>
  (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET ?? null;

const getMediaPublicUrl = () =>
  getEnvValue("MEDIA_PUBLIC_URL") || getEnvValue("VITE_MEDIA_URL");

const getObjectPublicUrl = (objectKey: string) => {
  const mediaPublicUrl = getMediaPublicUrl();

  if (!mediaPublicUrl) {
    return null;
  }

  return `${mediaPublicUrl.replace(/\/+$/, "")}/${objectKey}`;
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const stemsplitFetch = async <T>(path: string, init?: RequestInit) => {
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
};

const mapStemJobStatus = (status: StemSplitJobStatus) => {
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

  if (!response.ok || !response.body) {
    throw new Error(`Stem output download failed: ${response.status}`);
  }

  await bucket.put(targetKey, response.body, {
    httpMetadata: {
      contentType: response.headers.get("content-type") ?? "audio/mpeg",
    },
  });

  return {
    bucketName: getEnvValue("UPLOAD_BUCKET_NAME") || "soundkit-media",
    mimeType: response.headers.get("content-type") ?? "audio/mpeg",
    objectKey: targetKey,
    sizeBytes: Number(response.headers.get("content-length")) || null,
  };
};

const saveStemAsset = async ({
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
  });
  const db = createDb();
  const [asset] = await db
    .insert(trackAssets)
    .values({
      assetKind,
      bucketName: copied.bucketName,
      id: crypto.randomUUID(),
      metadata: {
        expiresAt: sourceOutput.expiresAt ?? null,
        sourceAssetId,
        stemsplitJobId,
      },
      mimeType: copied.mimeType,
      objectKey: copied.objectKey,
      sizeBytes: copied.sizeBytes,
      status: "ready",
      storageProvider: "r2",
      trackId,
    })
    .returning();

  return asset ?? null;
};

const transcribeVocals = async ({
  objectKey,
  trackId,
}: {
  objectKey: string;
  trackId: string;
}) => {
  const sourceUrl = getObjectPublicUrl(objectKey);

  if (!sourceUrl || !getEnvValue("GOOGLE_GENERATIVE_AI_API_KEY")) {
    return null;
  }

  const result = await generateText({
    messages: [
      {
        content: [
          {
            text: "Transcribe these vocals into clean song lyrics. Return only the lyrics text.",
            type: "text",
          },
          {
            data: new URL(sourceUrl),
            mediaType: "audio/mpeg",
            type: "file",
          },
        ],
        role: "user",
      },
    ],
    model: google("gemini-3-flash"),
  });
  const text = result.text.trim();

  if (!text) {
    return null;
  }

  const db = createDb();
  const [lyrics] = await db
    .insert(trackLyrics)
    .values({
      id: crypto.randomUUID(),
      language: "en",
      metadata: {
        model: "gemini-3-flash",
      },
      sourceType: "machine_transcription",
      status: "pending_review",
      text,
      trackId,
    })
    .returning();

  return lyrics ?? null;
};

const embeddingModelName = () =>
  getEnvValue("GOOGLE_EMBEDDING_MODEL")
    .replace(/^google\//, "")
    .trim() || DEFAULT_EMBEDDING_MODEL;

const saveEmbedding = async ({
  entityId,
  entityType,
  organizationId,
  text,
}: {
  entityId: string;
  entityType: "lyrics" | "track";
  organizationId: null | string;
  text: string;
}) => {
  if (!text.trim() || !getEnvValue("GOOGLE_GENERATIVE_AI_API_KEY")) {
    return;
  }

  const model = embeddingModelName();
  const result = await embed({
    model: google.embedding(model),
    value: text,
  });
  const embedding: number[] =
    result.embedding.length >= DEFAULT_EMBEDDING_DIMENSIONS
      ? result.embedding.slice(0, DEFAULT_EMBEDDING_DIMENSIONS)
      : [
          ...result.embedding,
          ...Array.from(
            {
              length: DEFAULT_EMBEDDING_DIMENSIONS - result.embedding.length,
            },
            () => 0
          ),
        ];
  const textHash = await sha256(text);
  const db = createDb();

  await db
    .insert(searchEmbeddings)
    .values({
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      embedding,
      entityId,
      entityType,
      id: crypto.randomUUID(),
      model,
      organizationId,
      textHash,
      textSnapshot: text,
    })
    .onConflictDoUpdate({
      set: {
        embedding,
        indexedAt: new Date(),
        textHash,
        textSnapshot: text,
      },
      target: [
        searchEmbeddings.entityType,
        searchEmbeddings.entityId,
        searchEmbeddings.model,
      ],
    });
};

export const processCompletedStemSplitJob = async ({
  assetId,
  job,
  trackId,
}: {
  assetId: string;
  job: StemSplitJobResponse;
  trackId: string;
}) => {
  const db = createDb();
  const now = new Date();
  const targetPrefix = `processed/tracks/${trackId}/${job.id}`;
  const vocalsAsset = job.outputs?.vocals
    ? await saveStemAsset({
        assetKind: "vocal_stem",
        sourceAssetId: assetId,
        sourceOutput: job.outputs.vocals,
        stemsplitJobId: job.id,
        targetKey: `${targetPrefix}/vocals.mp3`,
        trackId,
      })
    : null;

  if (job.outputs?.instrumental) {
    await saveStemAsset({
      assetKind: "instrumental",
      sourceAssetId: assetId,
      sourceOutput: job.outputs.instrumental,
      stemsplitJobId: job.id,
      targetKey: `${targetPrefix}/instrumental.mp3`,
      trackId,
    });
  }

  await db
    .update(tracks)
    .set({
      bpm: job.audioMetadata?.bpm
        ? Math.round(job.audioMetadata.bpm)
        : undefined,
      musicalKey: job.audioMetadata?.key,
      updatedAt: now,
    })
    .where(eq(tracks.id, trackId));

  await db
    .update(trackAssets)
    .set({
      status: "ready",
      updatedAt: now,
    })
    .where(eq(trackAssets.id, assetId));

  const lyrics = vocalsAsset?.objectKey
    ? await transcribeVocals({
        objectKey: vocalsAsset.objectKey,
        trackId,
      })
    : null;

  await db
    .update(tracks)
    .set({
      lyricsStatus: lyrics ? "pending_review" : "failed",
      updatedAt: now,
    })
    .where(and(eq(tracks.id, trackId), ne(tracks.lyricsStatus, "approved")));
  const [track] = await db
    .select()
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (track) {
    const trackSearchText = [
      track.title,
      track.description,
      track.musicalKey,
      track.bpm ? `BPM ${track.bpm}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await saveEmbedding({
      entityId: track.id,
      entityType: "track",
      organizationId: track.organizationId,
      text: trackSearchText,
    });

    if (lyrics) {
      await saveEmbedding({
        entityId: lyrics.id,
        entityType: "lyrics",
        organizationId: track.organizationId,
        text: lyrics.text,
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
};

export const processTrackAudio = async ({
  assetId,
  objectKey,
  trackId,
}: TrackProcessingWorkflowPayload) => {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for track processing.");
  }

  const db = createDb();
  const sourceUrl = getObjectPublicUrl(objectKey);

  if (!sourceUrl) {
    throw new Error("MEDIA_PUBLIC_URL is required for StemSplit source URLs.");
  }

  const submittedJob = await submitStemSplitJob({ sourceUrl });

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

export const pollAndFinalizeStemSplitJob = async ({
  assetId,
  stemsplitJobId,
  trackId,
}: {
  assetId: string;
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

  if (job.status === "COMPLETED") {
    await processCompletedStemSplitJob({
      assetId,
      job,
      trackId,
    });
  }

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

  const db = createDb();
  const [job] = await db
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
