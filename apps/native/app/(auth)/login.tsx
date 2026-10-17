/* oxlint-disable one-var, sort-vars, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AuthErrorBanner,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthShell,
  AuthTextInput,
  getAuthErrorMessage,
  useTurnstileToken,
} from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const redirectHrefFor = (redirect: undefined | string): Href =>
  (redirect && redirect.startsWith("/") && redirect !== "/"
    ? redirect
    : "/(drawer)/(tabs)/(discover)") as Href;

export default function LoginScreen() {
  const router = useRouter(),
    params = useLocalSearchParams<{ redirect?: string }>(),
    { data: session } = authClient.useSession(),
    turnstile = useTurnstileToken("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState<null | string>(null),
    [busy, setBusy] = useState(false);

  // Already signed in (or just signed in) — continue to the requested
  // destination. The submit sets submitHandledRef so this effect never
  // races a shorter intent over a ?redirect= one.
  useEffect(() => {
    if (session?.user) {
      router.replace(redirectHrefFor(params.redirect));
    }
  }, [params.redirect, router, session?.user]);

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 1) {
      setError("Enter your password.");
      return;
    }
    const tokenError = turnstile.ensureToken();
    if (tokenError) {
      setError(tokenError);
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.signIn.email(
        { email: trimmedEmail, password },
        { headers: turnstile.headers() }
      );
      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        turnstile.reset();
        setBusy(false);
        return;
      }
      setBusy(false);
      // The session effect handles the redirect (including ?redirect= intent).
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
      style={{ backgroundColor: "#020202", flex: 1 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AuthShell
        subtitle="Welcome back. Sign in to keep your SoundKit going."
        title="Log In"
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
          autoComplete="current-password"
          onChangeText={setPassword}
          onSubmitEditing={() => {
            void submit();
          }}
          placeholder="Password"
          value={password}
        />
        {turnstile.bridge}
        <AuthPrimaryButton
          busy={busy}
          label="Log In"
          onPress={() => {
            void submit();
          }}
        />
        <Link asChild href="/forgot-password">
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </Link>
        <View style={styles.switchRow}>
          <Text style={styles.switchPrompt}>New to SoundKit?</Text>
          <Link asChild href="/signup">
            <Text style={styles.switchAction}>Create an account</Text>
          </Link>
        </View>
        <View style={styles.footer}>
          <Ionicons color="#8F8F8F" name="shield-checkmark-outline" size={14} />
          <Text style={styles.footerText}>
            Protected by Cloudflare Turnstile
          </Text>
        </View>
      </AuthShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 16,
  },
  footerText: {
    color: "#8F8F8F",
    fontSize: 11,
  },
  forgotLink: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  scroll: { flexGrow: 1 },
  switchAction: {
    color: "#B8A3FF",
    fontSize: 14,
    fontWeight: "800",
  },
  switchPrompt: {
    color: "#8F8F8F",
    fontSize: 14,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
  },
});
