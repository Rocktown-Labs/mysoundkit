/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sql } from "drizzle-orm";

export interface CommunitySchemaCapabilities {
  bans: boolean;
  discovery: boolean;
}

const unavailableCapabilities: CommunitySchemaCapabilities = {
  bans: false,
  discovery: false,
};

export const loadCommunitySchemaCapabilities = async () => {
  if (!isDatabaseConfigured()) {
    return unavailableCapabilities;
  }

  const [capabilities] = await createDb()
    .select({
      bans: sql<boolean>`to_regclass('public.community_bans') is not null`,
      discovery: sql<boolean>`
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'communities'
            and column_name = 'cover_image_url'
        )
        and exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'communities'
            and column_name = 'genre_id'
        )
      `,
    })
    .from(sql`(select 1) as community_schema_probe`);

  return capabilities ?? unavailableCapabilities;
};
