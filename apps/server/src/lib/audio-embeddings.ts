/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { google } from "@ai-sdk/google";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { searchEmbeddings, trackAssets, tracks } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { embed } from "ai";
import { and, asc, eq, sql } from "drizzle-orm";

import {
  embeddingModelName,
  normalizeEmbeddingVector,
} from "@/lib/audio-processing";
import { resolveTrackAssetFromRows } from "@/lib/track-asset-resolver";

export const AUDIO_EMBEDDING_MODEL_SUFFIX = ":audio",
  AUDIO_SPIKE_MAX_TRACKS = 5,
  AUDIO_SPIKE_MAX_PROBES = 3,
  AUDIO_SPIKE_MAX_BYTES = 8 * 1024 * 1024,
  AUDIO_FUSION_DEFAULT_WEIGHT = 0.3;

const getEnvValue = (key: string): string =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

export const audioEmbeddingModel = (): string =>
  getEnvValue("GOOGLE_AUDIO_EMBEDDING_MODEL") || "gemini-embedding-002";

export const audioVectorModel = (): string =>
  `${audioEmbeddingModel()}${AUDIO_EMBEDDING_MODEL_SUFFIX}`;

export const audioEmbeddingsEnabled = (): boolean =>
  getEnvValue("AUDIO_EMBEDDINGS_ENABLED").toLowerCase() === "true";

/** Cosine similarity in [-1, 1]. Pure — worker-tested. */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0,
    normA = 0,
    normB = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const x = a[index] ?? 0,
      y = b[index] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

interface GeminiEmbedResponse {
  embedding?: { values?: number[] };
}

/**
 * Multimodal embed of raw audio bytes via the Gemini API directly (the
 * AI SDK's embed() is text-only). Throws with the API's message on
 * failure so a wrong model id surfaces immediately in the spike report.
 */
