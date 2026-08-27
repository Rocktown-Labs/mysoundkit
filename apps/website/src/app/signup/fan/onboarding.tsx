import { usePostHog } from "@posthog/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Check, MapPin, Music2, User } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { PlanSelectionCard } from "@/components/billing/plan-selection-card";
import { LocationField } from "@/components/onboarding/location-field";
import { MediaLayoutSelector } from "@/components/onboarding/media-layout-selector";
import { UsernameField } from "@/components/onboarding/username-field";
import { SoundKitBrand } from "@/components/soundkit-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { API_V1_URL } from "@/lib/api";
import {
  clearBattleShareReferral,
  readBattleShareReferral,
} from "@/lib/battle-share";
import { FAN_ONBOARDING_DRAFT_KEY } from "@/lib/onboarding-flow";
import { fallbackBillingPlans } from "@/lib/pricing-flow";
import { useBillingPlansQuery, useGenresQuery } from "@/lib/soundkit-api-hooks";
import { requireSignupOnboardingUser } from "@/lib/soundkit.functions";

export const Route = createFileRoute("/signup/fan/onboarding")({
  beforeLoad: () =>
    requireSignupOnboardingUser({ data: { accountType: "fan" } }),
  component: FanOnboardingPage,
});

function FanOnboardingPage() {
  const router = useRouter(),
    posthog = usePostHog(),
    genresQuery = useGenresQuery(),
    plansQuery = useBillingPlansQuery(),
    [step, setStep] = useState(1),
    [username, setUsername] = useState(""),
    [usernameAvailable, setUsernameAvailable] = useState(false),
    [selectedGenres, setSelectedGenres] = useState<string[]>([]),
    [city, setCity] = useState(""),
    [country, setCountry] = useState(""),
    [stateValue, setStateValue] = useState(""),
    [mediaLayout, setMediaLayout] = useState<"cards" | "list">("cards"),
    [selectedPlanCode, setSelectedPlanCode] = useState("soundkit_premium_fan"),
    [errorMessage, setErrorMessage] = useState<string | null>(null),
    [finalizationStatus, setFinalizationStatus] = useState<
      "idle" | "saving" | "checkout"
    >("idle"),
    [isSubmitting, setIsSubmitting] = useState(false),
    [isDraftRestored, setIsDraftRestored] = useState(false),
    totalSteps = 4,
    plans = useMemo(() => {
      const available =
        plansQuery.data?.filter((plan) =>
          ["fan_free", "soundkit_premium_fan"].includes(plan.code)
        ) ?? [];
      return available.length > 0
        ? available
        : fallbackBillingPlans.filter((plan) => plan.audience === "fan");
    }, [plansQuery.data]),
    persistProgress = async (nextStep: number) => {
      await fetch(`${API_V1_URL}/onboarding/state`, {
        body: JSON.stringify({
          currentStep: nextStep,
          intendedAccountType: "fan",
          selectedPlanCode,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    },
    goToStep = (nextStep: number) => {
      posthog.capture("onboarding_step_completed", {
        account_type: "fan",
        step,
      });
      setStep(nextStep);
      void persistProgress(nextStep);
    },
    toggleGenre = (slug: string) => {
      setSelectedGenres((current) =>
        current.includes(slug)
          ? current.filter((item) => item !== slug)
          : [...current, slug]
      );
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
      posthog.capture("onboarding_exited", { account_type: "fan", step });
      await router.navigate({ to: "/" });
    },
    completeOnboarding = async () => {
      if (
        !(
          usernameAvailable &&
          selectedGenres.length >= 3 &&
          city &&
          country &&
          stateValue
        )
      ) {
        setErrorMessage(
          "Choose an available username, at least three genres, and your location before completing setup."
        );
        return;
      }
      setIsSubmitting(true);
      setFinalizationStatus("saving");
      setErrorMessage(null);
      const battleShareReferral = readBattleShareReferral();
      try {
        const response = await fetch(`${API_V1_URL}/onboarding/fan`, {
            body: JSON.stringify({
              city,
              country,
              genrePreferences: selectedGenres,
              mediaLayout,
              referrerUsername: battleShareReferral?.senderUsername,
              returnPath: battleShareReferral?.returnPath,
              selectedPlanCode,
              state: stateValue,
              username,
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
        window.localStorage.removeItem(FAN_ONBOARDING_DRAFT_KEY);
        clearBattleShareReferral();
        posthog.capture("onboarding_completed", {
          account_type: "fan",
          genre_count: selectedGenres.length,
          selected_plan: selectedPlanCode,
        });
        if (payload?.checkoutUrl) {
          setFinalizationStatus("checkout");
          posthog.capture("premium_checkout_started", {
            account_type: "fan",
            selected_plan: selectedPlanCode,
          });
          window.location.assign(payload.checkoutUrl);
          return;
        }
        window.location.assign(battleShareReferral?.returnPath ?? "/");
      } catch {
        setErrorMessage("Unable to reach SoundKit. Please try again.");
      } finally {
        setIsSubmitting(false);
        setFinalizationStatus("idle");
      }
    };

  useEffect(() => {
    posthog.capture("onboarding_step_viewed", { account_type: "fan", step });
  }, [posthog, step]);

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(FAN_ONBOARDING_DRAFT_KEY);
    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft) as Record<string, unknown>;
        if (typeof draft.step === "number") {
          setStep(Math.min(Math.max(Math.trunc(draft.step), 1), totalSteps));
        }
        if (typeof draft.username === "string") {
          setUsername(draft.username);
        }
        if (Array.isArray(draft.selectedGenres)) {
          setSelectedGenres(
            draft.selectedGenres.filter(
              (genre): genre is string => typeof genre === "string"
            )
          );
        }
        if (typeof draft.city === "string") {
          setCity(draft.city);
        }
        if (typeof draft.stateValue === "string") {
          setStateValue(draft.stateValue);
        }
        if (draft.mediaLayout === "cards" || draft.mediaLayout === "list") {
          setMediaLayout(draft.mediaLayout);
        }
        if (
          draft.selectedPlanCode === "fan_free" ||
          draft.selectedPlanCode === "soundkit_premium_fan"
        ) {
          setSelectedPlanCode(draft.selectedPlanCode);
        }
      } catch {
        window.localStorage.removeItem(FAN_ONBOARDING_DRAFT_KEY);
      }
    }
    setIsDraftRestored(true);

    const restoreProgress = async () => {
      const response = await fetch(`${API_V1_URL}/onboarding/state`, {
        credentials: "include",
      });
      if (!response.ok) {
        posthog.capture("onboarding_started", { account_type: "fan" });
        return;
      }
      const state = (await response.json().catch(() => null)) as {
        currentStep?: number;
        selectedPlanCode?: string | null;
      } | null;
      if (state?.currentStep && state.currentStep > 1) {
        setStep(Math.min(state.currentStep, totalSteps));
        posthog.capture("onboarding_resumed", {
          account_type: "fan",
          step: state.currentStep,
        });
      } else {
        posthog.capture("onboarding_started", { account_type: "fan" });
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
      FAN_ONBOARDING_DRAFT_KEY,
      JSON.stringify({
        city,
        country,
        mediaLayout,
        selectedGenres,
        selectedPlanCode,
        stateValue,
        step,
        username,
      })
    );
  }, [
    city,
    country,
    isDraftRestored,
    mediaLayout,
    selectedGenres,
    selectedPlanCode,
    stateValue,
    step,
    username,
  ]);

  const goBack = () => setStep((current) => Math.max(1, current - 1)),
    submitLabel =
      finalizationStatus === "checkout"
        ? "Starting Premium checkout…"
        : "Preparing your SoundKit home…";

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <SoundKitBrand variant="wordmark" wordmarkClassName="h-11" />
          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
            <span>Personalize your SoundKit</span>
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
                icon={<User />}
                title="Choose Your Username"
                subtitle="This is how you will appear to other people."
              >
                <UsernameField
                  onChange={setUsername}
                  onStatusChange={(status) =>
                    setUsernameAvailable(status === "available")
                  }
                  value={username}
                />
                <div className="mt-6">
                  <Button
                    className="h-12 w-full"
                    disabled={!usernameAvailable}
                    onClick={() => goToStep(2)}
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </StepFrame>
            ) : null}
            {step === 2 ? (
              <StepFrame
                icon={<Music2 />}
                title="What Do You Like to Listen To?"
                subtitle="Choose at least three genres to personalize discovery."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {genresQuery.data?.map((genre) => (
                    <button
                      aria-checked={selectedGenres.includes(genre.slug)}
                      className={`min-h-16 rounded-lg border-2 p-4 text-left transition ${selectedGenres.includes(genre.slug) ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/60"}`}
                      key={genre.slug}
                      onClick={() => toggleGenre(genre.slug)}
                      role="checkbox"
                      type="button"
                    >
                      <span className="font-medium">{genre.name}</span>
                    </button>
                  ))}
                </div>
                {genresQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading genres…
                  </p>
                ) : null}
                {genresQuery.error ? (
                  <p className="text-sm text-destructive">
                    Genres are unavailable right now. Try again.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {selectedGenres.length} selected · minimum 3
                </p>
                <div className="mt-6 flex gap-3">
                  <Button
                    className="h-12 flex-1"
                    onClick={goBack}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <Button
                    className="h-12 flex-1"
                    disabled={selectedGenres.length < 3}
                    onClick={() => goToStep(3)}
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </StepFrame>
            ) : null}
            {step === 3 ? (
              <StepFrame
                icon={<MapPin />}
                title="Where Are You Located?"
                subtitle="Discover local artists and events with a city and region or country."
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
                    onClick={goBack}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <Button
                    className="h-12 flex-1"
                    disabled={!(city && country && stateValue)}
                    onClick={() => goToStep(4)}
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </StepFrame>
            ) : null}
            {step === 4 ? (
              <StepFrame
                icon={<Check />}
                title="Choose Your Experience"
                subtitle="Pick a library layout and choose Free or Premium. You can upgrade later."
              >
                <div className="space-y-5">
                  <MediaLayoutSelector
                    onChange={setMediaLayout}
                    value={mediaLayout}
                  />
                  <div className="space-y-3">
                    <h3 className="font-semibold">Choose your plan</h3>
                    {plans.map((plan) => (
                      <PlanSelectionCard
                        description={
                          plan.code === "fan_free"
                            ? "Discover public releases with one account."
                            : "Premium listening, live access, and up to five total accounts/seats."
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
                    onClick={goBack}
                    size="lg"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <Button
                    className="h-12 flex-1"
                    disabled={isSubmitting}
                    onClick={() => void completeOnboarding()}
                    size="lg"
                  >
                    {isSubmitting ? submitLabel : "Complete setup"}
                  </Button>
                </div>
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
