/* eslint-disable one-var, sort-vars, sort-keys, complexity, eqeqeq, no-eq-null, no-nested-ternary, react-hooks/set-state-in-render, react/set-state-in-effect, no-lonely-if, node/callback-return, no-void */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AuthErrorBanner,
  AuthPrimaryButton,
  AuthShell,
  AuthTextInput,
  getAuthErrorMessage,
} from "@/components/auth/auth-shell";
import { API_V1_URL } from "@/lib/api";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useGenresQuery } from "@/lib/soundkit-api";

const ARTIST_TOTAL_STEPS = 8,
  FAN_TOTAL_STEPS = 4,
  RIGHTS_ATTESTATION_VERSION = "2026-01",
  USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/u;

type ArtistRole = "musician" | "producer";
type PlanCode =
  | "artist_free"
  | "fan_free"
  | "soundkit_premium_artist"
  | "soundkit_premium_fan";

interface OnboardingResponse {
  checkoutUrl: null | string;
  message: null | string;
  requiresCheckout: boolean;
  setupRequired: boolean;
  workspaceId: null | string;
}

interface OnboardingDraft {
  appleMusicUrl: string;
  city: string;
  country: string;
  creatorEligibility: "independent" | "major_label_affiliated";
  genrePreferences: string[];
  instagramHandle: string;
  primaryGenre: null | string;
  roles: ArtistRole[];
  selectedPlanCode: PlanCode;
  spotifyUrl: string;
  state: string;
  tiktokHandle: string;
  twitterHandle: string;
  username: string;
  youtubeUrl: string;
}

const emptyDraft: OnboardingDraft = {
  appleMusicUrl: "",
  city: "",
  country: "",
  creatorEligibility: "independent",
  genrePreferences: [],
  instagramHandle: "",
  primaryGenre: null,
  roles: [],
  selectedPlanCode: "artist_free",
  spotifyUrl: "",
  state: "",
  tiktokHandle: "",
  twitterHandle: "",
  username: "",
  youtubeUrl: "",
};

