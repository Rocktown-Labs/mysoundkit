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
import { Card, CardContent } from "@/components/ui/card";
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

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;
const RESERVED_USERNAMES = new Set(["soundkit"]);
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
  value.trim().replace(/^@/, "").toLowerCase();
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
const locationLabel = (address: RadarAutocompleteAddress) => {
  const city = address.city ?? address.placeLabel;
  const state = address.stateCode ?? address.state;

  return [city, state].filter(Boolean).join(", ");
};
const toLocationSuggestion = (
  address: RadarAutocompleteAddress
): LocationSuggestion | null => {
  const city = address.city ?? address.placeLabel;
  const { stateCode } = address;
  const state = address.state ?? stateCode;

  if (!(city && state && stateCode && address.countryCode === "US")) {
    return null;
  }

  return {
    city,
    countryCode: address.countryCode,
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
  const [selectedPlanCode, setSelectedPlanCode] = useState("artist_premium");
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
          setLocationSuggestions([]);
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

      setLocationSuggestions(suggestions);
      setLocationStatus(suggestions.length > 0 ? "ready" : "empty");
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
    setUsername(value.replaceAll(/\s+/g, ""));
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
          avatarObjectKey: avatarObjectKey || undefined,
          avatarUrl: avatarUrl || undefined,
          city: city || "Los Angeles",
          primaryGenre: primaryGenre || "Hip-Hop",
          roles,
          selectedPlanCode,
          state: stateValue || "CA",
          teamInviteEmails: [],
          username: normalizedUsername,
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
        {/* Header */}
        <div className="text-center mb-8">
          <SoundKitBrand
            className="mb-4"
            variant="wordmark"
            wordmarkClassName="h-12"
          />
          <h1 className="text-2xl font-bold mb-2">
            Set Up Your Artist Profile
          </h1>
          <p className="text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
          <Progress value={progress} className="mt-4 h-2" />
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardContent className="p-6 md:p-8">
            {/* Step 1: Artist Roles */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <SlidersHorizontal className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">What Do You Create?</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Choose one or both. The dashboard stays the same.
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
                    <Music2 className="mb-3 size-6 text-primary" />
                    <p className="font-bold">Musician</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Release songs, albums, EPs, videos, and battle tracks.
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
                    <SlidersHorizontal className="mb-3 size-6 text-primary" />
                    <p className="font-bold">Producer</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sell or stream beats, license instrumentals, and battle.
                    </p>
                  </button>
                </div>
                <Button onClick={() => setStep(2)} className="w-full" size="lg">
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2: Username */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Choose Your Username</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    This is how fans will find you
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="@yourartistname"
                    className="text-lg"
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
                    Can only contain letters, numbers, and underscores
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
                <Button
                  onClick={continueFromUsername}
                  className="w-full"
                  disabled={!canContinueFromUsername}
                  size="lg"
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 3: Optional profile picture */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Add a Profile Picture</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Optional. You can skip this and add one later.
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
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(4)}
                    className="flex-1"
                    size="lg"
                  >
                    {avatarUrl ? "Continue" : "Skip for Now"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Location */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">
                    Where Do You Make Music?
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Help fans discover local talent
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">City or state</Label>
                    <div className="relative">
                      <Input
                        id="location"
                        placeholder="Little Rock, AR"
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
                                United States
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
                        "Searching verified places..."}
                      {locationStatus === "ready" &&
                        "Choose a city from the results to continue."}
                      {locationStatus === "selected" &&
                        `Verified ${city}, ${stateValue}.`}
                      {locationStatus === "manual_ready" &&
                        `Using ${city}, ${stateValue}. Add a Radar publishable key for verified autocomplete.`}
                      {locationStatus === "empty" &&
                        "Choose a valid US city from the results."}
                      {locationStatus === "config_error" &&
                        "Enter a city and state like Little Rock, AR. Add VITE_RADAR_PUBLISHABLE_KEY to enable Radar validation."}
                      {locationStatus === "error" &&
                        "Location validation is unavailable right now."}
                      {locationStatus === "idle" &&
                        "Start typing a city and state, then choose a verified result."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(3)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={continueFromLocation}
                    className="flex-1"
                    disabled={!canContinueFromLocation}
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Team Invites */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Invite Your Team</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Collaborate with producers, managers, and more
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email1">Team Member Email</Label>
                    <Input
                      id="email1"
                      type="email"
                      placeholder="producer@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">Team Member Email</Label>
                    <Input
                      id="email2"
                      type="email"
                      placeholder="manager@example.com"
                    />
                  </div>
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  + Add Another
                </Button>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(4)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(6)}
                    className="flex-1"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Genre */}
            {step === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Music2 className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">What's Your Genre?</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Help fans find your style
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genre">Primary Genre</Label>
                  <Select value={primaryGenre} onValueChange={setPrimaryGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                      <SelectItem value="rb">R&B/Soul</SelectItem>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="electronic">Electronic</SelectItem>
                      <SelectItem value="rock">Rock</SelectItem>
                      <SelectItem value="afrobeats">Afrobeats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(5)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(7)}
                    className="flex-1"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 7: Streaming Links */}
            {step === 7 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <LinkIcon className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Connect Your Music</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Link your streaming profiles (optional)
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="spotify">Spotify Artist URL</Label>
                    <Input
                      id="spotify"
                      placeholder="https://open.spotify.com/artist/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apple">Apple Music URL</Label>
                    <Input
                      id="apple"
                      placeholder="https://music.apple.com/artist/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube Channel URL</Label>
                    <Input
                      id="youtube"
                      placeholder="https://youtube.com/@..."
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(6)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(8)}
                    className="flex-1"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 8: Social Links + Subscription */}
            {step === 8 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Share2 className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Connect Your Socials</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Link your social media (optional)
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input id="instagram" placeholder="@yourhandle" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok">TikTok</Label>
                    <Input id="tiktok" placeholder="@yourhandle" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">X (Twitter)</Label>
                    <Input id="twitter" placeholder="@yourhandle" />
                  </div>
                </div>

                {/* Subscription Choice */}
                <div className="border-t pt-6 mt-6">
                  <h3 className="font-bold text-lg mb-4">Choose Your Plan</h3>
                  <div className="grid gap-4">
                    <Card
                      className={`border-2 cursor-pointer hover:border-primary transition-colors ${
                        selectedPlanCode === "artist_free"
                          ? "border-primary"
                          : ""
                      }`}
                      onClick={() => setSelectedPlanCode("artist_free")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Free Account</h4>
                            <p className="text-sm text-muted-foreground">
                              Basic features to get started
                            </p>
                          </div>
                          <span className="font-bold">$0/mo</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card
                      className={`border-2 cursor-pointer ${
                        selectedPlanCode === "artist_premium"
                          ? "border-primary"
                          : ""
                      }`}
                      onClick={() => setSelectedPlanCode("artist_premium")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              Premium
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                Recommended
                              </span>
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Selling, analytics, payouts, and paid community
                            </p>
                          </div>
                          <span className="font-bold">$14.99/mo</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card
                      className={`cursor-pointer border-2 ${
                        selectedPlanCode === "artist_team"
                          ? "border-primary"
                          : ""
                      }`}
                      onClick={() => setSelectedPlanCode("artist_team")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Artist Team</h4>
                            <p className="text-sm text-muted-foreground">
                              Artist Premium workspace for up to 5 seats
                            </p>
                          </div>
                          <span className="font-bold">$24.99/mo</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {errorMessage && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(7)}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={isSubmitting}
                    size="lg"
                    onClick={() => void completeOnboarding()}
                  >
                    <Check className="mr-2 size-5" />
                    {isSubmitting ? "Completing..." : "Complete Setup"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
