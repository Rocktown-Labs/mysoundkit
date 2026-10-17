/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u,
  MARKETING_OPT_IN_VERSION = "2026-01",
  ROLE_CARDS = [
    {
      description: "Release music & earn",
      icon: "mic-outline" as const,
      label: "I'm an Artist",
      type: "artist" as const,
    },
    {
      description: "Discover & support",
      icon: "people-outline" as const,
      label: "I'm a Fan",
      type: "fan" as const,
    },
  ];

export default function SignupCredentialsScreen() {
  const router = useRouter(),
    { type } = useLocalSearchParams<{ type?: string }>(),
    [accountType, setAccountType] = useState<"artist" | "fan">(
      type === "fan" ? "fan" : "artist"
    ),
    turnstile = useTurnstileToken("signup"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [acceptedTerms, setAcceptedTerms] = useState(false),
    [marketingOptIn, setMarketingOptIn] = useState(false),
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
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      style={styles.page}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AuthShell subtitle="Get started for free" title="Join SoundKit">
        <View style={styles.roleCardsRow}>
          {ROLE_CARDS.map((role) => {
            const active = accountType === role.type;
            return (
              <Pressable
                accessibilityLabel={role.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={role.type}
                onPress={() => {
                  setAccountType(role.type);
                }}
                style={[styles.roleCard, active && styles.roleCardActive]}
              >
                <View
                  style={[
                    styles.roleIconWrap,
                    active && styles.roleIconWrapActive,
                  ]}
                >
                  <Ionicons
                    color={active ? "#B8A3FF" : "#A1A1AA"}
                    name={role.icon}
                    size={18}
                  />
                </View>
                <Text style={styles.roleCardTitle}>{role.label}</Text>
                <Text numberOfLines={1} style={styles.roleCardDescription}>
                  {role.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AuthGoogleButton
          callbackURL={`/signup/onboarding?type=${accountType}`}
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
        <AuthPasswordField
          autoComplete="new-password"
          label="Confirm password"
          onChangeText={setConfirmPassword}
          onSubmitEditing={() => {
            void submit();
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
          label={
            busy
              ? "Creating your account…"
              : `Create ${accountType === "artist" ? "Artist" : "Fan"} account`
          }
          onPress={() => {
            void submit();
          }}
        />
        <View style={styles.loginRow}>
          <Text style={styles.loginPrompt}>Already have an account?</Text>
          <Link asChild href="/login">
            <Text style={styles.loginAction}>Sign in</Text>
          </Link>
        </View>
      </AuthShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  roleCard: {
    alignItems: "center",
    backgroundColor: "#050507",
    borderColor: "#27272A",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  roleCardActive: {
    backgroundColor: "rgba(184, 163, 255, 0.08)",
    borderColor: "#B8A3FF",
  },
  roleCardDescription: {
    color: "#A1A1AA",
    fontSize: 11,
    textAlign: "center",
  },
  roleCardTitle: {
    color: "#FAFAFA",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  roleCardsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  roleIconWrap: {
    alignItems: "center",
    backgroundColor: "#18181B",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  roleIconWrapActive: {
    backgroundColor: "rgba(184, 163, 255, 0.18)",
  },
  scroll: {
    flexGrow: 1,
  },
});
