import type { SignupAccountType } from "./onboarding-flow";

export const PREMIUM_INCLUDED_SEATS = 3;

export const premiumPlanCodeForAccount = (
  accountType: SignupAccountType | null | undefined
) =>
  accountType === "artist" ? "soundkit_premium_artist" : "soundkit_premium_fan";

export const accountHomePathForAccount = (
  accountType: SignupAccountType | null | undefined
): "/" | "/dashboard" => (accountType === "artist" ? "/dashboard" : "/");

export const premiumSuccessPathForAccount = (
  accountType: SignupAccountType | null | undefined
): "/" | "/dashboard/career/payments" =>
  accountType === "artist" ? "/dashboard/career/payments" : "/";
