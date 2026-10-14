/* oxlint-disable one-var, sort-vars, sort-keys, react/set-state-in-effect */
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { TextInputProps } from "react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { TurnstileBridge } from "@/components/turnstile-bridge";
import type { TurnstileAction } from "@/components/turnstile-bridge";

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

/** Shared shell for the auth routes: wordmark, back link, heading, and body. */
export function AuthShell({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Link asChild href="/">
          <Pressable
            accessibilityHint="Exits to the app"
            accessibilityLabel="Back to SoundKit"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons color="#B8A3FF" name="chevron-back" size={24} />
          </Pressable>
        </Link>
        <View style={styles.wordmark}>
          <Ionicons color="#B8A3FF" name="musical-notes" size={20} />
          <Text style={styles.wordmarkText}>SoundKit</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
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
  autoCapitalize?: "none" | "sentences";
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  input: {
    backgroundColor: "#0B0B0B",
    borderColor: "#212121",
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
    padding: 24,
    paddingTop: 72,
  },
  subtitle: {
    color: "#8F8F8F",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 26,
  },
  title: {
    color: "#F8F8F8",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  wordmark: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  wordmarkText: {
    color: "#F8F8F8",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
