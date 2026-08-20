import type { SignupAccountType } from "./onboarding-flow";

export const PREMIUM_INCLUDED_SEATS = 5;

export const fallbackBillingPlans = [
  {
    annualPriceCents: 0,
    audience: "artist" as const,
    code: "artist_free",
    entitlements: {},
    maxSeats: 1,
    monthlyPriceCents: 0,
    name: "SoundKit Free Artist",
  },
  {
    annualPriceCents: 22_899,
    audience: "artist" as const,
    code: "soundkit_premium_artist",
    entitlements: {},
    maxSeats: PREMIUM_INCLUDED_SEATS,
    monthlyPriceCents: 2299,
    name: "SoundKit Premium Artist",
  },
  {
    annualPriceCents: 0,
    audience: "fan" as const,
    code: "fan_free",
    entitlements: {},
    maxSeats: 1,
    monthlyPriceCents: 0,
    name: "SoundKit Free Fan",
  },
  {
    annualPriceCents: 22_899,
    audience: "fan" as const,
    code: "soundkit_premium_fan",
    entitlements: {},
    maxSeats: PREMIUM_INCLUDED_SEATS,
    monthlyPriceCents: 2299,
    name: "SoundKit Premium Fan",
  },
] as const;

export const premiumPlanCodeForAccount = (
  accountType: SignupAccountType | null | undefined
) =>
  accountType === "artist" ? "soundkit_premium_artist" : "soundkit_premium_fan";

export const accountHomePathForAccount = (
  accountType: SignupAccountType | null | undefined
): "/" | "/dashboard" => (accountType === "artist" ? "/dashboard" : "/");

export const premiumSuccessPathForAccount = (
  accountType: SignupAccountType | null | undefined
): "/" | "/dashboard" =>
  accountType === "artist" ? "/dashboard" : "/";
