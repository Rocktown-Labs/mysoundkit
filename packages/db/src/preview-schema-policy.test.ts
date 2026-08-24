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
    expect(previewJob).toContain("Confirm shared database safety policy");
  });

  it("keeps production schema application before deployment", async () => {
    const workflow = await readFile(deployWorkflowPath, "utf-8"),
      productionJob = workflowJob(workflow, "deploy", "preview"),
      schemaStep = productionJob.indexOf("Apply production database schema"),
      deployStep = productionJob.indexOf("Deploy through Alchemy");

    expect(schemaStep).toBeGreaterThan(-1);
    expect(deployStep).toBeGreaterThan(schemaStep);
  });

  it("adds upload intents without changing existing production tables", async () => {
    const migration = await readFile(uploadIntentMigrationPath, "utf-8");

    expect(migration).toContain('CREATE TABLE "upload_intents"');
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)/iu);
    expect(migration).not.toMatch(/ALTER TABLE "(?!upload_intents")/u);
  });

  it("keeps canonical production assets on the guarded media route", async () => {
    const alchemyConfig = await readFile(alchemyConfigPath, "utf-8");

    expect(alchemyConfig).toMatch(
      /MEDIA_URL = isProduction[\s\S]*?MEDIA_HOST\}\/media[\s\S]*?API_URL\}\/media/u
    );
  });
});
