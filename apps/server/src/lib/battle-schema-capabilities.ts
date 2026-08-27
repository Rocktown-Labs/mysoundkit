/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sql } from "drizzle-orm";

export interface BattleSchemaCapabilities {
  battleOutcome: boolean;
  battleOutcomeReason: boolean;
  battleOutcomeUser: boolean;
  battleWinner: boolean;
}

const CAPABILITY_CACHE_TTL_MS = 60_000,
  hasBattleColumn = (columnName: string) => sql<boolean>`exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'battles'
      and column_name = ${columnName}
  )`,
  unavailableCapabilities: BattleSchemaCapabilities = {
    battleOutcome: false,
    battleOutcomeReason: false,
    battleOutcomeUser: false,
    battleWinner: false,
  };
let cachedAt = 0,
  cachedCapabilities: BattleSchemaCapabilities | null = null;

export const loadBattleSchemaCapabilities =
  async (): Promise<BattleSchemaCapabilities> => {
    if (!isDatabaseConfigured()) {
      return unavailableCapabilities;
    }

    if (cachedCapabilities && Date.now() - cachedAt < CAPABILITY_CACHE_TTL_MS) {
      return cachedCapabilities;
    }

    const [capabilities] = await createDb()
      .select({
        battleOutcome: hasBattleColumn("outcome"),
        battleOutcomeReason: hasBattleColumn("outcome_reason"),
        battleOutcomeUser: hasBattleColumn("outcome_user_id"),
        battleWinner: hasBattleColumn("winner_user_id"),
      })
      .from(sql`(select 1) as battle_schema_probe`);

    cachedCapabilities = capabilities ?? unavailableCapabilities;
    cachedAt = Date.now();
    return cachedCapabilities;
  };
