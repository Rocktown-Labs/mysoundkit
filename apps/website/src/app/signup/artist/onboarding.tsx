import { usePostHog } from "@posthog/react";
import { env } from "@soundkit/env/web";
import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
/* eslint-disable complexity, no-use-before-define, react-perf/jsx-no-new-function-as-prop, react/no-unescaped-entities */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  User,
  MapPin,
  Users,
  Music2,
  LinkIcon,
  Share2,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import RadarClient from "radar-sdk-js";
import type { RadarAutocompleteAddress } from "radar-sdk-js";
import { useEffect, useRef, useState } from "react";

import { ArtistAvatarUpload } from "@/components/onboarding/artist-avatar-upload";
import { SoundKitBrand } from "@/components/soundkit-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_V1_URL } from "@/lib/api";
import {
  ARTIST_ONBOARDING_DRAFT_KEY,
  parseArtistOnboardingDraft,
} from "@/lib/onboarding-flow";
import type { ArtistOnboardingDraft, ArtistRole } from "@/lib/onboarding-flow";
import { requireSignupOnboardingUser } from "@/lib/soundkit.functions";

type UsernameStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "reserved"
  | "invalid"
  | "error";
type LocationStatus =
  | "idle"
  | "searching"
  | "ready"
  | "selected"
  | "manual_ready"
  | "empty"
  | "config_error"
  | "error";
interface LocationSuggestion {
  city: string;
  countryCode: string;
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  state: string;
  stateCode: string;
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/u;
const RESERVED_USERNAMES = new Set(["soundkit"]);
const ARTIST_PREMIUM_PLAN_DESCRIPTION =
  "Live hosting, selling, rewards, analytics, and up to 3 workspace seats";
const wizardText = {
  addAnother: "+ Add Another",
  appleMusicLabel: "Apple Music URL",
  artistTeamDescription: "Artist Premium workspace for up to 5 seats",
  artistTeamPrice: "$24.99/mo",
  artistTeamTitle: "Artist Team",
  avatarContinue: "Continue",
  avatarSkip: "Skip for Now",
  avatarSubtitle: "Optional. You can skip this and add one later.",
  avatarTitle: "Add a Profile Picture",
  back: "Back",
  complete: "Complete Setup",
  completing: "Completing...",
  continue: "Continue",
  freeDescription: "Basic features to get started",
  freePrice: "$0/mo",
  freeTitle: "Free Account",
  genreAfrobeats: "Afrobeats",
  genreElectronic: "Electronic",
  genreHipHop: "Hip-Hop",
  genreLabel: "Primary Genre",
  genrePlaceholder: "Select genre",
  genrePop: "Pop",
  genreRbSoul: "R&B/Soul",
  genreRock: "Rock",
  genreSpokenWord: "Spoken Word",
  genreSubtitle: "Help fans find your style",
  genreTitle: "What's Your Genre?",
  instagramLabel: "Instagram",
  locationConfigError:
    "Enter a city and state like Little Rock, AR. Add VITE_RADAR_PUBLISHABLE_KEY to enable Radar validation.",
  locationEmpty: "Choose a valid US city from the results.",
  locationError: "Location validation is unavailable right now.",
  locationIdle: "Start typing a city and state, then choose a verified result.",
  locationLabel: "City or state",
  locationPlaceholder: "Little Rock, AR",
  locationReady: "Choose a city from the results to continue.",
  locationSearching: "Searching verified places...",
  locationSubtitle: "Help fans discover local talent",
  locationSuggestionCountry: "United States",
  locationTitle: "Where Do You Make Music?",
  musicianDescription: "Release songs, albums, EPs, videos, and battle tracks.",
  musicianTitle: "Musician",
  planRecommended: "Recommended",
  planTitle: "Choose Your Plan",
  premiumPrice: "$22.99/mo",
  premiumTitle: "Premium",
  producerDescription:
    "Sell or stream beats, license instrumentals, and battle.",
  producerTitle: "Producer",
  publishingSubtitle:
    "Use your writer name and PRO details for credits and royalties.",
  publishingTitle: "Credits & Publishing",
  rolesSubtitle: "Choose one or both. The dashboard stays the same.",
  rolesTitle: "What Do You Create?",
  setupTitle: "Set Up Your Artist Profile",
  socialsSubtitle: "Link your social media (optional)",
  socialsTitle: "Connect Your Socials",
  spotifyLabel: "Spotify Artist URL",
  streamingSubtitle: "Link your streaming profiles (optional)",
  streamingTitle: "Connect Your Music",
  teamEmailLabel: "Team Member Email",
  teamSubtitle: "Collaborate with producers, managers, and more",
  teamTitle: "Invite Your Team",
  tiktokLabel: "TikTok",
  twitterLabel: "X (Twitter)",
  usernameGuidance: "Can only contain letters, numbers, and underscores",
  usernameLabel: "Username",
  usernamePlaceholder: "@yourartistname",
  usernameSubtitle: "This is how fans will find you",
  usernameTitle: "Choose Your Username",
  youtubeLabel: "YouTube Channel URL",
} as const;
const US_STATES_BY_NAME: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};
const US_STATE_CODES = new Set(Object.values(US_STATES_BY_NAME));
const normalizeUsername = (value: string) =>
  value.trim().replace(/^@/u, "").toLowerCase();