const postState = async (body: Record<string, unknown>) => {
  try {
    await authenticatedFetch(`${API_V1_URL}/onboarding/state`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // Best-effort step persistence.
  }
};

export default function OnboardingScreen() {
  const router = useRouter(),
    { type } = useLocalSearchParams<{ type?: string }>(),
    accountType = type === "fan" ? "fan" : "artist",
    totalSteps =
      accountType === "artist" ? ARTIST_TOTAL_STEPS : FAN_TOTAL_STEPS,
    genresQuery = useGenresQuery(),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState<OnboardingDraft>(emptyDraft),
    [rightsAttested, setRightsAttested] = useState(false),
    [mediaLayout, setMediaLayout] = useState<"cards" | "list">("cards"),
    [error, setError] = useState<null | string>(null),
    [busy, setBusy] = useState(false),
    [usernameStatus, setUsernameStatus] = useState<null | {
      available: boolean;
      message: string;
    }>(null),
    [exiting, setExiting] = useState(false),
    usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resume the saved step (server persists it; fields stay local like web's
  // localStorage draft).
  useEffect(() => {
    void (async () => {
      try {
        const response = await authenticatedFetch(
          `${API_V1_URL}/onboarding/state`
        );
        if (response.ok) {
          const state = (await response.json()) as {
            currentStep?: number;
            intendedAccountType?: string;
          } | null;
          if (
            state?.currentStep &&
            state.intendedAccountType === accountType &&
            state.currentStep >= 1 &&
            state.currentStep <= totalSteps
          ) {
            setStep(state.currentStep);
          }
        }
      } catch {
        // Resume is best-effort.
      }
    })();
  }, [accountType, totalSteps]);

  // Debounced username availability.
  useEffect(() => {
    const normalized = draft.username.trim().replace(/^@/u, "").toLowerCase();
    if (accountType === "artist" && step === 3) {
      // artist username step
    } else if (accountType === "fan" && step === 1) {
      // fan username step
    } else {
      return;
    }
    if (usernameDebounceRef.current) {
      clearTimeout(usernameDebounceRef.current);
    }
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameStatus(
        normalized.length === 0
          ? null
          : {
              available: false,
              message: "Use 3–32 letters, numbers, or underscores.",
            }
      );
      return;
    }
    setUsernameStatus(null);
    usernameDebounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const response = await authenticatedFetch(
            `${API_V1_URL}/onboarding/username-availability?username=${encodeURIComponent(normalized)}`
          );
          if (response.ok) {
            const payload = (await response.json()) as {
              available: boolean;
              message: string;
            };
            setUsernameStatus({
              available: payload.available,
              message: payload.message,
            });
          }
        } catch {
          // Availability is advisory; the server re-checks on submit.
        }
      })();
    }, 400);
    return () => {
      if (usernameDebounceRef.current) {
        clearTimeout(usernameDebounceRef.current);
      }
    };
  }, [accountType, draft.username, step]);

  const patchDraft = (patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const stepTitles: Record<number, string> =
    accountType === "artist"
      ? {
          1: "What do you do?",
          2: "Your eligibility",
          3: "Claim your username",
          4: "Add a profile photo",
          5: "Where are you based?",
          6: "Your primary genre",
          7: "Where can people find you?",
          8: "Pick your plan",
        }
      : {
          1: "Claim your username",
          2: "Pick your genres",
          3: "Where are you based?",
          4: "Pick your plan",
        };

  const validateStep = (current: number): null | string => {
    if (accountType === "artist") {
      if (current === 1 && draft.roles.length === 0) {
        return "Pick at least one role.";
      }
      if (current === 3) {
        if (!USERNAME_PATTERN.test(draft.username)) {
          return "Use 3–32 letters, numbers, or underscores.";
        }
        if (usernameStatus && !usernameStatus.available) {
          return usernameStatus.message;
        }
      }
      if (current === 5) {
        if (!draft.city || !draft.state || !draft.country) {
          return "Add your city, state, and country.";
        }
      }
      if (current === 6 && !draft.primaryGenre) {
        return "Pick your primary genre.";
      }
      if (current === 8 && !rightsAttested) {
        return "Attest that you own or control the rights to your music.";
      }
    } else {
      if (current === 1) {
        if (!USERNAME_PATTERN.test(draft.username)) {
          return "Use 3–32 letters, numbers, or underscores.";
        }
        if (usernameStatus && !usernameStatus.available) {
          return usernameStatus.message;
        }
      }
      if (current === 2 && draft.genrePreferences.length < 3) {
        return "Pick at least 3 genres you love.";
      }
      if (current === 3 && (!draft.city || !draft.state || !draft.country)) {
        return "Add your city, state, and country.";
      }
    }
    return null;
  };

  const next = async () => {
    setError(null);
    const validation = validateStep(step);
    if (validation) {
      setError(validation);
      return;
    }
    const nextStep = step + 1;

    // Artist eligibility: major label routes to fan onboarding, like web.
    if (accountType === "artist" && step === 2) {
      if (draft.creatorEligibility === "major_label_affiliated") {
        setBusy(true);
        try {
          await authenticatedFetch(`${API_V1_URL}/onboarding/eligibility`, {
            body: JSON.stringify({
              eligibility: "major_label_affiliated",
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
        } catch {
          // Server re-checks eligibility on submit anyway.
        }
        setBusy(false);
        router.replace("/signup/onboarding?type=fan");
        return;
      }
    }

    if (nextStep <= totalSteps) {
      setStep(nextStep);
      void postState({
        creatorEligibility: draft.creatorEligibility,
        currentStep: nextStep,
        intendedAccountType: accountType,
        selectedPlanCode: draft.selectedPlanCode,
      });
      return;
    }
    await finish();
  };

  const back = () => {
    setError(null);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const endpoint =
        accountType === "artist"
          ? `${API_V1_URL}/onboarding/artist`
          : `${API_V1_URL}/onboarding/fan`;
      const body =
        accountType === "artist"
          ? {
              appleMusicUrl: draft.appleMusicUrl || undefined,
              city: draft.city,
              country: draft.country,
              creatorEligibility: draft.creatorEligibility,
              instagramHandle: draft.instagramHandle || undefined,
              mediaLayout,
              primaryGenre: draft.primaryGenre,
              rightsAttested: true,
              rightsAttestationVersion: RIGHTS_ATTESTATION_VERSION,
              roles: draft.roles,
              selectedPlanCode: draft.selectedPlanCode,
              spotifyUrl: draft.spotifyUrl || undefined,
              state: draft.state,
              tiktokHandle: draft.tiktokHandle || undefined,
              twitterHandle: draft.twitterHandle || undefined,
              username: draft.username,
              youtubeUrl: draft.youtubeUrl || undefined,
            }
          : {
              city: draft.city,
              country: draft.country,
              genrePreferences: draft.genrePreferences,
              mediaLayout,
              returnPath: "/",
              selectedPlanCode: draft.selectedPlanCode,
              state: draft.state,
              username: draft.username,
            };
      const response = await authenticatedFetch(endpoint, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | (OnboardingResponse & { message?: string })
        | null;
      if (!response.ok) {
        setError(
          payload?.message ?? "We could not complete your setup. Try again."
        );
        return;
      }
      if (payload?.checkoutUrl) {
        void Linking.openURL(payload.checkoutUrl);
      }
      setBusy(false);
      router.replace(accountType === "artist" ? "/dashboard" : "/");
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
      setBusy(false);
    }
  };

  const exitForLater = async () => {
    setExiting(true);
    try {
      await postState({ currentStep: step, intendedAccountType: accountType });
      await authenticatedFetch(`${API_V1_URL}/onboarding/exit`, {
        method: "POST",
      });
    } catch {
      // Exit is best-effort.
    }
    router.replace("/");
  };

  const genres = genresQuery.data ?? [];

  return (
    <View style={{ backgroundColor: "#020202", flex: 1 }}>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: "#020202" },
          headerTintColor: "#F8F8F8",
          title: accountType === "artist" ? "Artist Setup" : "Fan Setup",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: "#020202", flex: 1 }}
      >
        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(step / totalSteps) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            Step {step} of {totalSteps}
          </Text>
        </View>

        <AuthShell title={stepTitles[step] ?? "Set up your account"}>
          <AuthErrorBanner message={error} />

          {/* Artist step 1: roles */}
          {accountType === "artist" && step === 1 ? (
            <View style={styles.choiceGrid}>
              {(["musician", "producer"] as ArtistRole[]).map((role) => {
                const selected = draft.roles.includes(role);
                return (
                  <Pressable
                    accessibilityHint={`Toggles ${role}`}
                    accessibilityLabel={role}
                    accessibilityRole="button"
                    key={role}
                    onPress={() => {
                      patchDraft({
                        roles: selected
                          ? draft.roles.filter((item) => item !== role)
                          : [...draft.roles, role],
                      });
                    }}
                    style={[
                      styles.choiceCard,
                      selected && styles.choiceCardActive,
                    ]}
                  >
                    <Ionicons
                      color={selected ? "#B8A3FF" : "#8F8F8F"}
                      name={
                        role === "musician" ? "mic-outline" : "create-outline"
                      }
                      size={26}
                    />
                    <Text
                      style={[
                        styles.choiceTitle,
                        selected && { color: "#B8A3FF" },
                      ]}
                    >
                      {role === "musician" ? "Musician" : "Producer"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Artist step 2: eligibility */}
          {accountType === "artist" && step === 2 ? (
            <View style={styles.choiceStack}>
              {[
                {
                  description: "Not signed to a major label or its affiliate.",
                  icon: "shield-checkmark-outline" as const,
                  label: "I'm independent",
                  value: "independent" as const,
                },
                {
                  description:
                    "Major-affiliated artists use SoundKit as a fan for now.",
                  icon: "business-outline" as const,
                  label: "I'm major-label affiliated",
                  value: "major_label_affiliated" as const,
                },
              ].map((option) => {
                const selected = draft.creatorEligibility === option.value;
                return (
                  <Pressable
                    accessibilityLabel={option.label}
                    accessibilityRole="button"
                    key={option.value}
                    onPress={() => {
                      patchDraft({ creatorEligibility: option.value });
                    }}
                    style={[
                      styles.eligibilityCard,
                      selected && styles.choiceCardActive,
                    ]}
                  >
                    <Ionicons
                      color={selected ? "#B8A3FF" : "#8F8F8F"}
                      name={option.icon}
                      size={22}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.choiceTitle}>{option.label}</Text>
                      <Text style={styles.choiceDescription}>
                        {option.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Username step (artist 3 / fan 1) */}
          {((accountType === "artist" && step === 3) ||
            (accountType === "fan" && step === 1)) && (
            <>
              <AuthTextInput
                onChangeText={(value) => {
                  patchDraft({ username: value });
                }}
                placeholder="username"
                value={draft.username}
              />
              {usernameStatus ? (
                <View style={styles.usernameStatusRow}>
                  <Ionicons
                    color={usernameStatus.available ? "#4ADE80" : "#E05D4D"}
                    name={
                      usernameStatus.available
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={15}
                  />
                  <Text
                    style={[
                      styles.usernameStatusText,
                      {
                        color: usernameStatus.available ? "#4ADE80" : "#E05D4D",
                      },
                    ]}
                  >
                    {usernameStatus.message}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.fieldHint}>
                3–32 letters, numbers, or underscores. This is your handle on
                SoundKit.
              </Text>
            </>
          )}

          {/* Artist step 4: avatar */}
          {accountType === "artist" && step === 4 ? (
            <View style={styles.avatarSkip}>
              <Ionicons color="#8F8F8F" name="image-outline" size={30} />
              <Text style={styles.avatarSkipText}>
                Profile photos can be uploaded from your dashboard settings once
                you&apos;re set up — continue for now.
              </Text>
            </View>
          ) : null}

          {/* Location step (artist 5 / fan 3) */}
          {((accountType === "artist" && step === 5) ||
            (accountType === "fan" && step === 3)) && (
            <>
              <AuthTextInput
                autoCapitalize="sentences"
                onChangeText={(value) => {
                  patchDraft({ city: value });
                }}
                placeholder="City"
                value={draft.city}
              />
              <AuthTextInput
                autoCapitalize="sentences"
                onChangeText={(value) => {
                  patchDraft({ state: value });
                }}
                placeholder="State / Province"
                value={draft.state}
              />
              <AuthTextInput
                autoCapitalize="sentences"
                onChangeText={(value) => {
                  patchDraft({ country: value });
                }}
                placeholder="Country"
                value={draft.country}
              />
            </>
          )}

          {/* Genre step (artist 6 single / fan 2 multi) */}
          {(accountType === "artist" && step === 6) ||
          (accountType === "fan" && step === 2) ? (
            genresQuery.isLoading ? (
              <ActivityIndicator color="#B8A3FF" style={{ padding: 16 }} />
            ) : (
              <View style={styles.genreGrid}>
                {genres.map((genre) => {
                  const selected =
                    accountType === "fan"
                      ? draft.genrePreferences.includes(genre.slug)
                      : draft.primaryGenre === genre.slug;
                  return (
                    <Pressable
                      accessibilityHint={`Toggles ${genre.name}`}
                      accessibilityLabel={genre.name}
                      accessibilityRole="button"
                      key={genre.id}
                      onPress={() => {
                        if (accountType === "fan") {
                          patchDraft({
                            genrePreferences: selected
                              ? draft.genrePreferences.filter(
                                  (slug) => slug !== genre.slug
                                )
                              : [...draft.genrePreferences, genre.slug],
                          });
                        } else {
                          patchDraft({ primaryGenre: genre.slug });
                        }
                      }}
                      style={[
                        styles.genreChip,
                        selected && styles.genreChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.genreChipText,
                          selected && { color: "#171717" },
                        ]}
                      >
                        {genre.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : null}

          {/* Artist step 7: links */}
          {accountType === "artist" && step === 7 ? (
            <>
              <AuthTextInput
                keyboardType="default"
                onChangeText={(value) => {
                  patchDraft({ spotifyUrl: value });
                }}
                placeholder="Spotify artist URL"
                value={draft.spotifyUrl}
              />
              <AuthTextInput
                onChangeText={(value) => {
                  patchDraft({ appleMusicUrl: value });
                }}
                placeholder="Apple Music URL"
                value={draft.appleMusicUrl}
              />
              <AuthTextInput
                onChangeText={(value) => {
                  patchDraft({ youtubeUrl: value });
                }}
                placeholder="YouTube channel URL"
                value={draft.youtubeUrl}
              />
              <AuthTextInput
                onChangeText={(value) => {
                  patchDraft({ instagramHandle: value });
                }}
                placeholder="Instagram handle"
                value={draft.instagramHandle}
              />
              <AuthTextInput
                onChangeText={(value) => {
                  patchDraft({ tiktokHandle: value });
                }}
                placeholder="TikTok handle"
                value={draft.tiktokHandle}
              />
              <AuthTextInput
                onChangeText={(value) => {
                  patchDraft({ twitterHandle: value });
                }}
                placeholder="X (Twitter) handle"
                value={draft.twitterHandle}
              />
            </>
          ) : null}

          {/* Plan step (artist 8 / fan 4) */}
          {((accountType === "artist" && step === 8) ||
            (accountType === "fan" && step === 4)) && (
            <>
              <View style={styles.choiceGrid}>
                {(accountType === "artist"
                  ? [
                      {
                        description: "Everything you need to start.",
                        label: "Free",
                        value: "artist_free" as PlanCode,
                      },
                      {
                        description: "Premium tools, insights, and reach.",
                        label: "Premium Artist",
                        value: "soundkit_premium_artist" as PlanCode,
                      },
                    ]
                  : [
                      {
                        description: "Discover and enjoy SoundKit.",
                        label: "Free",
                        value: "fan_free" as PlanCode,
                      },
                      {
                        description: "Premium listening with no ads.",
                        label: "Premium Fan",
                        value: "soundkit_premium_fan" as PlanCode,
                      },
                    ]
                ).map((plan) => {
                  const selected = draft.selectedPlanCode === plan.value;
                  return (
                    <Pressable
                      accessibilityLabel={plan.label}
                      accessibilityRole="button"
                      key={plan.value}
                      onPress={() => {
                        patchDraft({ selectedPlanCode: plan.value });
                      }}
                      style={[
                        styles.choiceCard,
                        selected && styles.choiceCardActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceTitle,
                          selected && { color: "#B8A3FF" },
                        ]}
                      >
                        {plan.label}
                      </Text>
                      <Text style={styles.choiceDescription}>
                        {plan.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.layoutRow}>
                {(["cards", "list"] as const).map((layout) => (
                  <Pressable
                    accessibilityLabel={`${layout} layout`}
                    accessibilityRole="button"
                    key={layout}
                    onPress={() => {
                      setMediaLayout(layout);
                    }}
                    style={[
                      styles.layoutChip,
                      mediaLayout === layout && styles.genreChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.genreChipText,
                        mediaLayout === layout && { color: "#171717" },
                      ]}
                    >
                      {layout === "cards" ? "Card grid" : "List"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldHint}>
                How should your music be displayed?
              </Text>

              {accountType === "artist" ? (
                <Pressable
                  accessibilityHint="Toggles rights attestation"
                  accessibilityLabel="Rights attestation"
                  accessibilityRole="checkbox"
                  onPress={() => {
                    setRightsAttested((prev) => !prev);
                  }}
                  style={styles.optInRow}
                >
                  <Ionicons
                    color={rightsAttested ? "#B8A3FF" : "#8F8F8F"}
                    name={rightsAttested ? "checkbox" : "square-outline"}
                    size={20}
                  />
                  <Text style={styles.attestText}>
                    I own or control the rights to the music I upload, and I
                    agree to SoundKit&apos;s terms.
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}

          {/* Controls */}
          <View style={styles.controlsRow}>
            {step > 1 ? (
              <Pressable
                accessibilityLabel="Previous step"
                accessibilityRole="button"
                hitSlop={8}
                onPress={back}
                style={styles.backChip}
              >
                <Ionicons color="#F8F8F8" name="chevron-back" size={18} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <AuthPrimaryButton
                busy={busy}
                label={step === totalSteps ? "Finish Setup" : "Continue"}
                onPress={() => {
                  void next();
                }}
              />
            </View>
          </View>

          <Pressable
            accessibilityLabel="Finish later"
            accessibilityRole="button"
            disabled={exiting}
            onPress={() => {
              void exitForLater();
            }}
            style={{ alignItems: "center", marginTop: 14 }}
          >
            <Text style={styles.exitText}>Finish later</Text>
          </Pressable>
        </AuthShell>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  attestText: {
    color: "#8F8F8F",
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  avatarSkip: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 22,
  },
  avatarSkipText: {
    color: "#8F8F8F",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  backChip: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    marginRight: 10,
    width: 46,
  },
  choiceCard: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 18,
  },
  choiceCardActive: {
    backgroundColor: "rgba(184, 163, 255, 0.12)",
    borderColor: "#B8A3FF",
  },
  choiceDescription: {
    color: "#8F8F8F",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  choiceGrid: {
    flexDirection: "row",
    gap: 12,
  },
  choiceStack: { gap: 12 },
  choiceTitle: {
    color: "#F8F8F8",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  controlsRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  eligibilityCard: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  exitText: {
    color: "#8F8F8F",
    fontSize: 13,
    fontWeight: "700",
  },
  fieldHint: {
    color: "#8F8F8F",
    fontSize: 12,
    lineHeight: 16,
  },
  genreChip: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  genreChipActive: {
    backgroundColor: "#B8A3FF",
    borderColor: "#B8A3FF",
  },
  genreChipText: {
    color: "#F8F8F8",
    fontSize: 13,
    fontWeight: "700",
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  layoutChip: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  layoutRow: {
    flexDirection: "row",
    gap: 10,
  },
  optInRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  progressFill: {
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    height: "100%",
  },
  progressLabel: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 10,
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 4,
  },
  progressTrack: {
    backgroundColor: "#111111",
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  scrollContent: {
    paddingBottom: 48,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  usernameStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  usernameStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
