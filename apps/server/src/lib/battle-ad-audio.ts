/* eslint-disable one-var, sort-vars */
import { buildBattlePromoCopy, hydrateBattleAdContext } from "@/lib/ad-serving";

const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech",
  TTS_MODEL = "tts-1",
  TTS_VOICE = "onyx",
  MAX_SPOT_CHARS = 400;

export interface BattleAudioSpot {
  battleId: string;
  cacheHit: boolean;
  copy: string;
  creativeUrl: string | null;
  objectKey: string;
}

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Uniform battle spot copy, capped for a ~30s read. Pure part is tested
 * via buildBattlePromoCopy; the cap keeps TTS inside the preroll slot.
 */
export const buildBattleSpotCopy = ({
  artistA,
  artistB,
  genre,
  status,
  timingLabel,
  title,
}: {
  artistA: string | null;
  artistB: string | null;
  genre: string | null;
  status: string;
  timingLabel: string;
  title: string;
}): string => {
  const copy = buildBattlePromoCopy({
    artistA,
    artistB,
    genre,
    status,
    timingLabel,
    title,
  });
  return copy.length > MAX_SPOT_CHARS
    ? `${copy.slice(0, MAX_SPOT_CHARS - 1).trimEnd()}…`
    : copy;
};

export const renderBattleAudioSpot = async ({
  battleId,
  bucket,
  copy,
  mediaBaseUrl,
  openaiKey,
}: {
  battleId: string;
  bucket: R2Bucket;
  copy: string;
  mediaBaseUrl: string;
  openaiKey: string;
}): Promise<BattleAudioSpot> => {
  const contentHash = (await sha256Hex(copy)).slice(0, 16),
    objectKey = `ads/battle-spots/${battleId}/${contentHash}.mp3`,
    existing = await bucket.head(objectKey);
  if (existing) {
    return {
      battleId,
      cacheHit: true,
      copy,
      creativeUrl: `${mediaBaseUrl}/${objectKey}`,
      objectKey,
    };
  }
  const response = await fetch(OPENAI_SPEECH_URL, {
    body: JSON.stringify({
      input: copy,
      model: TTS_MODEL,
      voice: TTS_VOICE,
    }),
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Battle spot TTS failed: ${response.status} ${(await response.text()).slice(0, 200)}`
    );
  }
  const audio = await response.arrayBuffer();
  if (audio.byteLength === 0) {
    throw new Error("Battle spot TTS returned empty audio.");
  }
  await bucket.put(objectKey, audio, {
    httpMetadata: { contentType: "audio/mpeg" },
  });
  return {
    battleId,
    cacheHit: false,
    copy,
    creativeUrl: `${mediaBaseUrl}/${objectKey}`,
    objectKey,
  };
};

export const battleSpotCopyFor = async (battleId: string) => {
  const context = await hydrateBattleAdContext(battleId);
  if (!context) {
    return null;
  }
  return {
    context,
    copy: buildBattleSpotCopy({
      artistA: context.artistA,
      artistB: context.artistB,
      genre: context.genre,
      status: context.status,
      timingLabel: context.timingLabel,
      title: context.title,
    }),
  };
};
