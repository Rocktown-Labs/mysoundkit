/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/hook-use-state, react/set-state-in-effect */
"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  Info,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  BioTurnstile,
  isBioTurnstileConfigured,
} from "@/components/bio-turnstile";
import {
  checkUsernameAvailable,
  loadGenres,
  signUpWithEmail,
  submitFanOnboarding,
} from "@/lib/api";

export const Route = createFileRoute("/signup/fan")({
  component: FanSignupPage,
});

const DEFAULT_GENRES = [
  "Hip-Hop",
  "R&B/Soul",
  "Pop",
  "Electronic",
  "Rock",
  "Country",
  "Latin",
  "Afrobeats",
  "Jazz",
  "Alternative",
  "Indie",
];

function FanSignupPage() {
  const navigate = useNavigate();

  // Current onboarding step (1 to 4)
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Step 1: Credentials
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: Handle & Location
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [country, setCountry] = useState("United States");

  // Step 3: Genre preferences (minimum 3)
  const [availableGenres, setAvailableGenres] =
    useState<string[]>(DEFAULT_GENRES);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([
    "Hip-Hop",
    "R&B/Soul",
    "Electronic",
  ]);

  // Step 4: Plan Selection
  const [selectedPlanCode, setSelectedPlanCode] = useState<
    "fan_free" | "soundkit_premium_fan"
  >("fan_free");

  // Submission state
  const [isAccountCreated, setIsAccountCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");

  // Load genres on mount
  useEffect(() => {
    let active = true;
    const fetchGenres = async () => {
      try {
        const genres = await loadGenres();
        if (active && genres.length > 0) {
          setAvailableGenres(genres);
        }
      } catch {
        // Fallback default genres
      }
    };
    void fetchGenres();
    return () => {
      active = false;
    };
  }, []);

  // Real-time username check
  useEffect(() => {
    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9_-]/gu, "");

    if (cleanUsername.length < 3) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const res = await checkUsernameAvailable(cleanUsername);
        if (active) {
          if (res.available) {
            setUsernameStatus("available");
            setUsernameMessage(`@${cleanUsername} is available!`);
          } else {
            setUsernameStatus("taken");
            setUsernameMessage(
              res.message || "This username is already taken."
            );
          }
        }
      } catch {
        if (active) {
          setUsernameStatus("idle");
          setUsernameMessage(
            "We could not verify this username. Please try again."
          );
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [username]);

  // Validation before advancing
  const canProceedFromStep = (s: number) => {
    switch (s) {
      case 1: {
        return (
          name.trim().length >= 2 &&
          email.trim().includes("@") &&
          password.length >= 8
        );
      }
      case 2: {
        return (
          username.trim().length >= 3 &&
          usernameStatus === "available" &&
          city.trim().length > 0 &&
          stateValue.trim().length > 0
        );
      }
      case 3: {
        return selectedGenres.length >= 3;
      }
      case 4: {
        return true;
      }
      default: {
        return false;
      }
    }
  };

  const handleNext = () => {
    setErrorMessage(null);
    if (canProceedFromStep(step)) {
      setStep((prev) => Math.min(prev + 1, totalSteps));
    } else if (step === 3 && selectedGenres.length < 3) {
      setErrorMessage("Please select at least 3 favorite genres.");
    } else {
      setErrorMessage("Please complete all required fields on this step.");
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  // Final submission
  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (selectedGenres.length < 3) {
      setErrorMessage("Please select at least 3 genres.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9_-]/gu, "");

    try {
      if (!isAccountCreated) {
        if (isBioTurnstileConfigured && !turnstileToken) {
          setErrorMessage("Complete the security check before continuing.");
          return;
        }

        await signUpWithEmail(
          {
            email: email.trim(),
            name: name.trim(),
            password,
          },
          turnstileToken
        );
        setIsAccountCreated(true);
      }

      const result = await submitFanOnboarding({
        city: city.trim(),
        country: country.trim(),
        genrePreferences: selectedGenres,
        mediaLayout: "cards",
        selectedPlanCode,
        state: stateValue.trim(),
        username: cleanUsername,
      });

      // If user selected paid plan and received checkout URL, redirect to Stripe
      if (result && "checkoutUrl" in result && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      // Fan onboarding completes and navigates directly to / (home page)
      navigate({ to: "/" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not complete your signup. Please try again."
      );
      setTurnstileToken("");
      setTurnstileResetKey((current) => current + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full space-y-6">
        {/* Navigation & Progress */}
        <div className="flex items-center justify-between">
          {step > 1 ? (
            <button
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleBack}
              type="button"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <a
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              href="/signup"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to choices</span>
            </a>
          )}

          <span className="text-xs font-mono text-muted-foreground">
            Step {step} of {totalSteps}
          </span>
        </div>

        {/* Step Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Main Card Container */}
        <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/60 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
          {errorMessage ? (
            <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <Info className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {/* Step 1: Account Credentials */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                  <Headphones className="size-3.5" />
                  <span>Fan / Listener Account</span>
                </div>
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Create your fan account
                </h2>
                <p className="text-xs text-muted-foreground">
                  Stream music, support independent artists, and explore
                  regional discovery.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="fan-name"
                  >
                    Your Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="fan-name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      type="text"
                      value={name}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="fan-email"
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="fan-email"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="fan@musiclover.com"
                      required
                      type="email"
                      value={email}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="fan-password"
                  >
                    Password (min 8 characters) *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="fan-password"
                      minLength={8}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      type="password"
                      value={password}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Handle & Location */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Pick your handle & city
                </h2>
                <p className="text-xs text-muted-foreground">
                  Personalize your profile and discover music emerging around
                  your location.
                </p>
              </div>

              <div className="space-y-3.5 pt-1">
                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="fan-username"
                  >
                    Username *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      @
                    </span>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-9 pr-10 text-sm font-semibold text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="fan-username"
                      onChange={(e) =>
                        setUsername(
                          e.target.value
                            .toLowerCase()
                            .replaceAll(/[^a-z0-9_-]/gu, "")
                        )
                      }
                      placeholder="username"
                      required
                      type="text"
                      value={username}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {usernameStatus === "checking" ? (
                        <LoaderCircle className="size-4 animate-spin text-primary" />
                      ) : usernameStatus === "available" ? (
                        <Check className="size-4 text-green-400" />
                      ) : usernameStatus === "taken" ? (
                        <XCircle className="size-4 text-destructive" />
                      ) : null}
                    </div>
                  </div>

                  {usernameMessage ? (
                    <p
                      className={`mt-1.5 text-xs ${
                        usernameStatus === "available"
                          ? "text-green-400"
                          : "text-destructive"
                      }`}
                    >
                      {usernameMessage}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                      htmlFor="fan-city"
                    >
                      City *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                        id="fan-city"
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Little Rock"
                        required
                        type="text"
                        value={city}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                      htmlFor="fan-state"
                    >
                      State / Province *
                    </label>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="fan-state"
                      onChange={(e) => setStateValue(e.target.value)}
                      placeholder="e.g. AR"
                      required
                      type="text"
                      value={stateValue}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="fan-country"
                  >
                    Country *
                  </label>
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                    id="fan-country"
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States"
                    required
                    type="text"
                    value={country}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Favorite Genres */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Favorite Genres
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select at least 3 genres you enjoy listening to.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {availableGenres.map((g) => {
                  const selected = selectedGenres.includes(g);
                  return (
                    <button
                      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow"
                          : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                      }`}
                      key={g}
                      onClick={() => toggleGenre(g)}
                      type="button"
                    >
                      {selected ? (
                        <Check className="size-3 stroke-[3]" />
                      ) : null}
                      <span>{g}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                {selectedGenres.length >= 3 ? (
                  <span className="text-green-400 font-semibold">
                    ✓ {selectedGenres.length} genres selected
                  </span>
                ) : (
                  <span>
                    Select {3 - selectedGenres.length} more genre
                    {3 - selectedGenres.length === 1 ? "" : "s"} to continue
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Step 4: Plan Selection */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Choose your fan plan
                </h2>
                <p className="text-xs text-muted-foreground">
                  Free forever, or upgrade to SoundKit Premium Fan for lossless
                  audio and supporter badges.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Free Fan Plan */}
                <button
                  className={`flex flex-col text-left rounded-3xl border p-5 transition-all ${
                    selectedPlanCode === "fan_free"
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border/60 bg-background/60 hover:border-border"
                  }`}
                  onClick={() => setSelectedPlanCode("fan_free")}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">
                      Fan Free
                    </span>
                    {selectedPlanCode === "fan_free" ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : null}
                  </div>
                  <div className="mt-2 text-2xl font-black text-foreground">
                    $0{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      /month
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-muted-foreground flex-1">
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Stream releases across all bios</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Send tips to artists</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Bookmark favorite tracks</span>
                    </li>
                  </ul>
                </button>

                {/* Premium Fan Plan */}
                <button
                  className={`flex flex-col text-left rounded-3xl border p-5 transition-all ${
                    selectedPlanCode === "soundkit_premium_fan"
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border/60 bg-background/60 hover:border-border"
                  }`}
                  onClick={() => setSelectedPlanCode("soundkit_premium_fan")}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-primary">
                      Premium Fan
                    </span>
                    {selectedPlanCode === "soundkit_premium_fan" ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : null}
                  </div>
                  <div className="mt-2 text-2xl font-black text-foreground">
                    $5{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      /month
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-muted-foreground flex-1">
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Lossless audio streaming</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>VIP supporter badge on bios</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Offline listening on mobile</span>
                    </li>
                  </ul>
                </button>
              </div>
            </div>
          )}

          <BioTurnstile
            onTokenChange={setTurnstileToken}
            resetKey={turnstileResetKey}
          />

          {/* Action Navigation Buttons */}
          <div className="mt-8 flex items-center justify-between pt-4 border-t border-border/40">
            {step > 1 ? (
              <button
                className="rounded-full border border-border/60 bg-white/5 px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-white/10 transition-colors"
                onClick={handleBack}
                type="button"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition-all active:scale-95"
                onClick={handleNext}
                type="button"
              >
                <span>Continue</span>
                <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                disabled={isSubmitting || selectedGenres.length < 3}
                onClick={() => handleSubmit()}
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Complete Signup</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
