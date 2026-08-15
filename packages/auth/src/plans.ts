import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { planCatalog } from "@soundkit/db/schema/plans";
import { env } from "@soundkit/env/server";
import { inArray } from "drizzle-orm";

import { LEGACY_TEAM_PLAN_SEATS, PREMIUM_INCLUDED_SEATS } from "./plan-limits";

const getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  getFirstEnvValue = (...keys: string[]) => {
    for (const key of keys) {
      const value = getEnvValue(key);

      if (value) {
        return value;
      }
    }

    return "";
  },
  // Sandbox IDs written by a dev-mode catalog sync are never valid checkout
  // prices, so they never satisfy the plan filter below.
  usablePriceId = (priceId: string | null | undefined) =>
    priceId && !priceId.startsWith("price_dev_") ? priceId : "",
  PREMIUM_PLAN_CODES = [
    "soundkit_premium_artist",
    "soundkit_premium_fan",
  ] as const,
  loadCatalogPriceIds = async (codes: readonly string[]) => {
    if (!isDatabaseConfigured()) {
      return [];
    }

    try {
      const db = createDb(),
        rows = await db
          .select({
            annual: planCatalog.stripeAnnualPriceId,
            code: planCatalog.code,
            monthly: planCatalog.stripeMonthlyPriceId,
          })
          .from(planCatalog)
          .where(inArray(planCatalog.code, [...codes]));

      return rows.map((row) => ({
        annual: usablePriceId(row.annual),
        code: row.code,
        monthly: usablePriceId(row.monthly),
      }));
    } catch {
      return [];
    }
  };

export const createStripePlans = async () => {
  const envPriceIds = {
      soundkit_premium_artist: {
        annual: getFirstEnvValue(
          "STRIPE_SOUNDKIT_PREMIUM_ARTIST_ANNUAL_PRICE_ID",
          "STRIPE_ARTIST_PREMIUM_ANNUAL_PRICE_ID"
        ),
        monthly: getFirstEnvValue(
          "STRIPE_SOUNDKIT_PREMIUM_ARTIST_MONTHLY_PRICE_ID",
          "STRIPE_ARTIST_PREMIUM_MONTHLY_PRICE_ID"
        ),
      },
      soundkit_premium_fan: {
        annual: getFirstEnvValue(
          "STRIPE_SOUNDKIT_PREMIUM_FAN_ANNUAL_PRICE_ID",
          "STRIPE_LISTENER_PREMIUM_ANNUAL_PRICE_ID"
        ),
        monthly: getFirstEnvValue(
          "STRIPE_SOUNDKIT_PREMIUM_FAN_MONTHLY_PRICE_ID",
          "STRIPE_LISTENER_PREMIUM_MONTHLY_PRICE_ID"
        ),
      },
    },
    envComplete = PREMIUM_PLAN_CODES.every(
      (code) =>
        Boolean(envPriceIds[code].monthly) && Boolean(envPriceIds[code].annual)
    ),
    catalogRows = envComplete
      ? []
      : await loadCatalogPriceIds(PREMIUM_PLAN_CODES),
    byCode = new Map(catalogRows.map((row) => [row.code, row])),
    premiumPlan = (code: (typeof PREMIUM_PLAN_CODES)[number]) => {
      const catalog = byCode.get(code),
        isArtist = code === "soundkit_premium_artist";

      return {
        annualDiscountPriceId:
          (envPriceIds[code].annual || catalog?.annual) ?? "",
        group: isArtist ? "artist" : "fan",
        limits: isArtist
          ? { communities: 1, members: PREMIUM_INCLUDED_SEATS }
          : { familyMembers: PREMIUM_INCLUDED_SEATS },
        name: code,
        priceId: (envPriceIds[code].monthly || catalog?.monthly) ?? "",
      };
    };

  return [
    premiumPlan("soundkit_premium_artist"),
    {
      group: "artist",
      limits: { communities: 1, members: LEGACY_TEAM_PLAN_SEATS },
      name: "artist_team",
      priceId: getEnvValue("STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID"),
    },
    premiumPlan("soundkit_premium_fan"),
    {
      group: "fan",
      limits: { familyMembers: LEGACY_TEAM_PLAN_SEATS },
      name: "fan_family",
      priceId: getEnvValue("STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID"),
    },
  ].filter((plan) => plan.priceId);
};
