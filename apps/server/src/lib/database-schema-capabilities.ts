/* eslint-disable one-var, sort-vars */
import type { createDb } from "@soundkit/db";
import { sql } from "drizzle-orm";

export type SoundKitDatabase = ReturnType<typeof createDb>;

export interface DatabaseSchemaCapabilities {
  collaborationProposals: boolean;
  projectAssetKinds: {
    beat: boolean;
    concept: boolean;
  };
  projectAssetVersioning: boolean;
}

interface SchemaCapabilityRow {
  kind: string;
  name: string;
  value: string;
}

const assumeLegacySchema: DatabaseSchemaCapabilities = {
  collaborationProposals: false,
  projectAssetKinds: { beat: false, concept: false },
  projectAssetVersioning: false,
};

const capabilityCache = new WeakMap<
  object,
  Promise<DatabaseSchemaCapabilities>
>();

const loadDatabaseSchemaCapabilities = async (
  db: SoundKitDatabase
): Promise<DatabaseSchemaCapabilities> => {
  try {
    const result = await db.execute(sql`
      select
        'column'::text as kind,
        table_name::text as name,
        column_name::text as value
      from information_schema.columns
      where table_schema = 'public'
        and (
          table_name = 'collaboration_proposals'
          or (
            table_name = 'project_assets'
            and column_name in ('is_current', 'version')
          )
        )
      union all
      select
        'enum'::text as kind,
        type_name::text as name,
        enumlabel::text as value
      from (
        select
          t.typname as type_name,
          e.enumlabel,
          n.nspname
        from pg_type t
        inner join pg_enum e on e.enumtypid = t.oid
        inner join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'project_asset_kind'
          and n.nspname = 'public'
      ) as project_asset_enum
    `);
    const rows = result.rows as unknown as SchemaCapabilityRow[];
    const hasColumn = (tableName: string, columnName: string) =>
        rows.some(
          (row) =>
            row.kind === "column" &&
            row.name === tableName &&
            row.value === columnName
        ),
      hasEnumValue = (value: string) =>
        rows.some(
          (row) =>
            row.kind === "enum" &&
            row.name === "project_asset_kind" &&
            row.value === value
        );

    return {
      collaborationProposals: rows.some(
        (row) => row.kind === "column" && row.name === "collaboration_proposals"
      ),
      projectAssetKinds: {
        beat: hasEnumValue("beat"),
        concept: hasEnumValue("concept"),
      },
      projectAssetVersioning:
        hasColumn("project_assets", "is_current") &&
        hasColumn("project_assets", "version"),
    };
  } catch {
    // Metadata introspection must fail closed: previews can run against a
    // database that has not received the latest migrations yet.
    return assumeLegacySchema;
  }
};

export const getDatabaseSchemaCapabilities = (
  db: SoundKitDatabase
): Promise<DatabaseSchemaCapabilities> => {
  const cacheKey = db as object;
  const cached = capabilityCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const capabilitiesPromise = loadDatabaseSchemaCapabilities(db);
  capabilityCache.set(cacheKey, capabilitiesPromise);
  return capabilitiesPromise;
};
