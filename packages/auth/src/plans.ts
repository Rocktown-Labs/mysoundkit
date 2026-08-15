import { env } from "@soundkit/env/server";

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
};

export const createStripePlans = () =>
  [
    {
      annualDiscountPriceId: getFirstEnvValue(
        "STRIPE_SOUNDKIT_PREMIUM_ARTIST_ANNUAL_PRICE_ID",
        "STRIPE_ARTIST_PREMIUM_ANNUAL_PRICE_ID"
      ),
      group: "artist",
      limits: { communities: 1, members: PREMIUM_INCLUDED_SEATS },
      name: "soundkit_premium_artist",
      priceId: getFirstEnvValue(
        "STRIPE_SOUNDKIT_PREMIUM_ARTIST_MONTHLY_PRICE_ID",
        "STRIPE_ARTIST_PREMIUM_MONTHLY_PRICE_ID"
      ),
    },
    {
      group: "artist",
      limits: { communities: 1, members: LEGACY_TEAM_PLAN_SEATS },
      name: "artist_team",
      priceId: getEnvValue("STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID"),
    },
    {
      annualDiscountPriceId: getFirstEnvValue(
        "STRIPE_SOUNDKIT_PREMIUM_FAN_ANNUAL_PRICE_ID",
        "STRIPE_LISTENER_PREMIUM_ANNUAL_PRICE_ID"
      ),
      group: "fan",
      limits: { familyMembers: PREMIUM_INCLUDED_SEATS },
      name: "soundkit_premium_fan",
      priceId: getFirstEnvValue(
        "STRIPE_SOUNDKIT_PREMIUM_FAN_MONTHLY_PRICE_ID",
        "STRIPE_LISTENER_PREMIUM_MONTHLY_PRICE_ID"
      ),
    },
    {
      group: "fan",
      limits: { familyMembers: LEGACY_TEAM_PLAN_SEATS },
      name: "fan_family",
      priceId: getEnvValue("STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID"),
    },
  ].filter((plan) => plan.priceId);
