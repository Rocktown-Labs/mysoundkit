/* eslint-disable one-var, sort-vars */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const alchemyConfigPath = fileURLToPath(
    new URL("../../infra/alchemy.run.ts", import.meta.url)
  ),
  deployWorkflowPath = fileURLToPath(
    new URL("../../../.github/workflows/deploy.yml", import.meta.url)
  ),
  communityMigrationPath = fileURLToPath(
    new URL("migrations/0045_community_experience.sql", import.meta.url)
  ),
  communityRoutesPath = fileURLToPath(
    new URL("../../../apps/server/src/routes/communities.ts", import.meta.url)
  ),
  communitySchemaCapabilitiesPath = fileURLToPath(
    new URL(
      "../../../apps/server/src/lib/community-schema-capabilities.ts",
      import.meta.url
    )
  ),
  genreIndexMigrationPath = fileURLToPath(
    new URL("migrations/0044_genre_lookup_indexes.sql", import.meta.url)
  ),
  videoViewAnalyticsMigrationPath = fileURLToPath(
    new URL("migrations/0047_video_view_analytics.sql", import.meta.url)
  ),
  videoRoutesPath = fileURLToPath(
    new URL("../../../apps/server/src/routes/videos.ts", import.meta.url)
  ),
  videoSchemaCapabilitiesPath = fileURLToPath(
    new URL(
      "../../../apps/server/src/lib/video-schema-capabilities.ts",
      import.meta.url
    )
  ),
  uploadIntentMigrationPath = fileURLToPath(
    new URL("migrations/0043_upload_intents.sql", import.meta.url)
  ),
  workflowJob = (workflow: string, name: string, nextName: string) => {
    const startMarker = `  ${name}:\n`,
      endMarker = `  ${nextName}:\n`,
      start = workflow.indexOf(startMarker),
      end = workflow.indexOf(endMarker, start + startMarker.length);

    if (start === -1 || end === -1) {
      throw new Error(`Unable to find ${name} job in deploy workflow.`);
    }

    return workflow.slice(start, end);
  };

