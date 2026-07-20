#!/usr/bin/env node
/**
 * Seeds the demo WAV fixtures (apps/website/public/demo-audio) as real,
 * public tracks owned by an existing artist profile so they show up in
 * search, on the artist page, and in the player.
 *
 * Usage:
 *   node scripts/seed-demo-tracks.mjs [username] [--dry-run]
 *
 * DATABASE_URL is read from the environment, falling back to
 * apps/server/.env (the same file drizzle.config.ts uses).
 */

import crypto from "node:crypto";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const scriptDir = import.meta.dirname;
const repoRoot = path.resolve(scriptDir, "..", "..", "..");

dotenv.config({
  path: path.join(repoRoot, "apps", "server", ".env"),
  quiet: true,
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const username = (args.find((arg) => !arg.startsWith("--")) ?? "cgstewart")
  .trim()
  .toLowerCase();

const DEMO_AUDIO_DIR = path.join(
  repoRoot,
  "apps",
  "website",
  "public",
  "demo-audio"
);

// Mirrors apps/server/src/lib/sample-data.ts so the seeded rows line up with
// the sample catalog the app already references.
const DEMO_TRACKS = [
  {
    bpm: 96,
    description: "Seeded demo track for playback and stream qualification.",
    file: "fantasy26.wav",
    genre: "R&B/Soul",
    musicalKey: "C Major",
    slug: "fantasy-26",
    title: "Fantasy 26",
  },
  {
    bpm: 92,
    description: "Seeded demo track for playback and stream qualification.",
    file: "dumbledore.wav",
    genre: "R&B/Soul",
    musicalKey: "Am",
    slug: "midnight-vibes",
    title: "DUMBLEDORE",
  },
  {
    bpm: 128,
    description: "Seeded demo track for playback and stream qualification.",
    file: "long-way-26.wav",
    genre: "Electronic",
    musicalKey: "F#m",
    slug: "long-way-26",
    title: "Long Way 26",
  },
];

/** Reads the fmt + data chunks of a WAV file and returns its duration in ms. */
function readWavDurationMs(filePath) {
  const fd = openSync(filePath, "r");
  try {
    const riff = Buffer.alloc(12);
    if (readSync(fd, riff, 0, 12, 0) < 12) {
      throw new Error("file too small to be a WAV");
    }
    if (
      riff.toString("ascii", 0, 4) !== "RIFF" ||
      riff.toString("ascii", 8, 12) !== "WAVE"
    ) {
      throw new Error("not a RIFF/WAVE file");
    }

    let byteRate = null;
    let dataSize = null;
    let offset = 12;
    const chunkHeader = Buffer.alloc(8);

    while (byteRate === null || dataSize === null) {
      if (readSync(fd, chunkHeader, 0, 8, offset) < 8) {
        break;
      }
      const chunkId = chunkHeader.toString("ascii", 0, 4);
      const chunkSize = chunkHeader.readUInt32LE(4);
      if (chunkId === "fmt ") {
        const fmt = Buffer.alloc(16);
        readSync(fd, fmt, 0, 16, offset + 8);
        byteRate = fmt.readUInt32LE(8);
      } else if (chunkId === "data") {
        dataSize = chunkSize;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }

    if (!byteRate || dataSize === null) {
      throw new Error("missing fmt or data chunk");
    }
    return Math.round((dataSize / byteRate) * 1000);
  } finally {
    closeSync(fd);
  }
}

const resolveDemoAssets = () =>
  DEMO_TRACKS.map((demo) => {
    const filePath = path.join(DEMO_AUDIO_DIR, demo.file);
    return {
      ...demo,
      durationMs: readWavDurationMs(filePath),
      sizeBytes: statSync(filePath).size,
    };
  });

async function main() {
  const demoAssets = resolveDemoAssets();

  if (dryRun) {
    console.log(
      `[dry-run] Would seed ${demoAssets.length} tracks for @${username}:`
    );
    for (const asset of demoAssets) {
      console.log(
        `- ${asset.title} (${asset.slug}) | ${asset.file} | ${asset.sizeBytes} bytes | ${asset.durationMs} ms | playbackUrl=/demo-audio/${asset.file}`
      );
    }
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set. Add it to apps/server/.env or export it before running."
    );
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows: owners } = await client.query(
      "SELECT user_id AS id, username, display_name FROM user_profiles WHERE lower(username) = lower($1) LIMIT 1",
      [username]
    );
    const owner = owners[0];
    if (!owner) {
      console.error(`No user profile found with username "${username}".`);
      process.exit(1);
    }
    console.log(
      `Seeding demo tracks for ${owner.display_name ?? owner.username} (${owner.id})...`
    );

    for (const demo of demoAssets) {
      const { rows: existing } = await client.query(
        "SELECT id FROM tracks WHERE slug = $1 LIMIT 1",
        [demo.slug]
      );
      if (existing[0]) {
        console.log(
          `- Skipping "${demo.title}" (slug ${demo.slug} already exists: ${existing[0].id})`
        );
        continue;
      }

      const genreSlug = demo.genre.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
      const { rows: genreRows } = await client.query(
        "SELECT id FROM genres WHERE slug = $1 LIMIT 1",
        [genreSlug]
      );
      let genreId = genreRows[0]?.id;
      if (!genreId) {
        genreId = crypto.randomUUID();
        await client.query(
          "INSERT INTO genres (id, name, slug) VALUES ($1, $2, $3)",
          [genreId, demo.genre, genreSlug]
        );
      }

      const trackId = crypto.randomUUID();
      await client.query(
        `INSERT INTO tracks (
          id, title, slug, owner_user_id, genre_id, is_public, is_for_sale,
          production_status, catalog_item_type, purchase_mode, release_strategy,
          published_at, bpm, musical_key, description, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, true, false,
          'complete', 'single', 'digital_download', 'publish_when_ready',
          now(), $6, $7, $8, now(), now()
        )`,
        [
          trackId,
          demo.title,
          demo.slug,
          owner.id,
          genreId,
          demo.bpm,
          demo.musicalKey,
          demo.description,
        ]
      );

      await client.query(
        `INSERT INTO track_assets (
          id, track_id, asset_kind, status, storage_provider, object_key,
          metadata, mime_type, size_bytes, duration_ms, uploader_user_id,
          created_at, updated_at
        ) VALUES (
          $1, $2, 'master', 'ready', 'external', $3,
          $4::jsonb, 'audio/wav', $5, $6, $7,
          now(), now()
        )`,
        [
          crypto.randomUUID(),
          trackId,
          `demo-audio/${demo.file}`,
          JSON.stringify({
            originalFileName: demo.file,
            url: `/demo-audio/${demo.file}`,
          }),
          demo.sizeBytes,
          demo.durationMs,
          owner.id,
        ]
      );

      console.log(`- Seeded "${demo.title}" (${demo.slug}) -> ${trackId}`);
    }

    console.log("Done. Tracks are public and searchable.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