export const embedAudioContent = async ({
  apiKey,
  audioBytes,
  mimeType,
  model,
}: {
  apiKey: string;
  audioBytes: ArrayBuffer;
  mimeType: string;
  model?: string;
}): Promise<number[]> => {
  const modelId = model ?? audioEmbeddingModel(),
    bytes = new Uint8Array(audioBytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      body: JSON.stringify({
        content: {
          parts: [
            {
              inlineData: {
                data: btoa(binary),
                mimeType,
              },
            },
            { text: "Describe the musical character of this audio." },
          ],
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Audio embedding failed: ${response.status} ${detail.slice(0, 300)}`
    );
  }
  const payload = (await response.json()) as GeminiEmbedResponse,
    values = payload.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Audio embedding returned no vector.");
  }
  return normalizeEmbeddingVector(values);
};

export const indexTrackAudio = async ({
  audioBytes,
  mimeType,
  organizationId,
  trackId,
}: {
  audioBytes: ArrayBuffer;
  mimeType: string;
  organizationId: string | null;
  trackId: string;
}): Promise<{ status: string }> => {
  const apiKey = getEnvValue("GOOGLE_GENERATIVE_AI_API_KEY");
  if (!apiKey) {
    return { status: "skipped" };
  }
  const db = createDb(),
    model = audioVectorModel(),
    audioHash = await sha256Bytes(audioBytes),
    [existing] = await db
      .select({ textHash: searchEmbeddings.textHash })
      .from(searchEmbeddings)
      .where(
        and(
          eq(searchEmbeddings.entityType, "track"),
          eq(searchEmbeddings.entityId, trackId),
          eq(searchEmbeddings.model, model)
        )
      )
      .limit(1);
  if (existing && existing.textHash === audioHash) {
    return { status: "skipped" };
  }
  const embedding = await embedAudioContent({ apiKey, audioBytes, mimeType });
  await db
    .insert(searchEmbeddings)
    .values({
      dimensions: embedding.length,
      embedding,
      entityId: trackId,
      entityType: "track",
      id: crypto.randomUUID(),
      metadata: { kind: "audio", modality: "audio", trackId },
      model,
      organizationId,
      textHash: audioHash,
      textSnapshot: `audio:${trackId}`,
    })
    .onConflictDoUpdate({
      set: { embedding, indexedAt: new Date(), textHash: audioHash },
      target: [
        searchEmbeddings.entityType,
        searchEmbeddings.entityId,
        searchEmbeddings.model,
      ],
    });
  return { status: "inserted" };
};

const sha256Bytes = async (data: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export interface AudioSpikeProbeResult {
  query: string;
  topTracks: { similarity: number; title: string; trackId: string }[];
}

export interface AudioSpikeResult {
  model: string;
  probes: AudioSpikeProbeResult[];
  skipped: { reason: string; trackId: string; title: string }[];
  tested: { bytes: number; title: string; trackId: string }[];
}

/**
 * Spike harness: embed up to N tracks' streaming audio, rank them per
 * probe query, report. The operator judges whether text→audio retrieval
 * is real before any pipeline is built on it.
 */
export const runAudioSpike = async ({
  bucket,
  probeQueries,
  trackIds,
}: {
  bucket: R2Bucket;
  probeQueries: string[];
  trackIds: string[];
}): Promise<AudioSpikeResult> => {
  const apiKey = getEnvValue("GOOGLE_GENERATIVE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured.");
  }
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured.");
  }
  const db = createDb(),
    model = audioEmbeddingModel(),
    probes = probeQueries
      .map((query) => query.trim())
      .filter(Boolean)
      .slice(0, AUDIO_SPIKE_MAX_PROBES),
    ids = [...new Set(trackIds)].slice(0, AUDIO_SPIKE_MAX_TRACKS);
  if (probes.length === 0 || ids.length === 0) {
    throw new Error("Provide at least one track and one probe query.");
  }
  // Probes embed with the TEXT model: the whole bet is that text and
  // audio share one space.
  const probeVectors: { query: string; vector: number[] }[] = [];
  for (const query of probes) {
    const result = await embed({
      model: google.embedding(embeddingModelName()),
      value: query,
    });
    probeVectors.push({
      query,
      vector: normalizeEmbeddingVector(result.embedding),
    });
  }
  const tested: AudioSpikeResult["tested"] = [],
    skipped: AudioSpikeResult["skipped"] = [],
    audioVectors = new Map<string, number[]>();
  for (const trackId of ids) {
    const [track] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);
    if (!track) {
      skipped.push({ reason: "Track not found.", title: trackId, trackId });
      continue;
    }
    const assets = await db
        .select()
        .from(trackAssets)
        .where(eq(trackAssets.trackId, trackId)),
      streaming = resolveTrackAssetFromRows({
        allowLegacyFallback: false,
        assets: assets.filter((asset) => asset.isCurrent),
        purpose: "streaming",
        trackId,
      });
    if (!streaming?.objectKey) {
      skipped.push({
        reason: "No streaming derivative yet.",
        title: track.title,
        trackId,
      });
      continue;
    }
    const object = await bucket.get(streaming.objectKey);
    if (!object) {
      skipped.push({
        reason: "Derivative missing from storage.",
        title: track.title,
        trackId,
      });
      continue;
    }
    const bytes = await object.arrayBuffer();
    if (bytes.byteLength > AUDIO_SPIKE_MAX_BYTES) {
      skipped.push({
        reason: `Derivative exceeds the ${(AUDIO_SPIKE_MAX_BYTES / 1_048_576).toFixed(0)} MB spike cap.`,
        title: track.title,
        trackId,
      });
      continue;
    }
    const vector = await embedAudioContent({
      apiKey,
      audioBytes: bytes,
      mimeType: "audio/mp4",
    });
    audioVectors.set(trackId, vector);
    tested.push({ bytes: bytes.byteLength, title: track.title, trackId });
  }
  const probeResults: AudioSpikeProbeResult[] = probeVectors.map(
    ({ query, vector }) => ({
      query,
      topTracks: [...audioVectors.entries()]
        .map(([trackId, audio]) => ({
          similarity: cosineSimilarity(vector, audio),
          title:
            tested.find((entry) => entry.trackId === trackId)?.title ?? trackId,
          trackId,
        }))
        .toSorted((a, b) => b.similarity - a.similarity)
        .slice(0, 3),
    })
  );
  return { model, probes: probeResults, skipped, tested };
};

export interface RankedAudioHit {
  distance: number;
  entityId: string;
}

/**
 * Nearest-neighbor scan restricted to stored audio vectors. Mirrors the
 * text path so fusion compares like with like.
 */
export const searchAudioEntities = async ({
  limit = 12,
  text,
}: {
  limit?: number;
  text: string;
}): Promise<RankedAudioHit[]> => {
  if (
    !isDatabaseConfigured() ||
    !text.trim() ||
    !getEnvValue("GOOGLE_GENERATIVE_AI_API_KEY")
  ) {
    return [];
  }
  const result = await embed({
      model: google.embedding(embeddingModelName()),
      value: text,
    }),
    vector = `[${normalizeEmbeddingVector(result.embedding).join(",")}]`,
    cappedLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await createDb()
    .select({
      distance: sql<number>`${searchEmbeddings.embedding} <=> ${vector}::vector`,
      entityId: searchEmbeddings.entityId,
    })
    .from(searchEmbeddings)
    .where(
      and(
        eq(searchEmbeddings.entityType, "track"),
        eq(searchEmbeddings.model, audioVectorModel())
      )
    )
    .orderBy(asc(sql`${searchEmbeddings.embedding} <=> ${vector}::vector`))
    .limit(cappedLimit);
  return rows.map((row) => ({
    distance: Number(row.distance),
    entityId: row.entityId,
  }));
};

export interface FusedRank {
  audioScore: number | null;
  fusedScore: number;
  id: string;
  textScore: number | null;
}

/**
 * Weighted blend of text and audio evidence over the union of ids.
 * audioWeight 0 = text only; pure helper, worker-tested.
 */
export const fuseRankings = ({
  audio,
  audioWeight,
  text,
}: {
  audio: { id: string; similarity: number }[];
  audioWeight: number;
  text: { id: string; score: number }[];
}): FusedRank[] => {
  const weight = Math.max(0, Math.min(1, audioWeight)),
    textById = new Map(text.map((entry) => [entry.id, entry.score])),
    audioById = new Map(audio.map((entry) => [entry.id, entry.similarity])),
    ids = new Set([...textById.keys(), ...audioById.keys()]);
  return [...ids]
    .map((id) => {
      const textScore = textById.get(id) ?? null,
        audioSimilarity = audioById.get(id) ?? null,
        audioScore =
          audioSimilarity === null
            ? null
            : Math.max(0, Math.min(1, (audioSimilarity + 1) / 2)),
        fusedScore =
          (textScore ?? 0) * (1 - weight) + (audioScore ?? 0) * weight;
      return { audioScore, fusedScore, id, textScore };
    })
    .toSorted((a, b) => b.fusedScore - a.fusedScore);
};
