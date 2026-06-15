export type SignupAccountType = "artist" | "fan";
export type ArtistRole = "musician" | "producer";
export interface ArtistOnboardingDraft {
  avatarObjectKey: string;
  avatarUrl: string;
  city: string;
  locationQuery: string;
  primaryGenre: string;
  roles: ArtistRole[];
  selectedPlanCode: string;
  stateValue: string;
  step: number;
  username: string;
}
export interface SignupRedirectUser {
  onboardingCompletedAt?: string | null;
}

export const ARTIST_ONBOARDING_DRAFT_KEY = "soundkit.artistOnboardingDraft.v1";

export const onboardingRouteForAccount = (accountType: SignupAccountType) =>
  accountType === "artist"
    ? "/signup/artist/onboarding"
    : "/signup/fan/onboarding";

export const credentialsRouteForAccount = (accountType: SignupAccountType) =>
  accountType === "artist"
    ? "/signup/artist/credentials"
    : "/signup/fan/credentials";

export const signupRedirectForUser = ({
  accountType,
  user,
}: {
  accountType: SignupAccountType;
  user: SignupRedirectUser;
}) => {
  if (user.onboardingCompletedAt) {
    return "/dashboard";
  }

  return onboardingRouteForAccount(accountType);
};

const isArtistRole = (value: unknown): value is ArtistRole =>
  value === "musician" || value === "producer";

const clampStep = (value: unknown) => {
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

  const parsed = JSON.parse(value) as Partial<ArtistOnboardingDraft>;
  const roles = Array.isArray(parsed.roles)
    ? parsed.roles.filter(isArtistRole)
    : [];

  return {
    avatarObjectKey:
      typeof parsed.avatarObjectKey === "string" ? parsed.avatarObjectKey : "",
    avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : "",
    city: typeof parsed.city === "string" ? parsed.city : "",
    locationQuery:
      typeof parsed.locationQuery === "string" ? parsed.locationQuery : "",
    primaryGenre:
      typeof parsed.primaryGenre === "string" ? parsed.primaryGenre : "",
    roles: roles.length > 0 ? roles : ["musician"],
    selectedPlanCode:
      typeof parsed.selectedPlanCode === "string"
        ? parsed.selectedPlanCode
        : "artist_premium",
    stateValue: typeof parsed.stateValue === "string" ? parsed.stateValue : "",
    step: clampStep(parsed.step),
    username: typeof parsed.username === "string" ? parsed.username : "",
  };
};