const parseManualLocation = (value: string) => {
  const [cityPart, statePart] = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!(cityPart && statePart)) {
    return null;
  }

  const normalizedState = statePart.toLowerCase();
  const stateCode =
    US_STATES_BY_NAME[normalizedState] ?? statePart.toUpperCase();

  if (!US_STATE_CODES.has(stateCode)) {
    return null;
  }

  return {
    city: cityPart,
    stateCode,
  };
};
const getAddressStateCode = (address: RadarAutocompleteAddress) => {
  const rawStateCode = address.stateCode?.toUpperCase();

  if (rawStateCode && US_STATE_CODES.has(rawStateCode)) {
    return rawStateCode;
  }

  const normalizedState = address.state?.toLowerCase();

  return normalizedState ? US_STATES_BY_NAME[normalizedState] : undefined;
};
const getAddressCity = (address: RadarAutocompleteAddress) =>
  address.city ?? address.placeLabel ?? address.addressLabel;
const locationLabel = (address: RadarAutocompleteAddress) => {
  const city = getAddressCity(address);
  const state = getAddressStateCode(address) ?? address.state;

  return [city, state].filter(Boolean).join(", ");
};
const toLocationSuggestion = (
  address: RadarAutocompleteAddress
): LocationSuggestion | null => {
  const city = getAddressCity(address);
  const stateCode = getAddressStateCode(address);
  const state = address.state ?? stateCode;
  const countryCode = address.countryCode?.toUpperCase();

  if (!(city && state && stateCode && countryCode === "US")) {
    return null;
  }

  return {
    city,
    countryCode,
    id: `${city}-${stateCode}-${address.latitude}-${address.longitude}`,
    label: locationLabel(address),
    latitude: address.latitude,
    longitude: address.longitude,
    state,
    stateCode,
  };
};
const usernameStatusClassName = (status: UsernameStatus) => {
  if (status === "available") {
    return "text-emerald-400";
  }

  return status === "checking" ? "text-muted-foreground" : "text-destructive";
};
const locationStatusClassName = (status: LocationStatus) => {
  if (status === "selected") {
    return "text-emerald-400";
  }

  const isError =
    status === "config_error" || status === "empty" || status === "error";

  return isError ? "text-destructive" : "text-muted-foreground";
};

export const Route = createFileRoute("/signup/artist/onboarding")({
  beforeLoad: () =>
    requireSignupOnboardingUser({ data: { accountType: "artist" } }),
  component: ArtistOnboardingPage,
});

