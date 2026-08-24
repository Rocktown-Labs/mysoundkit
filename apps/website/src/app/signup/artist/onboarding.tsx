import { usePostHog } from "@posthog/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Check,
  Link as LinkIcon,
  MapPin,
  Music2,
  SlidersHorizontal,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { PlanSelectionCard } from "@/components/billing/plan-selection-card";
import { ArtistAvatarUpload } from "@/components/onboarding/artist-avatar-upload";
import type { AvatarUploadStatus } from "@/components/onboarding/artist-avatar-upload";
import { LocationField } from "@/components/onboarding/location-field";
import { MediaLayoutSelector } from "@/components/onboarding/media-layout-selector";
import { UsernameField } from "@/components/onboarding/username-field";
import { SoundKitBrand } from "@/components/soundkit-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { API_V1_URL } from "@/lib/api";
import {
  ARTIST_ONBOARDING_DRAFT_KEY,
  parseArtistOnboardingDraft,
} from "@/lib/onboarding-flow";
import { fallbackBillingPlans } from "@/lib/pricing-flow";
import { useBillingPlansQuery, useGenresQuery } from "@/lib/soundkit-api-hooks";
import { requireSignupOnboardingUser } from "@/lib/soundkit.functions";

export const Route = createFileRoute("/signup/artist/onboarding")({
  beforeLoad: () =>
    requireSignupOnboardingUser({ data: { accountType: "artist" } }),
  component: ArtistOnboardingPage,
});

const RIGHTS_ATTESTATION_VERSION = "2026-01",
  creatorCopy = {
    independent: {
      description:
        "I own, control, or have permission to upload, stream, sell, and monetize the music I publish on SoundKit.",
      title: "Independent / Indie-Controlled",
    },
    major: {
      description:
        "A major label or one of its affiliates controls or must approve the recordings/catalog I would publish.",
      title: "Major-Label Controlled or Affiliated",
    },
  } as const;

type ArtistRole = "musician" | "producer";
type Eligibility = keyof typeof creatorCopy;

