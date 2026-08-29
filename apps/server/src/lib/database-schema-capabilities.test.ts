import { describe, expect, it, vi } from "vitest";

import {
  getDatabaseSchemaCapabilities,
  type SoundKitDatabase,
} from "./database-schema-capabilities";

const databaseWithRows = (rows: unknown[]) =>
  ({
    execute: vi.fn().mockResolvedValue({ rows }),
  }) as unknown as SoundKitDatabase;

describe("database schema capabilities", () => {
  it("detects a pre-collaboration, pre-versioning schema", async () => {
    const db = databaseWithRows([
      { kind: "enum", name: "project_asset_kind", value: "attachment" },
      { kind: "enum", name: "project_asset_kind", value: "cover_art" },
    ]);

    await expect(getDatabaseSchemaCapabilities(db)).resolves.toEqual({
      collaborationProposals: false,
      projectAssetKinds: { beat: false, concept: false },
      projectAssetVersioning: false,
    });
  });

  it("detects the expanded project collaboration schema", async () => {
    const db = databaseWithRows([
      {
        kind: "column",
        name: "collaboration_proposals",
        value: "id",
      },
      { kind: "column", name: "project_assets", value: "is_current" },
      { kind: "column", name: "project_assets", value: "version" },
      { kind: "enum", name: "project_asset_kind", value: "beat" },
      { kind: "enum", name: "project_asset_kind", value: "concept" },
    ]);

    await expect(getDatabaseSchemaCapabilities(db)).resolves.toEqual({
      collaborationProposals: true,
      projectAssetKinds: { beat: true, concept: true },
      projectAssetVersioning: true,
    });
  });
});
