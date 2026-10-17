/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import { authClient } from "@/lib/auth-client";

const BIOMETRIC_CREDENTIALS_KEY = "soundkit.biometric_credentials.v1",
  EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

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
    [busy, setBusy] = useState(false),
    [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    if (session?.user) {
      router.replace(redirectHrefFor(params.redirect));
    }
  }, [params.redirect, router, session?.user]);

  const signInWithCredentials = async (
    targetEmail: string,
    targetPassword: string,
    saveForBiometrics: boolean
  ) => {
    const tokenError = turnstile.ensureToken();
    if (tokenError) {
      setError(tokenError);
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.signIn.email(
        { email: targetEmail, password: targetPassword },
        { headers: turnstile.headers() }
      );
      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        turnstile.reset();
        setBusy(false);
        return;
      }
      if (saveForBiometrics && Platform.OS !== "web") {
        try {
          await SecureStore.setItemAsync(
            BIOMETRIC_CREDENTIALS_KEY,
            JSON.stringify({ email: targetEmail, password: targetPassword })
          );
        } catch {
          // Best-effort biometric credential caching.
        }
      }
      setBusy(false);
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
      turnstile.reset();
      setBusy(false);
    }
  };

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
    await signInWithCredentials(trimmedEmail, password, true);
  };

  const handleBiometricSignIn = async () => {
    setError(null);
    if (Platform.OS === "web") {
      setError("Biometric sign-in is available on iOS and Android devices.");
      return;
    }
    setBiometricBusy(true);
    try {
      const storedPayload = await SecureStore.getItemAsync(
        BIOMETRIC_CREDENTIALS_KEY,
        {
          authenticationPrompt: "Sign in to SoundKit",
          requireAuthentication: true,
        }
      );
      if (!storedPayload) {
        setError(
          "Sign in once with your email and password to enable Face ID / Touch ID."
        );
        setBiometricBusy(false);
        return;
      }
      const parsed = JSON.parse(storedPayload) as {
        email?: string;
        password?: string;
      };
      if (!parsed.email || !parsed.password) {
        setError(
          "Saved biometric credentials are incomplete. Sign in with email once to refresh."
        );
        setBiometricBusy(false);
        return;
      }
      setEmail(parsed.email);
      setPassword(parsed.password);
      setBiometricBusy(false);
      await signInWithCredentials(parsed.email, parsed.password, false);
    } catch {
      setError("Biometric authentication was cancelled or unavailable.");
      setBiometricBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      style={styles.page}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AuthShell
        backLabel="Back to home"
        cardSubtitle="Use Google, Face ID / biometrics, or your SoundKit email and password to continue."
        cardTitle="Sign in"
        subtitle="Sign in to your SoundKit account."
        title="Welcome back"
      >
        <View style={styles.socialGroup}>
          <AuthGoogleButton
            callbackURL={String(redirectHrefFor(params.redirect))}
            disabled={busy || biometricBusy}
            onError={setError}
          />
          <Pressable
            accessibilityLabel="Sign in with Face ID or Biometrics"
            accessibilityRole="button"
            disabled={busy || biometricBusy}
            onPress={() => {
              void handleBiometricSignIn();
            }}
            style={({ pressed }) => [
              styles.biometricButton,
              (busy || biometricBusy) && { opacity: 0.6 },
              pressed &&
                !busy &&
                !biometricBusy &&
                styles.biometricButtonPressed,
            ]}
          >
            {biometricBusy ? (
              <ActivityIndicator color="#B8A3FF" size="small" />
            ) : (
              <Ionicons color="#B8A3FF" name="scan-outline" size={18} />
            )}
            <Text style={styles.biometricButtonText}>
              Sign in with Face ID / Biometrics
            </Text>
          </Pressable>
        </View>

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

        <View style={styles.passwordSection}>
          <View style={styles.passwordHeaderRow}>
            <Text style={styles.passwordLabel}>Password</Text>
            <Link asChild href="/forgot-password">
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </Link>
          </View>
          <AuthPasswordField
            autoComplete="current-password"
            onChangeText={setPassword}
            onSubmitEditing={() => {
              void submit();
            }}
            placeholder="Your password"
            value={password}
          />
        </View>

        {turnstile.bridge}

        <AuthPrimaryButton
          busy={busy}
          label={busy ? "Signing in…" : "Sign in"}
          onPress={() => {
            void submit();
          }}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchPrompt}>Need an account?</Text>
          <Link asChild href="/signup">
            <Text style={styles.switchAction}>Create one</Text>
          </Link>
        </View>
      </AuthShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  biometricButton: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.08)",
    borderColor: "rgba(184, 163, 255, 0.28)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  biometricButtonPressed: {
    backgroundColor: "rgba(184, 163, 255, 0.16)",
  },
  biometricButtonText: {
    color: "#E4DCFF",
    fontSize: 14,
    fontWeight: "600",
  },
  forgotLink: {
    color: "#B8A3FF",
    fontSize: 12,
    fontWeight: "600",
  },
  page: {
    backgroundColor: "#020202",
    flex: 1,
  },
  passwordHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  passwordLabel: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "600",
  },
  passwordSection: {
    gap: 6,
  },
  scroll: {
    flexGrow: 1,
  },
  socialGroup: {
    gap: 10,
  },
  switchAction: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  switchPrompt: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 6,
  },
});