function ArtistOnboardingPage() {
  const router = useRouter(),
    posthog = usePostHog(),
    genresQuery = useGenresQuery(),
    plansQuery = useBillingPlansQuery(),
    [step, setStep] = useState(1),
    [roles, setRoles] = useState<ArtistRole[]>(["musician"]),
    [eligibility, setEligibility] = useState<Eligibility | null>(null),
    [username, setUsername] = useState(""),
    [usernameAvailable, setUsernameAvailable] = useState(false),
    [avatarObjectKey, setAvatarObjectKey] = useState(""),
    [avatarUrl, setAvatarUrl] = useState(""),
    [avatarStatus, setAvatarStatus] = useState<AvatarUploadStatus>("idle"),
    [city, setCity] = useState(""),
    [country, setCountry] = useState(""),
    [stateValue, setStateValue] = useState(""),
    [primaryGenre, setPrimaryGenre] = useState(""),
    [spotifyUrl, setSpotifyUrl] = useState(""),
    [appleMusicUrl, setAppleMusicUrl] = useState(""),
    [youtubeUrl, setYoutubeUrl] = useState(""),
    [instagramHandle, setInstagramHandle] = useState(""),
    [tiktokHandle, setTiktokHandle] = useState(""),
    [twitterHandle, setTwitterHandle] = useState(""),
    [songwriterLegalName, setSongwriterLegalName] = useState(""),
    [proAffiliation, setProAffiliation] = useState(""),
    [proMemberId, setProMemberId] = useState(""),
    [mediaLayout, setMediaLayout] = useState<"cards" | "list">("cards"),
    [selectedPlanCode, setSelectedPlanCode] = useState(
      "soundkit_premium_artist"
    ),
    [rightsAttested, setRightsAttested] = useState(false),
    [errorMessage, setErrorMessage] = useState<string | null>(null),
    [finalizationStatus, setFinalizationStatus] = useState<
      "idle" | "saving" | "checkout"
    >("idle"),
    [isSubmitting, setIsSubmitting] = useState(false),
    [hasExited, setHasExited] = useState(false),
    [isDraftRestored, setIsDraftRestored] = useState(false),
    totalSteps = 8,
    plans = useMemo(() => {
      const available =
        plansQuery.data?.filter((plan) =>
          ["artist_free", "soundkit_premium_artist"].includes(plan.code)
        ) ?? [];
      return available.length > 0
        ? available
        : fallbackBillingPlans.filter((plan) => plan.audience === "artist");
    }, [plansQuery.data]),
    persistProgress = async (
      nextStep: number,
      extra: Record<string, unknown> = {}
    ) => {
      await fetch(`${API_V1_URL}/onboarding/state`, {
        body: JSON.stringify({
          currentStep: nextStep,
          intendedAccountType: "artist",
          selectedPlanCode,
          ...extra,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    },
    goToStep = (nextStep: number) => {
      posthog.capture("onboarding_step_completed", {
        account_type: "artist",
        step,
      });
      setStep(nextStep);
      void persistProgress(nextStep);
    },
    toggleRole = (role: ArtistRole) => {
      setRoles((current) => {
        if (current.includes(role)) {
          return current.length === 1
            ? current
            : current.filter((item) => item !== role);
        }
        return [...current, role];
      });
    },
    declareEligibility = async (value: Eligibility) => {
      setErrorMessage(null);
      try {
        const response = await fetch(`${API_V1_URL}/onboarding/eligibility`, {
            body: JSON.stringify({
              eligibility:
                value === "major" ? "major_label_affiliated" : "independent",
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }),
          payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
        if (!response.ok) {
          setErrorMessage(
            payload?.message ?? "We could not save that eligibility choice."
          );
          return;
        }
        setEligibility(value);
        posthog.capture("creator_eligibility_declared", {
          account_type: value === "major" ? "fan" : "artist",
          eligibility: value,
        });
      } catch {
        setErrorMessage(
          "We could not save that eligibility choice. Please try again."
        );
      }
    },
    exitSetup = async () => {
      if (
        !window.confirm(
          "Exit setup? Your account and progress will stay saved. You can return and finish setup later."
        )
      ) {
        return;
      }
      await fetch(`${API_V1_URL}/onboarding/exit`, {
        credentials: "include",
        method: "POST",
      });
      posthog.capture("onboarding_exited", { account_type: "artist", step });
      setHasExited(true);
      await router.navigate({ to: "/" });
    },
    completeOnboarding = async () => {
      if (
        !usernameAvailable ||
        !primaryGenre ||
        !city ||
        !country ||
        !stateValue ||
        !rightsAttested
      ) {
        setErrorMessage(
          "Finish the required profile fields and rights confirmation before completing setup."
        );
        return;
      }
      if (avatarStatus === "uploading") {
        setErrorMessage(
          "Your profile picture is still uploading. Wait for it to finish or choose to continue without it."
        );
        return;
      }
      setIsSubmitting(true);
      setFinalizationStatus("saving");
      setErrorMessage(null);
      try {
        const response = await fetch(`${API_V1_URL}/onboarding/artist`, {
            body: JSON.stringify({
              appleMusicUrl: appleMusicUrl || undefined,
              avatarObjectKey: avatarObjectKey || undefined,
              avatarUrl: avatarUrl || undefined,
              city,
              country,
              creatorEligibility: "independent",
              instagramHandle: instagramHandle || undefined,
              mediaLayout,
              primaryGenre,
              proAffiliation: proAffiliation || "None",
              proMemberId: proMemberId || undefined,
              rightsAttestationVersion: RIGHTS_ATTESTATION_VERSION,
              rightsAttested: true,
              roles,
              selectedPlanCode,
              songwriterLegalName: songwriterLegalName || undefined,
              spotifyUrl: spotifyUrl || undefined,
              state: stateValue,
              tiktokHandle: tiktokHandle || undefined,
              twitterHandle: twitterHandle || undefined,
              username,
              youtubeUrl: youtubeUrl || undefined,
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }),
          payload = (await response.json().catch(() => null)) as {
            checkoutUrl?: string | null;
            message?: string;
          } | null;
        if (!response.ok) {
          setErrorMessage(
            payload?.message ?? "Unable to complete onboarding right now."
          );
          return;
        }
        window.localStorage.removeItem(ARTIST_ONBOARDING_DRAFT_KEY);
        posthog.capture("onboarding_completed", {
          account_type: "artist",
          selected_plan: selectedPlanCode,
        });
        if (payload?.checkoutUrl) {
          setFinalizationStatus("checkout");
          posthog.capture("premium_checkout_started", {
            account_type: "artist",
            selected_plan: selectedPlanCode,
          });
          window.location.assign(payload.checkoutUrl);
          return;
        }
        await router.navigate({ to: "/dashboard" });
      } catch {
        setErrorMessage("Unable to reach SoundKit. Please try again.");
      } finally {
        setIsSubmitting(false);
        setFinalizationStatus("idle");
      }
    };

  useEffect(() => {
    if (hasExited) {
      return;
    }
    posthog.capture("onboarding_step_viewed", { account_type: "artist", step });
  }, [hasExited, posthog, step]);

  useEffect(() => {
    const restoreProgress = async () => {
      const rawDraft = window.localStorage.getItem(ARTIST_ONBOARDING_DRAFT_KEY),
        draft = parseArtistOnboardingDraft(rawDraft);
      if (rawDraft && !draft) {
        window.localStorage.removeItem(ARTIST_ONBOARDING_DRAFT_KEY);
      }
      if (draft) {
        setStep(draft.step);
        setUsername(draft.username);
        setAvatarObjectKey(draft.avatarObjectKey);
        setAvatarUrl(draft.avatarUrl);
        setCity(draft.city);
        setCountry(draft.country);
        setStateValue(draft.stateValue);
        setPrimaryGenre(draft.primaryGenre);
        setRoles(draft.roles);
        setSelectedPlanCode(draft.selectedPlanCode);
        // Availability is always re-checked by the server-backed field instead
        // of trusting a stale local draft.
        setUsernameAvailable(false);
      }
      setIsDraftRestored(true);
      const hasLocalDraft = Boolean(
          window.localStorage.getItem(ARTIST_ONBOARDING_DRAFT_KEY)
        ),
        response = await fetch(`${API_V1_URL}/onboarding/state`, {
          credentials: "include",
        });
      if (!response.ok) {
        posthog.capture("onboarding_started", { account_type: "artist" });
        return;
      }
      const state = (await response.json().catch(() => null)) as {
        creatorEligibility?: string | null;
        currentStep?: number;
        selectedPlanCode?: string | null;
      } | null;
      if (state?.currentStep && state.currentStep > 1 && !hasLocalDraft) {
        setStep(Math.min(state.currentStep, totalSteps));
        posthog.capture("onboarding_resumed", {
          account_type: "artist",
          step: state.currentStep,
        });
      } else {
        posthog.capture("onboarding_started", { account_type: "artist" });
      }
      if (
        state?.creatorEligibility === "independent" ||
        state?.creatorEligibility === "major_label_affiliated"
      ) {
        setEligibility(
          state.creatorEligibility === "major_label_affiliated"
            ? "major"
            : "independent"
        );
      }
      if (state?.selectedPlanCode) {
        setSelectedPlanCode(state.selectedPlanCode);
      }
    };
    void restoreProgress();
  }, [posthog]);

  useEffect(() => {
    if (!isDraftRestored) {
      return;
    }
    window.localStorage.setItem(
      ARTIST_ONBOARDING_DRAFT_KEY,
      JSON.stringify({
        avatarObjectKey,
        avatarUrl,
        city,
        country,
        primaryGenre,
        roles,
        selectedPlanCode,
        stateValue,
        step,
        username,
      })
    );
  }, [
    avatarObjectKey,
    avatarUrl,
    city,
    country,
    isDraftRestored,
    primaryGenre,
    roles,
    selectedPlanCode,
    stateValue,
    step,
    username,
  ]);

  const nextButton = (nextStep: number, disabled = false) => (
    <Button
      className="h-12 w-full"
      disabled={disabled}
      onClick={() => goToStep(nextStep)}
      size="lg"
    >
      Continue
    </Button>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <SoundKitBrand variant="wordmark" wordmarkClassName="h-11" />
          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
            <h1>Set up your Artist profile</h1>
            <button
              className="text-primary hover:underline"
              onClick={() => void exitSetup()}
              type="button"
            >
              Exit setup
            </button>
          </div>
          <p className="mt-3 text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
          <Progress className="mt-4 h-2" value={(step / totalSteps) * 100} />
        </div>

        <Card className="border-border/60 bg-card/80 shadow-xl shadow-black/10">
          <CardContent className="p-6 md:p-10">
            {step === 1 ? (
              <StepFrame
                icon={<SlidersHorizontal />}
                title="What Do You Create?"
                subtitle="Choose one or both. Your dashboard can support both roles."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoiceCard
                    selected={roles.includes("musician")}
                    onClick={() => toggleRole("musician")}
                    title="Musician"
                    description="Release songs, albums, EPs, videos, and battle tracks."
                    icon={<Music2 />}
                  />
                  <ChoiceCard
                    selected={roles.includes("producer")}
                    onClick={() => toggleRole("producer")}
                    title="Producer"
                    description="Sell or stream beats, license instrumentals, and collaborate."
                    icon={<SlidersHorizontal />}
                  />
                </div>
                <div className="mt-6">{nextButton(2)}</div>
              </StepFrame>
            ) : null}

            {step === 2 ? (
              <StepFrame
                icon={<User />}
                title="Can you publish independently on SoundKit?"
                subtitle="SoundKit Artist accounts are currently for independent creators who control the rights needed to upload and monetize their music."
              >
                <div className="grid gap-3">
                  <ChoiceCard
                    selected={eligibility === "independent"}
                    onClick={() => void declareEligibility("independent")}
                    title={creatorCopy.independent.title}
                    description={creatorCopy.independent.description}
                  />
                  <ChoiceCard
                    selected={eligibility === "major"}
                    onClick={() => void declareEligibility("major")}
                    title={creatorCopy.major.title}
                    description={creatorCopy.major.description}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Independent-label and distribution deals are okay if you
                  retain the rights or permissions required to publish here.
                </p>
                {eligibility === "major" ? (
                  <div className="mt-5 rounded-lg border border-primary/40 bg-primary/10 p-4">
                    <p className="font-medium">
                      SoundKit isn&apos;t onboarding major-label-controlled
                      artist catalogs right now.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      You can still use SoundKit as a fan to listen, follow
                      artists, vote, build your library, and participate in the
                      community.
                    </p>
                    <Button
                      className="mt-4 h-11 w-full"
                      onClick={() => {
                        window.localStorage.removeItem(
                          ARTIST_ONBOARDING_DRAFT_KEY
                        );
                        posthog.capture("onboarding_exited", {
                          account_type: "artist",
                          eligibility: "major_label_affiliated",
                          step,
                        });
                        void router.navigate({ to: "/signup/fan/onboarding" });
                      }}
                    >
                      Continue as Fan
                    </Button>
                  </div>
                ) : (
                  <div className="mt-6 flex gap-3">
                    <Button
                      className="h-12 flex-1"
                      onClick={() => setStep(1)}
                      size="lg"
                      variant="outline"
                    >
                      Back
                    </Button>
                    <div className="flex-1">
                      {nextButton(3, eligibility !== "independent")}
                    </div>
                  </div>
                )}
              </StepFrame>
            ) : null}

            {step === 3 ? (
              <StepFrame
                icon={<User />}
                title="Choose Your Username"
                subtitle="This is how fans will find you."
              >
                <UsernameField
                  onChange={setUsername}
                  onStatusChange={(status) =>
                    setUsernameAvailable(status === "available")
                  }
                  value={username}
                />
                <div className="mt-6 flex gap-3">
                  <Button
                    className="h-12 flex-1"
                    onClick={() => setStep(2)}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <div className="flex-1">
                    {nextButton(4, !usernameAvailable)}
                  </div>
                </div>
              </StepFrame>
            ) : null}

            {step === 4 ? (
              <StepFrame
                icon={<User />}
                title="Add a Profile Picture"
                subtitle="Optional. You can skip this and add one later."
              >
                <ArtistAvatarUpload
                  avatarUrl={avatarUrl}
                  onStatusChange={setAvatarStatus}
                  onUploaded={({ objectKey, url }) => {
                    setAvatarObjectKey(objectKey);
                    setAvatarUrl(url);
                  }}
                />
                <div className="mt-6 flex gap-3">
                  <Button
                    className="h-12 flex-1"
                    onClick={() => setStep(3)}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <div className="flex-1">
                    {nextButton(
                      5,
                      avatarStatus === "uploading" || avatarStatus === "failed"
                    )}
                  </div>
                </div>
              </StepFrame>
            ) : null}

            {step === 5 ? (
              <StepFrame
                icon={<MapPin />}
                title="Where Do You Make Music?"
                subtitle="Help fans discover local talent."
              >
                <LocationField
                  city={city}
                  country={country}
                  onChange={({
                    city: nextCity,
                    country: nextCountry,
                    state: nextState,
                  }) => {
                    setCity(nextCity);
                    setCountry(nextCountry);
                    setStateValue(nextState);
                  }}
                  state={stateValue}
                />
                <div className="mt-6 flex gap-3">
                  <Button
                    className="h-12 flex-1"
                    onClick={() => setStep(4)}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <div className="flex-1">
                    {nextButton(6, !(city && country && stateValue))}
                  </div>
                </div>
              </StepFrame>
            ) : null}

            {step === 6 ? (
              <StepFrame
                icon={<Music2 />}
                title="What's Your Primary Genre?"
                subtitle="Help fans find your style."
              >
                <div className="space-y-2">
                  <Label htmlFor="primary-genre">Primary genre</Label>
                  <select
                    className="h-12 w-full rounded-md border border-border bg-background px-3"
                    id="primary-genre"
                    onChange={(event) => setPrimaryGenre(event.target.value)}
                    value={primaryGenre}
                  >
                    <option value="">Select genre</option>
                    {genresQuery.data?.map((genre) => (
                      <option key={genre.slug} value={genre.slug}>
                        {genre.name}
                      </option>
                    ))}
                  </select>
                  {genresQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Loading genres…
                    </p>
                  ) : null}
                  {genresQuery.error ? (
                    <p className="text-xs text-destructive">
                      Genres are unavailable right now. Try again.
                    </p>
                  ) : null}
                </div>
                <div className="mt-6 flex gap-3">
                  <Button
                    className="h-12 flex-1"
                    onClick={() => setStep(5)}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <div className="flex-1">
                    {nextButton(7, !primaryGenre || genresQuery.isLoading)}
                  </div>
                </div>
              </StepFrame>
            ) : null}

            {step === 7 ? (
              <StepFrame
                icon={<LinkIcon />}
                title="Connect Your Music"
                subtitle="Link your streaming profiles. This is optional."
              >
                <div className="space-y-4">
                  <LinkInput
                    id="spotify"
                    label="Spotify Artist URL"
                    onChange={setSpotifyUrl}
                    placeholder="@artist or https://open.spotify.com/artist/..."
                    value={spotifyUrl}
                  />
                  <LinkInput
                    id="apple-music"
                    label="Apple Music URL"
                    onChange={setAppleMusicUrl}
                    placeholder="@artist or https://music.apple.com/artist/..."
                    value={appleMusicUrl}
                  />
                  <LinkInput
                    id="youtube"
                    label="YouTube Channel URL"
                    onChange={setYoutubeUrl}
                    placeholder="@channel or https://youtube.com/@..."
                    value={youtubeUrl}
                  />
                </div>
                <div className="mt-6 flex gap-3">
                  <Button
                    className="h-12 flex-1"
                    onClick={() => setStep(6)}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <div className="flex-1">{nextButton(8)}</div>
                </div>
              </StepFrame>
            ) : null}

            {step === 8 ? (
              <StepFrame
                icon={<Check />}
                title="Finish Your Artist Profile"
                subtitle="Add the details you want to show publicly, choose your layout, and select Free or Premium."
              >
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LinkInput
                      id="instagram"
                      label="Instagram"
                      onChange={setInstagramHandle}
                      placeholder="@yourhandle"
                      value={instagramHandle}
                    />
                    <LinkInput
                      id="tiktok"
                      label="TikTok"
                      onChange={setTiktokHandle}
                      placeholder="@yourhandle"
                      value={tiktokHandle}
                    />
                    <LinkInput
                      id="twitter"
                      label="X (Twitter)"
                      onChange={setTwitterHandle}
                      placeholder="@yourhandle"
                      value={twitterHandle}
                    />
                    <LinkInput
                      id="songwriter"
                      label="Stage / songwriter name"
                      onChange={setSongwriterLegalName}
                      placeholder="Optional public name"
                      value={songwriterLegalName}
                    />
                    <LinkInput
                      id="pro"
                      label="ASCAP / BMI"
                      onChange={setProAffiliation}
                      placeholder="Optional"
                      value={proAffiliation}
                    />
                    <LinkInput
                      id="pro-member"
                      label="PRO number"
                      onChange={setProMemberId}
                      placeholder="Optional"
                      value={proMemberId}
                    />
                  </div>
                  <MediaLayoutSelector
                    onChange={setMediaLayout}
                    value={mediaLayout}
                  />
                  <div className="rounded-lg border border-border/60 p-4">
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={rightsAttested}
                        onCheckedChange={(checked) =>
                          setRightsAttested(checked === true)
                        }
                      />
                      <span>
                        I confirm that I own or have the permissions needed to
                        upload, distribute, stream, sell, and monetize the
                        content I publish on SoundKit.{" "}
                        <a
                          className="text-primary hover:underline"
                          href="/terms"
                        >
                          Read the Terms
                        </a>
                        .
                      </span>
                    </label>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-semibold">Choose your plan</h3>
                    {plans.map((plan) => (
                      <PlanSelectionCard
                        description={
                          plan.code === "artist_free"
                            ? "One account with the essentials to get started."
                            : "Live tools, creator rewards, and up to five total accounts/seats."
                        }
                        key={plan.code}
                        onSelect={() => setSelectedPlanCode(plan.code)}
                        plan={{ ...plan, maxSeats: plan.maxSeats ?? 1 }}
                        selected={selectedPlanCode === plan.code}
                      />
                    ))}
                  </div>
                </div>
                {errorMessage ? (
                  <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}
                <div className="mt-6 flex gap-3">
                  <Button
                    className="h-12 flex-1"
                    onClick={() => setStep(7)}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <Button
                    className="h-12 flex-1"
                    disabled={isSubmitting || !rightsAttested}
                    onClick={() => void completeOnboarding()}
                    size="lg"
                  >
                    <Check className="mr-2 size-4" />
                    {isSubmitting ? "Saving your profile…" : "Complete setup"}
                  </Button>
                </div>
                {isSubmitting ? (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {finalizationStatus === "checkout"
                      ? "Starting Premium checkout…"
                      : "Saving your profile, preparing your workspace, and finishing profile media…"}
                  </p>
                ) : null}
              </StepFrame>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StepFrame({
  children,
  icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({
  description,
  icon,
  onClick,
  selected,
  title,
}: {
  description: string;
  icon?: ReactNode;
  onClick: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <button
      aria-checked={selected}
      className={`rounded-lg border-2 p-5 text-left transition ${selected ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/60"}`}
      onClick={onClick}
      role="radio"
      type="button"
    >
      <div className="mb-4 text-primary">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function LinkInput({
  id,
  label,
  onChange,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        className="h-12 bg-background"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}
