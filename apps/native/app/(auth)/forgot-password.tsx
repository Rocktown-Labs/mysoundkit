/* oxlint-disable one-var, sort-vars, complexity */
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AuthErrorBanner,
  AuthPrimaryButton,
  AuthShell,
  AuthTextInput,
  getAuthErrorMessage,
  useTurnstileToken,
} from "@/components/auth/auth-shell";
import { WEB_PUBLIC_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export default function ForgotPasswordScreen() {
  const router = useRouter(),
    turnstile = useTurnstileToken("forgot_password"),
    [email, setEmail] = useState(""),
    [error, setError] = useState<null | string>(null),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    const tokenError = turnstile.ensureToken();
    if (tokenError) {
      setError(tokenError);
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.requestPasswordReset(
        {
          email: trimmedEmail,
          // Reset links open the website, which handles the reset flow
          // end-to-end (the mobile app can also receive tokens via the
          // soundkit:// deep link once universal links are configured).
          redirectTo: `${WEB_PUBLIC_URL}/reset-password`,
        },
        { headers: turnstile.headers() }
      );
      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        turnstile.reset();
        setBusy(false);
        return;
      }
      setSent(true);
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
      turnstile.reset();
    }
    setBusy(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: "#020202", flex: 1 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AuthShell
        subtitle="Enter the email tied to your SoundKit account and we'll send a reset link."
        title="Reset your password"
      >
        <AuthErrorBanner message={error} />
        {sent ? (
          <View style={styles.sentBox}>
            <Text style={styles.sentTitle}>Check your inbox</Text>
            <Text style={styles.sentText}>
              If an account uses that email, a reset link is on its way. Open it
              in any browser to choose a new password.
            </Text>
          </View>
        ) : (
          <>
            <AuthTextInput
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              onSubmitEditing={() => {
                void submit();
              }}
              placeholder="Email"
              value={email}
            />
            {turnstile.bridge}
            <AuthPrimaryButton
              busy={busy}
              label="Send Reset Link"
              onPress={() => {
                void submit();
              }}
            />
          </>
        )}
        <View style={{ alignItems: "center", marginTop: 14 }}>
          <Text
            accessibilityRole="button"
            onPress={() => {
              router.back();
            }}
            style={styles.backLink}
          >
            Back to log in
          </Text>
        </View>
      </AuthShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backLink: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  sentBox: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  sentText: {
    color: "#8F8F8F",
    fontSize: 13,
    lineHeight: 19,
  },
  sentTitle: {
    color: "#F8F8F8",
    fontSize: 16,
    fontWeight: "800",
  },
});
