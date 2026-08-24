export type SignupAccountType = "artist" | "fan";
export type ArtistRole = "musician" | "producer";
export interface ArtistOnboardingDraft {
  avatarObjectKey: string;
  avatarUrl: string;
  city: string;
  country: string;
  locationQuery: string;
  primaryGenre: string;
  roles: ArtistRole[];
  selectedPlanCode: string;
  stateValue: string;
  step: number;
  username: string;
}
export interface SignupRedirectUser {
  accountType?: SignupAccountType | null;
  onboardingCompletedAt?: string | null;
}

export const ARTIST_ONBOARDING_DRAFT_KEY = "soundkit.artistOnboardingDraft.v1";
export const FAN_ONBOARDING_DRAFT_KEY = "soundkit.fanOnboardingDraft.v1";

export const onboardingRouteForAccount = (accountType: SignupAccountType) =>
  accountType === "artist"
    ? "/signup/artist/onboarding"
    : "/signup/fan/onboarding";

export const credentialsRouteForAccount = (accountType: SignupAccountType) =>
  accountType === "artist"
    ? "/signup/artist/credentials"
    : "/signup/fan/credentials";

export const completedSignupRouteForAccount = (
  accountType: SignupAccountType
) => (accountType === "artist" ? "/dashboard" : "/library/settings");

export const signupRedirectForUser = ({
  accountType,
  user,
}: {
  accountType: SignupAccountType;
  user: SignupRedirectUser;
}) => {
  if (user.onboardingCompletedAt) {
    return completedSignupRouteForAccount(user.accountType ?? accountType);
  }

  return onboardingRouteForAccount(accountType);
};

const isArtistRole = (value: unknown): value is ArtistRole =>
    value === "musician" || value === "producer",
  clampStep = (value: unknown) => {
    if (typeof value !== "number") {
      return 1;
    }

    return Math.min(Math.max(Math.trunc(value), 1), 8);
  };

export const parseArtistOnboardingDraft = (
  value: string | null
): ArtistOnboardingDraft | null => {
  if (!value) {
    return null;
  }

  let parsed: Partial<ArtistOnboardingDraft>;
  try {
    parsed = JSON.parse(value) as Partial<ArtistOnboardingDraft>;
  } catch {
    return null;
  }

  const roles = Array.isArray(parsed.roles)
    ? parsed.roles.filter(isArtistRole)
    : [];

  return {
    avatarObjectKey:
      typeof parsed.avatarObjectKey === "string" ? parsed.avatarObjectKey : "",
    avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : "",
    city: typeof parsed.city === "string" ? parsed.city : "",
    country: typeof parsed.country === "string" ? parsed.country : "",
    locationQuery:
      typeof parsed.locationQuery === "string" ? parsed.locationQuery : "",
    primaryGenre:
      typeof parsed.primaryGenre === "string" ? parsed.primaryGenre : "",
    roles: roles.length > 0 ? roles : ["musician"],
    selectedPlanCode:
      parsed.selectedPlanCode === "artist_free" ||
      parsed.selectedPlanCode === "soundkit_premium_artist"
        ? parsed.selectedPlanCode
        : "soundkit_premium_artist",
    stateValue: typeof parsed.stateValue === "string" ? parsed.stateValue : "",
    step: clampStep(parsed.step),
    username: typeof parsed.username === "string" ? parsed.username : "",
  };
};
