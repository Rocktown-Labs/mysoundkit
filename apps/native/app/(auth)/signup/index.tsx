/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AuthDivider,
  AuthErrorBanner,
  AuthGoogleButton,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthShell,
  AuthTextInput,
  getAuthErrorMessage,
  useTurnstileToken,
} from "@/components/auth/auth-shell";
import { API_V1_URL, WEB_PUBLIC_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const ACCOUNT_TYPES = [
    {
      bullets: [
        "Upload & release music",
        "Sell tracks & kits",
        "Battle & stream live",
      ],
      cta: "Continue as Artist",
      description: "Release music, build your audience, and earn directly.",
      icon: "mic-outline" as const,
      label: "I'm an Artist",
      type: "artist" as const,
    },
    {
      bullets: [
        "Discover public releases",
        "Follow favorite artists",
        "Save & buy music",
      ],
      cta: "Continue as Fan",
      description:
        "Discover new music, support artists, and build your library.",
      icon: "people-outline" as const,
      label: "I'm a Fan",
      type: "fan" as const,
    },
  ],
  EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u,
  MARKETING_OPT_IN_VERSION = "2026-01";

export default function SignupScreen() {
  const router = useRouter(),
    { data: session } = authClient.useSession(),
    turnstile = useTurnstileToken("signup"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [acceptedTerms, setAcceptedTerms] = useState(false),
    [marketingOptIn, setMarketingOptIn] = useState(false),
    [step, setStep] = useState<"credentials" | "path">("credentials"),
    [selectingType, setSelectingType] = useState<"artist" | "fan" | null>(null),
    [error, setError] = useState<null | string>(null),
    [busy, setBusy] = useState(false),
    showPathChooser = step === "path" || Boolean(session?.user);

  const selectAccountPath = async (accountType: "artist" | "fan") => {
    setBusy(true);
    setSelectingType(accountType);
    setError(null);
    try {
      await authenticatedFetch(`${API_V1_URL}/onboarding/state`, {
        body: JSON.stringify({
          currentStep: 1,
          intendedAccountType: accountType,
          marketingOptIn,
          marketingOptInSource: "credentials",
          marketingOptInVersion: MARKETING_OPT_IN_VERSION,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch {
      // Best-effort onboarding state persistence.
    }
    setBusy(false);
    setSelectingType(null);
    router.replace(`/signup/onboarding?type=${accountType}`);
  };

  const submitCredentials = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Check both password fields.");
      return;
    }
    if (!acceptedTerms) {
      setError(
        "Agree to SoundKit's Terms of Service and Privacy Policy to continue."
      );
      return;
    }
    const tokenError = turnstile.ensureToken();
    if (tokenError) {
      setError(tokenError);
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.signUp.email(
        {
          email: trimmedEmail,
          name: "SoundKit Member",
          password,
        },
        { headers: turnstile.headers() }
      );
      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        turnstile.reset();
        setBusy(false);
        return;
      }
      setBusy(false);
      setStep("path");
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
      turnstile.reset();
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      style={styles.page}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {showPathChooser ? (
        <AuthShell
          subtitle="Choose how you want to use the platform."
          title="Choose Your Path"
        >
          <AuthErrorBanner message={error} />
          <View style={styles.cardsRow}>
            {ACCOUNT_TYPES.map((accountType) => {
              const isSelecting = selectingType === accountType.type;
              return (
                <Pressable
                  accessibilityHint={`Continues onboarding as ${accountType.type}`}
                  accessibilityLabel={accountType.label}
                  accessibilityRole="button"
                  disabled={busy}
                  key={accountType.type}
                  onPress={() => {
                    void selectAccountPath(accountType.type);
                  }}
                  style={({ pressed }) => [
                    styles.roleCard,
                    pressed && {
                      borderColor: "#B8A3FF",
                      opacity: 0.92,
                      transform: [{ scale: 0.99 }],
                    },
                  ]}
                >
                  <View style={styles.cardIconWrap}>
                    <Ionicons
                      color="#B8A3FF"
                      name={accountType.icon}
                      size={22}
                    />
                  </View>
                  <Text style={styles.cardTitle}>{accountType.label}</Text>
                  <Text style={styles.cardDescription}>
                    {accountType.description}
                  </Text>
                  <View style={styles.bulletList}>
                    {accountType.bullets.map((bullet) => (
                      <View key={bullet} style={styles.bulletRow}>
                        <Text style={styles.bulletCheck}>✓</Text>
                        <Text numberOfLines={1} style={styles.bulletText}>
                          {bullet}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.cardCtaButton}>
                    <Text numberOfLines={1} style={styles.cardCtaText}>
                      {isSelecting ? "Continuing…" : accountType.cta}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </AuthShell>
      ) : (
        <AuthShell subtitle="Get started for free" title="Join SoundKit">
          <AuthGoogleButton
            callbackURL="/signup"
            disabled={busy}
            onError={setError}
          />
          <AuthDivider label="or use email" />
          <AuthErrorBanner message={error} />
          <AuthTextInput
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="you@example.com"
            value={email}
          />
          <AuthPasswordField
            autoComplete="new-password"
            label="Password"
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            value={password}
          />
          <Text style={styles.passwordHint}>
            Use at least 8 characters. A passphrase is easiest to remember.
          </Text>
          <AuthPasswordField
            autoComplete="new-password"
            label="Confirm password"
            onChangeText={setConfirmPassword}
            onSubmitEditing={() => {
              void submitCredentials();
            }}
            placeholder="Repeat your password"
            value={confirmPassword}
          />
          <Pressable
            accessibilityHint="Accepts Terms of Service and Privacy Policy"
            accessibilityLabel="Agree to Terms of Service and Privacy Policy"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            onPress={() => {
              setAcceptedTerms((prev) => !prev);
            }}
            style={styles.optInRow}
          >
            <Ionicons
              color={acceptedTerms ? "#B8A3FF" : "#71717A"}
              name={acceptedTerms ? "checkbox" : "square-outline"}
              size={18}
            />
            <Text style={styles.optInText}>
              I agree to SoundKit&apos;s{" "}
              <Text
                onPress={() => {
                  void Linking.openURL(`${WEB_PUBLIC_URL}/terms`);
                }}
                style={styles.inlineLink}
              >
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text
                onPress={() => {
                  void Linking.openURL(`${WEB_PUBLIC_URL}/privacy`);
                }}
                style={styles.inlineLink}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </Pressable>
          <Pressable
            accessibilityHint="Toggles marketing email updates"
            accessibilityLabel="Marketing updates"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marketingOptIn }}
            onPress={() => {
              setMarketingOptIn((prev) => !prev);
            }}
            style={styles.optInRow}
          >
            <Ionicons
              color={marketingOptIn ? "#B8A3FF" : "#71717A"}
              name={marketingOptIn ? "checkbox" : "square-outline"}
              size={18}
            />
            <Text style={styles.optInText}>
              Send me SoundKit product updates, onboarding tips, and occasional
              offers.
            </Text>
          </Pressable>
          {turnstile.bridge}
          <AuthPrimaryButton
            busy={busy}
            label={busy ? "Creating your account…" : "Create account"}
            onPress={() => {
              void submitCredentials();
            }}
          />
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account?</Text>
            <Link asChild href="/login">
              <Text style={styles.loginAction}>Sign in</Text>
            </Link>
          </View>
        </AuthShell>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bulletCheck: {
    color: "#B8A3FF",
    fontSize: 11,
    fontWeight: "700",
  },
  bulletList: {
    alignSelf: "stretch",
    gap: 5,
    marginTop: 4,
  },
  bulletRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  bulletText: {
    color: "#A1A1AA",
    flex: 1,
    fontSize: 11,
  },
  cardCtaButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: "auto",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  cardCtaText: {
    color: "#09090B",
    fontSize: 12,
    fontWeight: "700",
  },
  cardDescription: {
    color: "#A1A1AA",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  cardIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.12)",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  cardTitle: {
    color: "#FAFAFA",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  inlineLink: {
    color: "#B8A3FF",
    fontWeight: "600",
  },
  loginAction: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  loginPrompt: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  loginRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 6,
  },
  optInRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  optInText: {
    color: "#A1A1AA",
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  page: {
    backgroundColor: "#020202",
    flex: 1,
  },
  passwordHint: {
    color: "#71717A",
    fontSize: 11,
    marginTop: -6,
  },
  roleCard: {
    alignItems: "center",
    backgroundColor: "#050507",
    borderColor: "#27272A",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 12,
  },
  scroll: {
    flexGrow: 1,
  },
});
