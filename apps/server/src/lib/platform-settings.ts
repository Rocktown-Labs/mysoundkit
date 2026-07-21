import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { platformSettings } from "@soundkit/db/schema/app";
import { eq } from "drizzle-orm";

import { platformSettingsSchema } from "@/lib/schemas";

export const platformDiscoverySettingsKey = "discovery";

export const defaultPlatformSettings = {
  defaultExploreRegion: "us-arkansas",
  defaultExploreRegionType: "north-america",
  useGlobalExploreHome: true,
} as const;

const parsePlatformSettings = (value: unknown) =>
  platformSettingsSchema.parse({
    ...defaultPlatformSettings,
    ...(typeof value === "object" && value !== null ? value : {}),
  });

export const loadPlatformSettings = async () => {
  if (!isDatabaseConfigured()) {
    return defaultPlatformSettings;
  }

  const [row] = await createDb()
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, platformDiscoverySettingsKey))
    .limit(1);

  return parsePlatformSettings(row?.value);
};
