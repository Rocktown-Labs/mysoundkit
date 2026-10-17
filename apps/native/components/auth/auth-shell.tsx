/* oxlint-disable one-var, sort-vars, sort-keys, react/set-state-in-effect */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { TextInputProps } from "react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { LiquidGlassView } from "@/components/liquid-glass";
import { TurnstileBridge } from "@/components/turnstile-bridge";
import type { TurnstileAction } from "@/components/turnstile-bridge";
import { useGuestMode } from "@/contexts/guest-mode-context";

/** Extracts a user-facing message from a better-auth error payload. */
export const getAuthErrorMessage = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; statusText?: unknown };
    if (typeof maybe.message === "string" && maybe.message.length > 0) {
      return maybe.message;
    }
    if (typeof maybe.statusText === "string") {
      return maybe.statusText;
    }
  }
  return "Something went wrong. Please try again.";
};

/** Shared shell for the auth routes: centered SoundKit logo above the form, heading, and Liquid Glass body. */
export function AuthShell({
  children,
  showGuestContinue = true,
  subtitle,
  title,
}: {
  children: ReactNode;
  showGuestContinue?: boolean;
  subtitle?: string;
  title: string;
}) {
  const router = useRouter(),
    { enterGuestMode } = useGuestMode();

  return (
    <View style={styles.shell}>
      <View style={styles.logoHeader}>
        <View style={styles.logoBadge}>
          <Ionicons color="#B8A3FF" name="musical-notes" size={28} />
        </View>
        <Text style={styles.wordmarkText}>SoundKit</Text>
      </View>

      <View style={styles.headingWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <LiquidGlassView borderRadius={22} style={styles.formCard} variant="card">
        <View style={styles.body}>{children}</View>
      </LiquidGlassView>

      {showGuestContinue ? (
        <Pressable
          accessibilityHint="Enters SoundKit as a guest with 5 minutes of daily playback"
          accessibilityLabel="Continue as Guest"
          accessibilityRole="button"
          onPress={() => {
            enterGuestMode();
            router.replace("/(drawer)/(tabs)/(discover)");
          }}
          style={({ pressed }) => [
            styles.guestButton,
            pressed && styles.guestButtonPressed,
          ]}
        >
          <Ionicons color="#B8A3FF" name="headset-outline" size={16} />
          <Text style={styles.guestButtonText}>
            Continue as Guest (5 min free preview)
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AuthErrorBanner({ message }: { message: null | string }) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.errorBanner}>
      <Ionicons color="#E05D4D" name="alert-circle-outline" size={16} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** Password input with a show/hide toggle. */
export function AuthPasswordField({
  autoComplete,
  onBlur,
  onChangeText,
  onSubmitEditing,
  placeholder,
  value,
}: {
  autoComplete?: "current-password" | "new-password";
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TextInput
        autoCapitalize="none"
        autoComplete={autoComplete}
        onBlur={onBlur}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor="#8F8F8F"
        secureTextEntry={!visible}
        style={styles.input}
        value={value}
      />
      <Pressable
        accessibilityHint={visible ? "Hides password" : "Shows password"}
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          setVisible((prev) => !prev);
        }}
        style={styles.inputToggle}
      >
        <Ionicons
          color="#8F8F8F"
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
        />
      </Pressable>
    </View>
  );
}

export function AuthTextInput(props: {
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  keyboardType?: TextInputProps["keyboardType"];
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <TextInput
      autoCapitalize={props.autoCapitalize ?? "none"}
      autoComplete={props.autoComplete}
      keyboardType={props.keyboardType}
      onBlur={props.onBlur}
      onChangeText={props.onChangeText}
      onSubmitEditing={props.onSubmitEditing}
      placeholder={props.placeholder}
      placeholderTextColor="#8F8F8F"
      style={styles.input}
      value={props.value}
    />
  );
}

export function AuthPrimaryButton({
  busy,
  label,
  onPress,
}: {
  busy?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        busy && { opacity: 0.6 },
        pressed && !busy && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Owns one Turnstile challenge for a form. Production better-auth rejects
 * sign-in / sign-up / password reset without a valid X-Turnstile-Token; the
 * challenge is solved in the hosted bridge WebView. When the website
 * deployment has no sitekey (dev), `available` stays false and submits send
 * no header — the server only enforces the check when Turnstile is secret'd.
 */
export function useTurnstileToken(action: TurnstileAction) {
  const availableRef = useRef(false),
    tokenRef = useRef(""),
    [available, setAvailable] = useState(false),
    [solved, setSolved] = useState(false),
    [resetKey, setResetKey] = useState(0);

  const messageHandler = (message: { available: boolean; token: string }) => {
    availableRef.current = message.available;
    tokenRef.current = message.token;
    setAvailable(message.available);
    setSolved(message.token.length > 0);
  };

  useEffect(() => {
    // The WebView re-solves on remount; keep local state in sync.
    if (resetKey > 0) {
      setSolved(false);
    }
  }, [resetKey]);

  return {
    available,
    bridge: (
      <TurnstileBridge
        action={action}
        onMessage={messageHandler}
        resetKey={resetKey}
      />
    ),
    /** Validation guard before submit. */
    ensureToken: (): null | string => {
      if (!availableRef.current) {
        return null;
      }
      if (tokenRef.current.length === 0) {
        return "Complete the security check before continuing.";
      }
      return null;
    },
    headers: (): Record<string, string> =>
      availableRef.current && tokenRef.current.length > 0
        ? { "X-Turnstile-Token": tokenRef.current }
        : {},
    reset: () => {
      tokenRef.current = "";
      setSolved(false);
      setResetKey((prev) => prev + 1);
    },
    solved,
  };
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
    padding: 18,
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: "rgba(224, 93, 77, 0.12)",
    borderColor: "rgba(224, 93, 77, 0.35)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: "#E05D4D",
    flex: 1,
    fontSize: 13,
  },
  formCard: {
    width: "100%",
  },
  guestButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  guestButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  guestButtonText: {
    color: "#DFD5FF",
    fontSize: 13,
    fontWeight: "700",
  },
  headingWrap: {
    alignItems: "center",
    marginBottom: 22,
  },
  input: {
    backgroundColor: "rgba(10, 10, 14, 0.78)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 12,
    borderWidth: 1,
    color: "#F8F8F8",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputToggle: {
    padding: 8,
    position: "absolute",
    right: 6,
    top: 8,
  },
  logoBadge: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderColor: "rgba(184, 163, 255, 0.35)",
    borderRadius: 18,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  logoHeader: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    marginBottom: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 14,
    justifyContent: "center",
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: "#171717",
    fontSize: 15,
    fontWeight: "800",
  },
  shell: {
    backgroundColor: "#020202",
    flex: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 56,
  },
  subtitle: {
    color: "#8F8F8F",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
    textAlign: "center",
  },
  title: {
    color: "#F8F8F8",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 6,
    textAlign: "center",
  },
  wordmarkText: {
    color: "#F8F8F8",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
    textTransform: "uppercase",
  },
});
