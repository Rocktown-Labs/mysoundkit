/* oxlint-disable one-var, sort-vars, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AuthErrorBanner,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthShell,
  AuthTextInput,
  getAuthErrorMessage,
  useTurnstileToken,
} from "@/components/auth/auth-shell";
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const ACCOUNT_TYPES = [
    {
      description:
        "Release tracks, join battles, build your audience, and monetize your sound.",
      icon: "mic-outline" as const,
      label: "I'm an Artist",
      type: "artist" as const,
    },
    {
      description:
        "Discover new music, follow artists, join communities, and support the scene.",
      icon: "headset-outline" as const,
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
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [marketingOptIn, setMarketingOptIn] = useState(true),
    [step, setStep] = useState<"credentials" | "path">("credentials"),
    [error, setError] = useState<null | string>(null),
    [busy, setBusy] = useState(false),
    showPathChooser = step === "path" || Boolean(session?.user);

  const selectAccountPath = async (accountType: "artist" | "fan") => {
    setBusy(true);
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
    router.replace(`/signup/onboarding?type=${accountType}`);
  };

  const submitCredentials = async () => {
    setError(null);
    const trimmedName = name.trim(),
      trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
          name: trimmedName.length > 0 ? trimmedName : "SoundKit Member",
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
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: "#020202", flex: 1 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {showPathChooser ? (
        <AuthShell
          showGuestContinue={false}
          subtitle="Choose how you'll use SoundKit. You can always join the other side later."
          title="Choose Your Path"
        >
          <AuthErrorBanner message={error} />
          <View style={styles.cards}>
            {ACCOUNT_TYPES.map((accountType) => (
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
                  styles.card,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={styles.cardIconWrap}>
                  <Ionicons color="#B8A3FF" name={accountType.icon} size={26} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{accountType.label}</Text>
                  <Text style={styles.cardDescription}>
                    {accountType.description}
                  </Text>
                </View>
                <Ionicons color="#8F8F8F" name="chevron-forward" size={18} />
              </Pressable>
            ))}
          </View>
        </AuthShell>
      ) : (
        <AuthShell
          subtitle="Create your free SoundKit account first, then choose your artist or fan path."
          title="Create Account"
        >
          <AuthErrorBanner message={error} />
          <AuthTextInput
            autoCapitalize="words"
            autoComplete="name"
            onChangeText={setName}
            placeholder="Name (optional)"
            value={name}
          />
          <AuthTextInput
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            value={email}
          />
          <AuthPasswordField
            autoComplete="new-password"
            onChangeText={setPassword}
            placeholder="Password (at least 8 characters)"
            value={password}
          />
          <AuthPasswordField
            autoComplete="new-password"
            onChangeText={setConfirmPassword}
            onSubmitEditing={() => {
              void submitCredentials();
            }}
            placeholder="Confirm password"
            value={confirmPassword}
          />
          {turnstile.bridge}
          <Pressable
            accessibilityHint="Toggles marketing email updates"
            accessibilityLabel="Marketing updates"
            accessibilityRole="checkbox"
            onPress={() => {
              setMarketingOptIn((prev) => !prev);
            }}
            style={styles.optInRow}
          >
            <Ionicons
              color={marketingOptIn ? "#B8A3FF" : "#8F8F8F"}
              name={marketingOptIn ? "checkbox" : "square-outline"}
              size={20}
            />
            <Text style={styles.optInText}>
              Send me SoundKit updates and drops
            </Text>
          </Pressable>
          <AuthPrimaryButton
            busy={busy}
            label="Continue"
            onPress={() => {
              void submitCredentials();
            }}
          />
          <View style={styles.footnote}>
            <Text style={styles.footnoteText}>
              By continuing you agree to SoundKit&apos;s terms. You must be 13
              or older to create an account.
            </Text>
          </View>
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account?</Text>
            <Link asChild href="/login">
              <Text style={styles.loginAction}>Log In</Text>
            </Link>
          </View>
        </AuthShell>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "rgba(10, 10, 14, 0.78)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    justifyContent: "flex-start",
    minHeight: 190,
    padding: 14,
  },
  cardCopy: { alignItems: "center", gap: 4 },
  cardDescription: {
    color: "#8F8F8F",
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
  },
  cardIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.12)",
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  cardTitle: {
    color: "#F8F8F8",
    fontSize: 15,
    fontWeight: "800",
  },
  cards: { flexDirection: "row", gap: 10 },
  footnote: { marginTop: 8 },
  footnoteText: {
    color: "#8F8F8F",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  loginAction: {
    color: "#B8A3FF",
    fontSize: 14,
    fontWeight: "800",
  },
  loginPrompt: {
    color: "#8F8F8F",
    fontSize: 14,
  },
  loginRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
  },
  optInRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  optInText: {
    color: "#8F8F8F",
    flex: 1,
    fontSize: 13,
  },
});
