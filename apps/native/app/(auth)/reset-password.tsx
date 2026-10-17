/* oxlint-disable one-var, sort-vars, complexity */
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AuthErrorBanner,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthShell,
  getAuthErrorMessage,
} from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordScreen() {
  const router = useRouter(),
    params = useLocalSearchParams<{ token?: string }>(),
    token = params.token ?? "",
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [error, setError] = useState<null | string>(null),
    [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!token) {
      setError("This reset link is missing its token. Request a new email.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        setBusy(false);
        return;
      }
      setBusy(false);
      router.replace("/login");
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
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
      <AuthShell
        subtitle="Choose a new password for your SoundKit account."
        title="Set a new password"
      >
        <AuthErrorBanner message={error} />
        <AuthPasswordField
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder="New password (at least 8 characters)"
          value={password}
        />
        <AuthPasswordField
          autoComplete="new-password"
          onChangeText={setConfirmPassword}
          onSubmitEditing={() => {
            void submit();
          }}
          placeholder="Confirm new password"
          value={confirmPassword}
        />
        <AuthPrimaryButton
          busy={busy}
          label="Reset Password"
          onPress={() => {
            void submit();
          }}
        />
        <View style={{ alignItems: "center", marginTop: 14 }}>
          <Text style={styles.hint}>
            Reset links open the website by default; this screen handles
            soundkit:// deep links once universal links are configured.
          </Text>
        </View>
      </AuthShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: "#8F8F8F",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
