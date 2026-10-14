/* oxlint-disable one-var, sort-vars, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u,
  MARKETING_OPT_IN_VERSION = "2026-01";

export default function SignupCredentialsScreen() {
  const router = useRouter(),
    { type } = useLocalSearchParams<{ type?: string }>(),
    accountType = type === "fan" ? "fan" : "artist",
    turnstile = useTurnstileToken("signup"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [marketingOptIn, setMarketingOptIn] = useState(true),
    [error, setError] = useState<null | string>(null),
    [busy, setBusy] = useState(false);

  const persistSignupIntent = async () => {
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
      // Step persistence is best-effort; onboarding still works without it.
    }
  };

  const submit = async () => {
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
          // The real name is collected during onboarding (username step);
          // better-auth requires a non-empty placeholder like the web form.
          name: accountType === "artist" ? "Artist" : "Fan",
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
      await persistSignupIntent();
      setBusy(false);
      router.replace(`/signup/onboarding?type=${accountType}`);
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
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: "#020202" },
          headerTintColor: "#F8F8F8",
          title: accountType === "artist" ? "Artist Account" : "Fan Account",
        }}
      />
      <AuthShell
        subtitle="Create your free account. Your artist or fan profile comes next."
        title="Sign Up"
      >
        <AuthErrorBanner message={error} />
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
            void submit();
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
          label="Create Account"
          onPress={() => {
            void submit();
          }}
        />
        <View style={styles.footnote}>
          <Text style={styles.footnoteText}>
            By continuing you agree to SoundKit&apos;s terms. You must be 13 or
            older to create an account.
          </Text>
        </View>
      </AuthShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  footnote: { marginTop: 12 },
  footnoteText: {
    color: "#8F8F8F",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
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
