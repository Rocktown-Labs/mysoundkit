/* eslint-disable one-var */

import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sql } from "drizzle-orm";

export interface VideoSchemaCapabilities {
  viewSessions: boolean;
}

const CAPABILITY_CACHE_TTL_MS = 60_000,
  unavailableCapabilities: VideoSchemaCapabilities = {
    viewSessions: false,
  };
let cachedAt = 0,
  cachedCapabilities: VideoSchemaCapabilities | null = null;

export const loadVideoSchemaCapabilities =
  async (): Promise<VideoSchemaCapabilities> => {
    if (!isDatabaseConfigured()) {
      return unavailableCapabilities;
    }

    if (cachedCapabilities && Date.now() - cachedAt < CAPABILITY_CACHE_TTL_MS) {
      return cachedCapabilities;
    }

    const [capabilities] = await createDb()
      .select({
        viewSessions: sql<boolean>`to_regclass('public.video_view_sessions') is not null`,
      })
      .from(sql`(select 1) as video_schema_probe`);

    cachedCapabilities = capabilities ?? unavailableCapabilities;
    cachedAt = Date.now();
    return cachedCapabilities;
  };
