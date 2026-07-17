import type { SignupAccountType } from "./onboarding-flow";

export const PREMIUM_INCLUDED_SEATS = 3;

export const premiumPlanCodeForAccount = (
  accountType: SignupAccountType | null | undefined
) =>
  accountType === "artist" ? "soundkit_premium_artist" : "soundkit_premium_fan";

export const accountHomePathForAccount = (
  accountType: SignupAccountType | null | undefined
): "/dashboard" | "/library/settings" =>
  accountType === "artist" ? "/dashboard" : "/library/settings";

export const premiumSuccessPathForAccount = (
  accountType: SignupAccountType | null | undefined
): "/dashboard" | "/library/settings" => accountHomePathForAccount(accountType);