describe("deployment safety policy", () => {
  it("keeps schema synchronization out of pull-request previews", async () => {
    const workflow = await readFile(deployWorkflowPath, "utf-8"),
      previewJob = workflowJob(workflow, "preview", "preview-browser");

    expect(previewJob).not.toContain("drizzle-kit push");
    expect(previewJob).not.toContain("Apply preview database schema");
    expect(previewJob).toContain("environment: staging");
    expect(previewJob).toContain("--mode enforce --check-database");
    expect(previewJob).toContain("SOUNDKIT_ISOLATION_MODE: enforce");
    expect(previewJob).toContain(
      "SOUNDKIT_DATABASE_TARGET: rocktownlabs/soundkit/staging"
    );
    expect(previewJob).toContain(
      "SOUNDKIT_MEDIA_BUCKET_NAME: soundkit-media-staging"
    );
    expect(previewJob.indexOf("--mode enforce --check-database")).toBeLessThan(
      previewJob.indexOf("pnpm run deploy:stage")
    );
    expect(previewJob).toContain("node scripts/staging-smoke.mjs --stage pr-");
    expect(previewJob).not.toContain("--adopt");
    expect(previewJob).not.toContain("seed-v2-r2-secrets");
    for (const secret of [
      "STRIPE_SECRET_KEY",
      "MUX_TOKEN_SECRET",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "OPENAI_API_KEY",
      "CLOUDFLARE_ACCESS_KEY_ID",
      "BATTLE_BOT_SECRET",
    ]) {
      expect(previewJob).not.toContain(secret);
    }
  });

  it("keeps preview cleanup on the same isolated staging configuration", async () => {
    const workflow = await readFile(deployWorkflowPath, "utf-8"),
      cleanup = workflow.slice(workflow.indexOf("  cleanup:\n"));
    expect(cleanup).toContain("environment: staging");
    expect(cleanup).toContain("SOUNDKIT_ISOLATION_MODE: enforce");
    expect(cleanup).toContain(
      "SOUNDKIT_DATABASE_TARGET: rocktownlabs/soundkit/staging"
    );
    expect(cleanup).toContain(
      "SOUNDKIT_MEDIA_BUCKET_NAME: soundkit-media-staging"
    );
    expect(cleanup).not.toContain("STRIPE_SECRET_KEY");
    expect(cleanup).not.toContain("CLOUDFLARE_ACCESS_KEY_ID");
    expect(cleanup).toContain("pull-requests: read");
    expect(cleanup).not.toContain("pull-requests: write");
    expect(cleanup).toContain('gh pr view "$PR_NUMBER"');
    expect(cleanup).toContain("MERGED|CLOSED)");
    expect(
      cleanup.indexOf("Verify closed PR cleanup authorization")
    ).toBeLessThan(cleanup.indexOf("Destroy preview through Alchemy"));
    expect(cleanup).toContain(
      "always() && steps.eligibility.outcome == 'success'"
    );
  });

  it("checks the reviewed schema read-only before production deployment", async () => {
    const workflow = await readFile(deployWorkflowPath, "utf-8"),
      productionJob = workflowJob(workflow, "deploy", "preview"),
      schemaStep = productionJob.indexOf(
        "Check reviewed public schema baseline (read-only)"
      ),
      deployStep = productionJob.indexOf("Deploy through Alchemy");

    expect(schemaStep).toBeGreaterThan(-1);
    expect(deployStep).toBeGreaterThan(schemaStep);
    expect(productionJob).not.toContain("drizzle-kit push");
    expect(productionJob).not.toContain("create extension");
    expect(productionJob).toContain("node scripts/public-schema-contract.mjs");
    expect(
      productionJob.indexOf("Read-only post-deploy production checks")
    ).toBeGreaterThan(deployStep);
  });

  it("adds upload intents without changing existing production tables", async () => {
    const migration = await readFile(uploadIntentMigrationPath, "utf-8");

    expect(migration).toContain('CREATE TABLE "upload_intents"');
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)/iu);
    expect(migration).not.toMatch(/ALTER TABLE "(?!upload_intents")/u);
  });

  it("adds genre lookup indexes without destructive schema changes", async () => {
    const migration = await readFile(genreIndexMigrationPath, "utf-8");

    expect(migration).toContain('CREATE INDEX "tracks_genre_id_idx"');
    expect(migration).toContain('CREATE INDEX "videos_genre_id_idx"');
    expect(migration).not.toMatch(/(?:ALTER|DROP|DELETE|UPDATE)\s/iu);
  });

  it("keeps community previews compatible with the deployed schema", async () => {
    const migration = await readFile(communityMigrationPath, "utf-8"),
      routes = await readFile(communityRoutesPath, "utf-8"),
      capabilities = await readFile(communitySchemaCapabilitiesPath, "utf-8");

    expect(migration).toContain(
      'ALTER TABLE "communities" ADD COLUMN "cover_image_url" text'
    );
    expect(migration).toContain(
      'ALTER TABLE "communities" ADD COLUMN "genre_id" text'
    );
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)/iu);
    expect(capabilities).toContain("information_schema.columns");
    expect(capabilities).toContain("to_regclass('public.community_bans')");
    expect(routes).toContain("capabilities.discovery");
    expect(routes).toContain("coverImageUrl: null");
  });

  it("keeps video analytics previews compatible with the deployed schema", async () => {
    const migration = await readFile(videoViewAnalyticsMigrationPath, "utf-8"),
      routes = await readFile(videoRoutesPath, "utf-8"),
      capabilities = await readFile(videoSchemaCapabilitiesPath, "utf-8");

    expect(migration).toContain('CREATE TABLE "video_view_sessions"');
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)/iu);
    expect(capabilities).toContain("to_regclass('public.video_view_sessions')");
    expect(routes).toContain("capabilities.viewSessions");
  });

  it("keeps canonical production assets on the guarded media route", async () => {
    const alchemyConfig = await readFile(alchemyConfigPath, "utf-8");

    expect(alchemyConfig).toMatch(
      /MEDIA_URL = isProduction[\s\S]*?MEDIA_HOST\}\/media[\s\S]*?API_URL\}\/media/u
    );
  });
});
