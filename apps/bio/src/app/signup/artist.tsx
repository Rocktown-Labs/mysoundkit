/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/hook-use-state, react/set-state-in-effect */
"use client";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Mic2,
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
  getCurrentSessionUser,
  loadGenres,
  signUpWithEmail,
  submitArtistOnboarding,
} from "@/lib/api";

export const Route = createFileRoute("/signup/artist")({
  component: ArtistSignupPage,
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

const PRO_OPTIONS = [
  "None",
  "ASCAP",
  "BMI",
  "SESAC",
  "SOCAN",
  "PRS for Music",
  "GEMA",
  "SACEM",
  "Other",
];

function ArtistSignupPage() {
  const navigate = useNavigate();

  // Current onboarding step (1 to 7)
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  // Step 1: Credentials
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: Roles & Eligibility
  const [roles, setRoles] = useState<string[]>(["musician"]);
  const [creatorEligibility, setCreatorEligibility] = useState<
    "independent" | "major_label_affiliated"
  >("independent");

  // Step 3: Handle & Location
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [country, setCountry] = useState("United States");

  // Step 4: Genre
  const [availableGenres, setAvailableGenres] =
    useState<string[]>(DEFAULT_GENRES);
  const [primaryGenre, setPrimaryGenre] = useState("Hip-Hop");

  // Step 5: Streaming & Social Links
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");

  // Step 6: Songwriting & Rights
  const [songwriterLegalName, setSongwriterLegalName] = useState("");
  const [proAffiliation, setProAffiliation] = useState("None");
  const [proMemberId, setProMemberId] = useState("");
  const [rightsAttested, setRightsAttested] = useState(false);

  // Step 7: Plan Selection
  const [selectedPlanCode, setSelectedPlanCode] = useState<
    "artist_free" | "soundkit_premium_artist"
  >("artist_free");

  // Submission state
  const [isAccountCreated, setIsAccountCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");

  // Return artists with a completed claim to their Bio dashboard.
  useEffect(() => {
    let active = true;
    const redirectClaimedArtist = async () => {
      const user = await getCurrentSessionUser();
      if (
        active &&
        user?.accountType === "artist" &&
        user.onboardingCompletedAt
      ) {
        navigate({ to: "/dashboard" });
      }
    };
    void redirectClaimedArtist();
    return () => {
      active = false;
    };
  }, [navigate]);

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

  // Real-time username availability check
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
            setUsernameMessage(`soundkit.bio/${cleanUsername} is available!`);
          } else {
            setUsernameStatus("taken");
            setUsernameMessage(res.message || "This handle is already taken.");
          }
        }
      } catch {
        if (active) {
          setUsernameStatus("idle");
          setUsernameMessage(
            "We could not verify this handle. Please try again."
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
        return roles.length > 0 && creatorEligibility === "independent";
      }
      case 3: {
        return (
          username.trim().length >= 3 &&
          usernameStatus === "available" &&
          city.trim().length > 0 &&
          stateValue.trim().length > 0
        );
      }
      case 4: {
        return primaryGenre.trim().length > 0;
      }
      case 5: {
        return true;
      }
      case 6: {
        return rightsAttested;
      }
      case 7: {
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
    } else {
      setErrorMessage(
        step === 2 && creatorEligibility === "major_label_affiliated"
          ? "Major-label-controlled catalogs continue through Fan onboarding. Choose Independent / Indie-Controlled for an Artist account."
          : "Please complete all required fields on this step."
      );
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const toggleRole = (role: string) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Final submission
  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!rightsAttested) {
      setErrorMessage(
        "You must attest that you own or have permission for your music."
      );
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

      const result = await submitArtistOnboarding({
        appleMusicUrl: appleMusicUrl.trim() || undefined,
        city: city.trim(),
        country: country.trim(),
        creatorEligibility,
        instagramHandle: instagramHandle.trim() || undefined,
        mediaLayout: "cards",
        primaryGenre,
        proAffiliation: proAffiliation || "None",
        proMemberId: proMemberId.trim() || undefined,
        rightsAttestationVersion: "2026-01",
        rightsAttested,
        roles: roles.length > 0 ? roles : ["musician"],
        selectedPlanCode,
        songwriterLegalName: songwriterLegalName.trim() || undefined,
        spotifyUrl: spotifyUrl.trim() || undefined,
        state: stateValue.trim(),
        teamInviteEmails: [],
        tiktokHandle: tiktokHandle.trim() || undefined,
        twitterHandle: twitterHandle.trim() || undefined,
        username: cleanUsername,
        youtubeUrl: youtubeUrl.trim() || undefined,
      });

      if (typeof window !== "undefined") {
        sessionStorage.setItem("soundkit_bio_artist_username", cleanUsername);
      }

      // If user selected paid plan and received checkout URL, redirect to Stripe
      if (result && "checkoutUrl" in result && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      // Route to empty bio dashboard with setup banner directing to SoundKit Web
      navigate({ to: "/dashboard" });
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
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              to="/signup"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to choices</span>
            </Link>
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
                  <Mic2 className="size-3.5" />
                  <span>Artist Account</span>
                </div>
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Create your login
                </h2>
                <p className="text-xs text-muted-foreground">
                  Start by setting up your SoundKit account credentials.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-name"
                  >
                    Your Artist or Display Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Kendrick, Metro, Billie"
                      required
                      type="text"
                      value={name}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-email"
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-email"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="artist@recordlabel.com"
                      required
                      type="email"
                      value={email}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-password"
                  >
                    Password (min 8 characters) *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-password"
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

          {/* Step 2: Roles & Eligibility */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Your Role & Rights
                </h2>
                <p className="text-xs text-muted-foreground">
                  Tell us what best describes you and your catalog ownership.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <p className="block text-xs font-semibold text-muted-foreground mb-2">
                    Select Your Creator Roles *
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "musician", label: "Artist / Musician" },
                      { id: "producer", label: "Producer / Beatmaker" },
                    ].map((item) => (
                      <button
                        className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs font-semibold transition-all ${
                          roles.includes(item.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                        }`}
                        key={item.id}
                        onClick={() => toggleRole(item.id)}
                        type="button"
                      >
                        <span>{item.label}</span>
                        {roles.includes(item.id) ? (
                          <Check className="size-4 text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="block text-xs font-semibold text-muted-foreground">
                    Ownership & Label Affiliation *
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        desc: "I own, control, or have permission to stream and monetize my releases.",
                        id: "independent" as const,
                        title: "Independent / Indie-Controlled",
                      },
                      {
                        desc: "A major label or affiliate controls or must approve my recordings.",
                        id: "major_label_affiliated" as const,
                        title: "Major-Label Affiliated",
                      },
                    ].map((opt) => (
                      <button
                        className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
                          creatorEligibility === opt.id
                            ? "border-primary bg-primary/10"
                            : "border-border/60 bg-background/60 hover:border-border"
                        }`}
                        key={opt.id}
                        onClick={() => setCreatorEligibility(opt.id)}
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-semibold text-xs ${
                              creatorEligibility === opt.id
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {opt.title}
                          </span>
                          {creatorEligibility === opt.id ? (
                            <CheckCircle2 className="size-4 text-primary" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Handle & Location */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Claim your handle & city
                </h2>
                <p className="text-xs text-muted-foreground">
                  Your handle forms your unique bio URL and links you to
                  regional leaderboards.
                </p>
              </div>

              <div className="space-y-3.5 pt-1">
                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-username"
                  >
                    Custom Bio Handle *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      soundkit.bio/
                    </span>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-28 pr-10 text-sm font-semibold text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-username"
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
                      htmlFor="artist-city"
                    >
                      City *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                        id="artist-city"
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
                      htmlFor="artist-state"
                    >
                      State / Province *
                    </label>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-state"
                      onChange={(e) => setStateValue(e.target.value)}
                      placeholder="e.g. AR or Arkansas"
                      required
                      type="text"
                      value={stateValue}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-country"
                  >
                    Country *
                  </label>
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                    id="artist-country"
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

          {/* Step 4: Primary Genre */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Primary Genre
                </h2>
                <p className="text-xs text-muted-foreground">
                  Choose the genre that best categorizes your SoundKit catalog.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {availableGenres.map((g) => (
                  <button
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                      primaryGenre === g
                        ? "border-primary bg-primary text-primary-foreground shadow"
                        : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                    }`}
                    key={g}
                    onClick={() => setPrimaryGenre(g)}
                    type="button"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Streaming & Social Links */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Connect your profiles
                </h2>
                <p className="text-xs text-muted-foreground">
                  These links will display on your SoundKit Bio card (all
                  optional).
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-spotify"
                  >
                    Spotify Artist URL
                  </label>
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                    id="artist-spotify"
                    onChange={(e) => setSpotifyUrl(e.target.value)}
                    placeholder="https://open.spotify.com/artist/..."
                    type="url"
                    value={spotifyUrl}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-apple"
                  >
                    Apple Music URL
                  </label>
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                    id="artist-apple"
                    onChange={(e) => setAppleMusicUrl(e.target.value)}
                    placeholder="https://music.apple.com/artist/..."
                    type="url"
                    value={appleMusicUrl}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-youtube"
                  >
                    YouTube Channel URL
                  </label>
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                    id="artist-youtube"
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/@channel"
                    type="url"
                    value={youtubeUrl}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                      htmlFor="artist-ig"
                    >
                      Instagram Handle
                    </label>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-ig"
                      onChange={(e) => setInstagramHandle(e.target.value)}
                      placeholder="@handle"
                      type="text"
                      value={instagramHandle}
                    />
                  </div>

                  <div>
                    <label
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                      htmlFor="artist-tiktok"
                    >
                      TikTok Handle
                    </label>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-tiktok"
                      onChange={(e) => setTiktokHandle(e.target.value)}
                      placeholder="@handle"
                      type="text"
                      value={tiktokHandle}
                    />
                  </div>

                  <div>
                    <label
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                      htmlFor="artist-twitter"
                    >
                      X / Twitter
                    </label>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-twitter"
                      onChange={(e) => setTwitterHandle(e.target.value)}
                      placeholder="@handle"
                      type="text"
                      value={twitterHandle}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Songwriting & Rights Attestation */}
          {step === 6 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Rights & PRO Affiliation
                </h2>
                <p className="text-xs text-muted-foreground">
                  Protect your songwriting credits and verify ownership.
                </p>
              </div>

              <div className="space-y-3.5 pt-1">
                <div>
                  <label
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                    htmlFor="artist-songwriter"
                  >
                    Songwriter Legal Name (Optional)
                  </label>
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                    id="artist-songwriter"
                    onChange={(e) => setSongwriterLegalName(e.target.value)}
                    placeholder="Legal name for royalties / split sheets"
                    type="text"
                    value={songwriterLegalName}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                      htmlFor="artist-pro"
                    >
                      Performing Rights Org (PRO)
                    </label>
                    <select
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-pro"
                      onChange={(e) => setProAffiliation(e.target.value)}
                      value={proAffiliation}
                    >
                      {PRO_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                      htmlFor="artist-pro-id"
                    >
                      PRO Member / IPI Number
                    </label>
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/80 py-2.5 px-4 text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                      id="artist-pro-id"
                      onChange={(e) => setProMemberId(e.target.value)}
                      placeholder="e.g. 00812345678"
                      type="text"
                      value={proMemberId}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-3 pt-3">
                  <div className="flex items-start gap-3">
                    <input
                      checked={rightsAttested}
                      className="mt-1 size-4 rounded accent-primary text-primary"
                      id="artist-rights"
                      onChange={(e) => setRightsAttested(e.target.checked)}
                      type="checkbox"
                    />
                    <label
                      className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                      htmlFor="artist-rights"
                    >
                      <span className="font-semibold text-foreground">
                        Rights Attestation:
                      </span>{" "}
                      I certify that I own, hold licenses for, or control 100%
                      of the copyrights (master & composition) for all music I
                      publish or distribute via SoundKit.
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Plan Selection */}
          {step === 7 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-foreground">
                  Choose your plan
                </h2>
                <p className="text-xs text-muted-foreground">
                  Start free or unlock custom domain & priority regional
                  placement.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Free Plan */}
                <button
                  className={`flex flex-col text-left rounded-3xl border p-5 transition-all ${
                    selectedPlanCode === "artist_free"
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border/60 bg-background/60 hover:border-border"
                  }`}
                  onClick={() => setSelectedPlanCode("artist_free")}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">
                      Artist Free
                    </span>
                    {selectedPlanCode === "artist_free" ? (
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
                      <span>Custom soundkit.bio link</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Stream tracks & releases</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Direct fan tips & badges</span>
                    </li>
                  </ul>
                </button>

                {/* Premium Plan */}
                <button
                  className={`flex flex-col text-left rounded-3xl border p-5 transition-all ${
                    selectedPlanCode === "soundkit_premium_artist"
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border/60 bg-background/60 hover:border-border"
                  }`}
                  onClick={() => setSelectedPlanCode("soundkit_premium_artist")}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-primary">
                      Premium Artist
                    </span>
                    {selectedPlanCode === "soundkit_premium_artist" ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : null}
                  </div>
                  <div className="mt-2 text-2xl font-black text-foreground">
                    $15{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      /month
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-muted-foreground flex-1">
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Everything in Free</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>Priority regional discovery</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3 text-primary" />
                      <span>0% platform fee on fan tips</span>
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
                disabled={isSubmitting || !rightsAttested}
                onClick={() => handleSubmit()}
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>Setting up your Bio...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Claim Your Bio & Complete</span>
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