function ArtistOnboardingPage() {
  const posthog = usePostHog();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [avatarObjectKey, setAvatarObjectKey] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [roles, setRoles] = useState<ArtistRole[]>(["musician"]);
  const [username, setUsername] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [city, setCity] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stateValue, setStateValue] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [primaryGenre, setPrimaryGenre] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [proAffiliation, setProAffiliation] = useState("");
  const [proMemberId, setProMemberId] = useState("");
  const [selectedPlanCode, setSelectedPlanCode] = useState(
    "soundkit_premium_artist"
  );
  const [songwriterLegalName, setSongwriterLegalName] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isDraftReady, setIsDraftReady] = useState(false);
  const radarInitializedRef = useRef(false);
  const selectedLocationQueryRef = useRef("");
  const usernameRequestIdRef = useRef(0);
  const locationRequestIdRef = useRef(0);
  const totalSteps = 8;

  const progress = (step / totalSteps) * 100;
  const normalizedUsername = normalizeUsername(username);
  const canContinueFromUsername = usernameStatus === "available";
  const canContinueFromLocation =
    locationStatus === "selected" || locationStatus === "manual_ready";

  const ensureRadarInitialized = () => {
    if (radarInitializedRef.current) {
      return true;
    }

    if (!env.VITE_RADAR_PUBLISHABLE_KEY) {
      setLocationSuggestions([]);
      return false;
    }

    RadarClient.initialize(env.VITE_RADAR_PUBLISHABLE_KEY);
    radarInitializedRef.current = true;
    return true;
  };

  const checkUsername = useAsyncDebouncedCallback(
    async (value: string, requestId: number) => {
      let response: Response;
      try {
        response = await fetch(
          `${API_V1_URL}/onboarding/username-availability?username=${encodeURIComponent(
            value
          )}`,
          { credentials: "include" }
        );
      } catch {
        if (requestId === usernameRequestIdRef.current) {
          setUsernameStatus("error");
          setUsernameMessage("Could not check that username right now.");
        }
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        available?: boolean;
        message?: string;
        reason?: "available" | "reserved" | "taken";
      } | null;

      if (requestId !== usernameRequestIdRef.current) {
        return;
      }

      if (!(response.ok && payload)) {
        setUsernameStatus("error");
        setUsernameMessage("Could not check that username right now.");
        return;
      }

      if (payload.available) {
        setUsernameStatus("available");
        setUsernameMessage(payload.message ?? "Username is available.");
        return;
      }

      setUsernameStatus(payload.reason === "reserved" ? "reserved" : "taken");
      setUsernameMessage(payload.message ?? "That username is not available.");
    },
    { wait: 400 }
  );

  const searchLocations = useAsyncDebouncedCallback(
    async (query: string, requestId: number) => {
      if (!ensureRadarInitialized()) {
        return;
      }

      let result: Awaited<ReturnType<typeof RadarClient.autocomplete>>;
      try {
        result = await RadarClient.autocomplete(
          {
            countryCode: "US",
            layers: ["locality", "place"],
            limit: 6,
            query,
          },
          `artist-onboarding-location-${requestId}`
        );
      } catch {
        if (requestId === locationRequestIdRef.current) {
          const manualLocation = parseManualLocation(query);
          setLocationSuggestions([]);

          if (manualLocation) {
            setCity(manualLocation.city);
            setStateValue(manualLocation.stateCode);
            setLocationStatus("manual_ready");
            return;
          }

          setLocationStatus("error");
        }
        return;
      }

      if (requestId !== locationRequestIdRef.current) {
        return;
      }

      const suggestions = result.addresses
        .map(toLocationSuggestion)
        .filter(
          (suggestion): suggestion is LocationSuggestion => suggestion !== null
        );

      if (suggestions.length > 0) {
        setLocationSuggestions(suggestions);
        setLocationStatus("ready");
        return;
      }

      const manualLocation = parseManualLocation(query);
      setLocationSuggestions([]);

      if (manualLocation) {
        setCity(manualLocation.city);
        setStateValue(manualLocation.stateCode);
        setLocationStatus("manual_ready");
        return;
      }

      setLocationStatus("empty");
    },
    { wait: 350 }
  );

  useEffect(() => {
    const requestId = usernameRequestIdRef.current + 1;
    usernameRequestIdRef.current = requestId;

    if (!normalizedUsername) {
      setUsernameMessage("");
      setUsernameStatus("idle");
      return;
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setUsernameMessage(
        "Use 3-32 letters, numbers, or underscores. No spaces."
      );
      setUsernameStatus("invalid");
      return;
    }

    if (RESERVED_USERNAMES.has(normalizedUsername)) {
      setUsernameMessage("That username is reserved.");
      setUsernameStatus("reserved");
      return;
    }

    setUsernameMessage("Checking availability...");
    setUsernameStatus("checking");
    void checkUsername(normalizedUsername, requestId);
  }, [checkUsername, normalizedUsername]);

  useEffect(() => {
    try {
      const draft = parseArtistOnboardingDraft(
        window.localStorage.getItem(ARTIST_ONBOARDING_DRAFT_KEY)
      );

      if (draft) {
        setAvatarObjectKey(draft.avatarObjectKey);
        setAvatarUrl(draft.avatarUrl);
        setStep(draft.step);
        setRoles(draft.roles);
        setUsername(draft.username);
        setCity(draft.city);
        setStateValue(draft.stateValue);
        setLocationQuery(draft.locationQuery);
        setPrimaryGenre(draft.primaryGenre);
        setSelectedPlanCode(draft.selectedPlanCode);

        if (draft.city && draft.stateValue) {
          setLocationStatus("manual_ready");
        }
      }
    } catch {
      window.localStorage.removeItem(ARTIST_ONBOARDING_DRAFT_KEY);
    } finally {
      setIsDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isDraftReady) {
      return;
    }

    const draft: ArtistOnboardingDraft = {
      avatarObjectKey,
      avatarUrl,
      city,
      locationQuery,
      primaryGenre,
      roles,
      selectedPlanCode,
      stateValue,
      step,
      username,
    };

    window.localStorage.setItem(
      ARTIST_ONBOARDING_DRAFT_KEY,
      JSON.stringify(draft)
    );
  }, [
    avatarObjectKey,
    avatarUrl,
    city,
    isDraftReady,
    locationQuery,
    primaryGenre,
    roles,
    selectedPlanCode,
    stateValue,
    step,
    username,
  ]);

  useEffect(() => {
    const query = locationQuery.trim();
    const requestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = requestId;

    if (!query) {
      setLocationSuggestions([]);
      setLocationStatus("idle");
      setCity("");
      setStateValue("");
      return;
    }

    if (selectedLocationQueryRef.current === query) {
      return;
    }

    if (query.length < 3) {
      setLocationSuggestions([]);
      setLocationStatus("idle");
      return;
    }

    if (!env.VITE_RADAR_PUBLISHABLE_KEY) {
      const manualLocation = parseManualLocation(query);
      if (manualLocation) {
        setCity(manualLocation.city);
        setStateValue(manualLocation.stateCode);
        setLocationStatus("manual_ready");
        return;
      }

      setLocationSuggestions([]);
      setCity("");
      setStateValue("");
      setLocationStatus("config_error");
      return;
    }

    setLocationStatus("searching");
    void searchLocations(query, requestId);
  }, [locationQuery, searchLocations]);

  const toggleRole = (role: ArtistRole) => {
    setRoles((currentRoles) => {
      if (currentRoles.includes(role) && currentRoles.length > 1) {
        return currentRoles.filter((currentRole) => currentRole !== role);
      }

      if (currentRoles.includes(role)) {
        return currentRoles;
      }

      return [...currentRoles, role];
    });
  };
  const updateUsername = (value: string) => {
    setUsername(value.replaceAll(/\s+/gu, ""));
  };
  const selectLocation = (suggestion: LocationSuggestion) => {
    selectedLocationQueryRef.current = suggestion.label;
    setCity(suggestion.city);
    setStateValue(suggestion.stateCode);
    setLocationQuery(suggestion.label);
    setLocationSuggestions([]);
    setLocationStatus("selected");
  };
  const continueFromUsername = () => {
    if (canContinueFromUsername) {
      setStep(3);
      return;
    }

    setUsernameMessage("Choose an available username before continuing.");
  };
  const continueFromLocation = () => {
    const manualLocation = parseManualLocation(locationQuery);
    if (manualLocation && locationStatus === "manual_ready") {
      setCity(manualLocation.city);
      setStateValue(manualLocation.stateCode);
      setStep(5);
      return;
    }

    if (canContinueFromLocation) {
      setStep(5);
      return;
    }

    setLocationStatus(locationQuery ? "empty" : "idle");
  };
  const completeOnboarding = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_V1_URL}/onboarding/artist`, {
        body: JSON.stringify({
          appleMusicUrl: appleMusicUrl || undefined,
          avatarObjectKey: avatarObjectKey || undefined,
          avatarUrl: avatarUrl || undefined,
          city: city || "Los Angeles",
          instagramHandle: instagramHandle || undefined,
          primaryGenre: primaryGenre || "Hip-Hop",
          proAffiliation: proAffiliation || "None",
          proMemberId: proMemberId || undefined,
          roles,
          selectedPlanCode,
          songwriterLegalName: songwriterLegalName || undefined,
          spotifyUrl: spotifyUrl || undefined,
          state: stateValue || "CA",
          teamInviteEmails: [],
          tiktokHandle: tiktokHandle || undefined,
          twitterHandle: twitterHandle || undefined,
          username: normalizedUsername,
          youtubeUrl: youtubeUrl || undefined,
        }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as {
        checkoutUrl?: string | null;
        message?: string;
      } | null;

      if (!response.ok) {
        setErrorMessage(
          payload?.message ?? "Unable to complete onboarding right now."
        );
        return;
      }

      posthog.capture("artist_onboarding_completed", {
        has_checkout: Boolean(payload?.checkoutUrl),
        has_profile_picture: Boolean(avatarUrl),
        plan_code: selectedPlanCode,
        primary_genre: primaryGenre,
        roles,
      });

      if (payload?.checkoutUrl) {
        window.localStorage.removeItem(ARTIST_ONBOARDING_DRAFT_KEY);
        window.location.assign(payload.checkoutUrl);
        return;
      }

      window.localStorage.removeItem(ARTIST_ONBOARDING_DRAFT_KEY);
      await router.navigate({ to: "/dashboard" });
    } catch (error) {
      posthog.captureException(error);
      setErrorMessage("Unable to reach SoundKit. Check your API credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="mb-4">
            <SoundKitBrand variant="wordmark" wordmarkClassName="h-12" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{wizardText.setupTitle}</h1>
          <p className="text-muted-foreground">
            {`Step ${step} of ${totalSteps}`}
          </p>
          <div className="mt-4">
            <Progress value={progress} />
          </div>
        </div>

        <div className="rounded-lg border border-border/40 bg-card/50 text-card-foreground shadow-sm backdrop-blur-sm">
          <div className="p-6 md:p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <SlidersHorizontal size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">{wizardText.rolesTitle}</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.rolesSubtitle}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${
                      roles.includes("musician")
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/50"
                    }`}
                    onClick={() => toggleRole("musician")}
                  >
                    <span className="mb-3 block text-primary">
                      <Music2 size={24} />
                    </span>
                    <p className="font-bold">{wizardText.musicianTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {wizardText.musicianDescription}
                    </p>
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border p-4 text-left transition ${
                      roles.includes("producer")
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/50"
                    }`}
                    onClick={() => toggleRole("producer")}
                  >
                    <span className="mb-3 block text-primary">
                      <SlidersHorizontal size={24} />
                    </span>
                    <p className="font-bold">{wizardText.producerTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {wizardText.producerDescription}
                    </p>
                  </button>
                </div>
                <Button asChild size="lg">
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => setStep(2)}
                  >
                    {wizardText.continue}
                  </button>
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <User size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">
                    {wizardText.usernameTitle}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.usernameSubtitle}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{wizardText.usernameLabel}</Label>
                  <Input
                    id="username"
                    placeholder={wizardText.usernamePlaceholder}
                    value={username}
                    aria-describedby="username-status"
                    aria-invalid={
                      usernameStatus === "invalid" ||
                      usernameStatus === "reserved" ||
                      usernameStatus === "taken"
                    }
                    onChange={(event) => updateUsername(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {wizardText.usernameGuidance}
                  </p>
                  {usernameMessage && (
                    <p
                      id="username-status"
                      className={`text-xs ${usernameStatusClassName(usernameStatus)}`}
                    >
                      {usernameMessage}
                    </p>
                  )}
                </div>
                <Button asChild size="lg">
                  <button
                    type="button"
                    className="w-full"
                    disabled={!canContinueFromUsername}
                    onClick={continueFromUsername}
                  >
                    {wizardText.continue}
                  </button>
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <User size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">
                    {wizardText.avatarTitle}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.avatarSubtitle}
                  </p>
                </div>

                <ArtistAvatarUpload
                  avatarUrl={avatarUrl}
                  onUploaded={({ objectKey, url }) => {
                    setAvatarObjectKey(objectKey);
                    setAvatarUrl(url);
                  }}
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <Button asChild size="lg" variant="outline">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(2)}
                      >
                        {wizardText.back}
                      </button>
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Button asChild size="lg">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(4)}
                      >
                        {avatarUrl
                          ? wizardText.avatarContinue
                          : wizardText.avatarSkip}
                      </button>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <MapPin size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">
                    {wizardText.locationTitle}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.locationSubtitle}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">{wizardText.locationLabel}</Label>
                    <div className="relative">
                      <Input
                        id="location"
                        placeholder={wizardText.locationPlaceholder}
                        value={locationQuery}
                        aria-autocomplete="list"
                        aria-expanded={locationSuggestions.length > 0}
                        aria-invalid={
                          locationStatus === "empty" ||
                          locationStatus === "config_error" ||
                          locationStatus === "error"
                        }
                        onChange={(event) => {
                          selectedLocationQueryRef.current = "";
                          setLocationQuery(event.target.value);
                          setCity("");
                          setStateValue("");
                          setLocationStatus("idle");
                        }}
                      />
                      {locationSuggestions.length > 0 && (
                        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                          {locationSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              className="flex w-full flex-col rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                              onClick={() => selectLocation(suggestion)}
                            >
                              <span className="font-medium">
                                {suggestion.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {wizardText.locationSuggestionCountry}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p
                      className={`text-xs ${locationStatusClassName(locationStatus)}`}
                    >
                      {locationStatus === "searching" &&
                        wizardText.locationSearching}
                      {locationStatus === "ready" && wizardText.locationReady}
                      {locationStatus === "selected" &&
                        `Verified ${city}, ${stateValue}.`}
                      {locationStatus === "manual_ready" &&
                        `Using ${city}, ${stateValue}.`}
                      {locationStatus === "empty" && wizardText.locationEmpty}
                      {locationStatus === "config_error" &&
                        wizardText.locationConfigError}
                      {locationStatus === "error" && wizardText.locationError}
                      {locationStatus === "idle" && wizardText.locationIdle}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Button asChild size="lg" variant="outline">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(3)}
                      >
                        {wizardText.back}
                      </button>
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Button asChild size="lg">
                      <button
                        type="button"
                        className="w-full"
                        disabled={!canContinueFromLocation}
                        onClick={continueFromLocation}
                      >
                        {wizardText.continue}
                      </button>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <Users size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">{wizardText.teamTitle}</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.teamSubtitle}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email1">{wizardText.teamEmailLabel}</Label>
                    <Input
                      id="email1"
                      type="email"
                      placeholder="producer@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">{wizardText.teamEmailLabel}</Label>
                    <Input
                      id="email2"
                      type="email"
                      placeholder="manager@example.com"
                    />
                  </div>
                </div>
                <Button asChild variant="outline">
                  <button type="button" className="w-full bg-transparent">
                    {wizardText.addAnother}
                  </button>
                </Button>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Button asChild size="lg" variant="outline">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(4)}
                      >
                        {wizardText.back}
                      </button>
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Button asChild size="lg">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(6)}
                      >
                        {wizardText.continue}
                      </button>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <Music2 size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">{wizardText.genreTitle}</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.genreSubtitle}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genre">{wizardText.genreLabel}</Label>
                  <Select value={primaryGenre} onValueChange={setPrimaryGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder={wizardText.genrePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hip-hop">
                        {wizardText.genreHipHop}
                      </SelectItem>
                      <SelectItem value="rb">
                        {wizardText.genreRbSoul}
                      </SelectItem>
                      <SelectItem value="pop">{wizardText.genrePop}</SelectItem>
                      <SelectItem value="electronic">
                        {wizardText.genreElectronic}
                      </SelectItem>
                      <SelectItem value="spoken-word">
                        {wizardText.genreSpokenWord}
                      </SelectItem>
                      <SelectItem value="rock">
                        {wizardText.genreRock}
                      </SelectItem>
                      <SelectItem value="afrobeats">
                        {wizardText.genreAfrobeats}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Button asChild size="lg" variant="outline">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(5)}
                      >
                        {wizardText.back}
                      </button>
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Button asChild size="lg">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(7)}
                      >
                        {wizardText.continue}
                      </button>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <LinkIcon size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">
                    {wizardText.streamingTitle}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.streamingSubtitle}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="spotify">{wizardText.spotifyLabel}</Label>
                    <Input
                      id="spotify"
                      onChange={(event) => setSpotifyUrl(event.target.value)}
                      placeholder="@artist or https://open.spotify.com/artist/..."
                      value={spotifyUrl}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apple">{wizardText.appleMusicLabel}</Label>
                    <Input
                      id="apple"
                      onChange={(event) => setAppleMusicUrl(event.target.value)}
                      placeholder="@artist or https://music.apple.com/artist/..."
                      value={appleMusicUrl}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtube">{wizardText.youtubeLabel}</Label>
                    <Input
                      id="youtube"
                      onChange={(event) => setYoutubeUrl(event.target.value)}
                      placeholder="@channel or https://youtube.com/@..."
                      value={youtubeUrl}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Button asChild size="lg" variant="outline">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(6)}
                      >
                        {wizardText.back}
                      </button>
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Button asChild size="lg">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(8)}
                      >
                        {wizardText.continue}
                      </button>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 8 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary">
                      <Share2 size={32} />
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">
                    {wizardText.socialsTitle}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {wizardText.socialsSubtitle}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="instagram">
                      {wizardText.instagramLabel}
                    </Label>
                    <Input
                      id="instagram"
                      onChange={(event) =>
                        setInstagramHandle(event.target.value)
                      }
                      placeholder="@yourhandle"
                      value={instagramHandle}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok">{wizardText.tiktokLabel}</Label>
                    <Input
                      id="tiktok"
                      onChange={(event) => setTiktokHandle(event.target.value)}
                      placeholder="@yourhandle"
                      value={tiktokHandle}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">{wizardText.twitterLabel}</Label>
                    <Input
                      id="twitter"
                      onChange={(event) => setTwitterHandle(event.target.value)}
                      placeholder="@yourhandle"
                      value={twitterHandle}
                    />
                  </div>
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="font-bold text-lg">
                    {wizardText.publishingTitle}
                  </h3>
                  <p className="mb-4 text-muted-foreground text-sm">
                    {wizardText.publishingSubtitle}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="songwriter-legal-name">
                        Songwriter / Legal Name
                      </Label>
                      <Input
                        id="songwriter-legal-name"
                        onChange={(event) =>
                          setSongwriterLegalName(event.target.value)
                        }
                        placeholder="Cameron Stewart"
                        value={songwriterLegalName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pro-affiliation">ASCAP / BMI</Label>
                      <Input
                        id="pro-affiliation"
                        onChange={(event) =>
                          setProAffiliation(event.target.value)
                        }
                        placeholder="BMI"
                        value={proAffiliation}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="pro-member-id">PRO Number</Label>
                      <Input
                        id="pro-member-id"
                        onChange={(event) => setProMemberId(event.target.value)}
                        placeholder="Writer member number"
                        value={proMemberId}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="font-bold text-lg mb-4">
                    {wizardText.planTitle}
                  </h3>
                  <div className="grid gap-4">
                    <button
                      type="button"
                      aria-label={wizardText.freeTitle}
                      className={`border-2 cursor-pointer hover:border-primary transition-colors ${
                        selectedPlanCode === "artist_free"
                          ? "border-primary"
                          : ""
                      }`}
                      onClick={() => setSelectedPlanCode("artist_free")}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between text-left">
                          <div>
                            <h4 className="font-semibold">
                              {wizardText.freeTitle}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {wizardText.freeDescription}
                            </p>
                          </div>
                          <span className="font-bold">
                            {wizardText.freePrice}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={wizardText.premiumTitle}
                      className={`border-2 cursor-pointer ${
                        selectedPlanCode === "soundkit_premium_artist"
                          ? "border-primary"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedPlanCode("soundkit_premium_artist")
                      }
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between text-left">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              {wizardText.premiumTitle}
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                {wizardText.planRecommended}
                              </span>
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {ARTIST_PREMIUM_PLAN_DESCRIPTION}
                            </p>
                          </div>
                          <span className="font-bold">
                            {wizardText.premiumPrice}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={wizardText.artistTeamTitle}
                      className={`cursor-pointer border-2 ${
                        selectedPlanCode === "artist_team"
                          ? "border-primary"
                          : ""
                      }`}
                      onClick={() => setSelectedPlanCode("artist_team")}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between text-left">
                          <div>
                            <h4 className="font-semibold">
                              {wizardText.artistTeamTitle}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {wizardText.artistTeamDescription}
                            </p>
                          </div>
                          <span className="font-bold">
                            {wizardText.artistTeamPrice}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </p>
                )}

                <div className="flex gap-3">
                  <div className="flex-1">
                    <Button asChild size="lg" variant="outline">
                      <button
                        type="button"
                        className="w-full"
                        onClick={() => setStep(7)}
                      >
                        {wizardText.back}
                      </button>
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Button asChild size="lg">
                      <button
                        type="button"
                        className="flex w-full items-center justify-center"
                        disabled={isSubmitting}
                        onClick={() => void completeOnboarding()}
                      >
                        <span className="mr-2">
                          <Check size={20} />
                        </span>
                        {isSubmitting
                          ? wizardText.completing
                          : wizardText.complete}
                      </button>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
