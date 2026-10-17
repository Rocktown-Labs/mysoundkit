/* oxlint-disable one-var, sort-vars, sort-keys, react/set-state-in-effect, unicorn/prefer-module, global-require */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ImageSourcePropType, TextInputProps } from "react-native";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { TurnstileBridge } from "@/components/turnstile-bridge";
import type { TurnstileAction } from "@/components/turnstile-bridge";
import { authClient } from "@/lib/auth-client";

const logoImage = require("@/assets/images/logo.png") as ImageSourcePropType;

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

/** Shared shell for the auth routes: native back button to the left of the centered SoundKit logo, heading, and dark card body. */
export function AuthShell({
  backLabel = "Back",
  children,
  onBackPress,
  showBackButton = true,
  showGuestContinue: _showGuestContinue,
  subtitle,
  title,
}: {
  backLabel?: string;
  children: ReactNode;
  onBackPress?: () => void;
  showBackButton?: boolean;
  showGuestContinue?: boolean;
  subtitle?: string;
  title: string;
}) {
  const router = useRouter(),
    insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(drawer)/(tabs)/(discover)");
  };

  return (
    <View
      style={[
        styles.shell,
        {
          paddingBottom: Math.max(insets.bottom + 20, 32),
          paddingTop: Math.max(insets.top + 12, 32),
        },
      ]}
    >
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <View style={styles.logoRow}>
            {showBackButton ? (
              <Pressable
                accessibilityLabel={backLabel}
                accessibilityRole="button"
                hitSlop={10}
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.nativeBackButton,
                  pressed && styles.nativeBackButtonPressed,
                ]}
              >
                <Ionicons color="#FAFAFA" name="chevron-back" size={22} />
              </Pressable>
            ) : null}

            <Image
              accessibilityLabel="SoundKit"
              resizeMode="contain"
              source={logoImage}
              style={styles.logoImage}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.formCard}>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </View>
  );
}

/** 4-color Google OAuth button matching the website's `GoogleAuthButton`. */
export function AuthGoogleButton({
  callbackURL = "/(drawer)/(tabs)/(discover)",
  disabled,
  label = "Continue with Google",
  onError,
}: {
  callbackURL?: string;
  disabled?: boolean;
  label?: string;
  onError?: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (loading || disabled) {
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.signIn.social({
        callbackURL,
        newUserCallbackURL: callbackURL,
        provider: "google",
      });
      if (result?.error && onError) {
        onError(getAuthErrorMessage(result.error));
      }
    } catch (error) {
      if (onError) {
        onError(getAuthErrorMessage(error));
      }
    }
    setLoading(false);
  };

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        void handleGoogleSignIn();
      }}
      style={({ pressed }) => [
        styles.outlineButton,
        (disabled || loading) && { opacity: 0.6 },
        pressed && !disabled && !loading && styles.outlineButtonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Svg height={18} viewBox="0 0 24 24" width={18}>
          <Path
            d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z"
            fill="#4285F4"
          />
          <Path
            d="M12 21.63c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.63Z"
            fill="#34A853"
          />
          <Path
            d="M6.53 13.71a5.86 5.86 0 0 1 0-3.42V7.76H3.28a9.75 9.75 0 0 0 0 8.48l3.25-2.53Z"
            fill="#FBBC05"
          />
          <Path
            d="M12 6.26c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.36 14.63 2.37 12 2.37a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 7.98 9.46 6.26 12 6.26Z"
            fill="#EA4335"
          />
        </Svg>
      )}
      <Text style={styles.outlineButtonText}>{label}</Text>
    </Pressable>
  );
}

/** Horizontal separator with centered label (e.g., "or use email"). */
export function AuthDivider({ label = "or use email" }: { label?: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
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

/** Password input with optional label and a show/hide toggle. */
export function AuthPasswordField({
  autoComplete,
  label,
  onBlur,
  onChangeText,
  onSubmitEditing,
  placeholder,
  value,
}: {
  autoComplete?: "current-password" | "new-password";
  label?: string;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.passwordInputWrap}>
        <TextInput
          autoCapitalize="none"
          autoComplete={autoComplete}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#71717A"
          secureTextEntry={!visible}
          style={[styles.input, styles.passwordInput]}
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
            color="#A1A1AA"
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={18}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function AuthTextInput(props: {
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  keyboardType?: TextInputProps["keyboardType"];
  label?: string;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      {props.label ? (
        <Text style={styles.fieldLabel}>{props.label}</Text>
      ) : null}
      <TextInput
        autoCapitalize={props.autoCapitalize ?? "none"}
        autoComplete={props.autoComplete}
        keyboardType={props.keyboardType}
        onBlur={props.onBlur}
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmitEditing}
        placeholder={props.placeholder}
        placeholderTextColor="#71717A"
        style={styles.input}
        value={props.value}
      />
    </View>
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
        pressed && !busy && { opacity: 0.88, transform: [{ scale: 0.99 }] },
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
      tokenRef.current.length > 0
        ? {
            "X-Turnstile-Token": tokenRef.current,
            "x-captcha-response": tokenRef.current,
          }
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
    gap: 14,
  },
  container: {
    alignSelf: "center",
    maxWidth: 440,
    width: "100%",
  },
  dividerLabel: {
    color: "#71717A",
    fontSize: 12,
    fontWeight: "500",
  },
  dividerLine: {
    backgroundColor: "#27272A",
    flex: 1,
    height: 1,
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginVertical: 2,
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: "rgba(224, 93, 77, 0.12)",
    borderColor: "rgba(224, 93, 77, 0.35)",
    borderRadius: 10,
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
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: "#09090B",
    borderColor: "#27272A",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    width: "100%",
  },
  headerBlock: {
    alignItems: "center",
    marginBottom: 22,
    width: "100%",
  },
  input: {
    backgroundColor: "#050507",
    borderColor: "#27272A",
    borderRadius: 10,
    borderWidth: 1,
    color: "#FAFAFA",
    fontSize: 15,
    height: 46,
    paddingHorizontal: 14,
  },
  inputToggle: {
    alignItems: "center",
    height: 46,
    justifyContent: "center",
    paddingHorizontal: 12,
    position: "absolute",
    right: 0,
    top: 0,
  },
  logoImage: {
    height: 52,
    width: 150,
  },
  logoRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    minHeight: 52,
    position: "relative",
    width: "100%",
  },
  nativeBackButton: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#27272A",
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    width: 40,
  },
  nativeBackButtonPressed: {
    backgroundColor: "#27272A",
    transform: [{ scale: 0.96 }],
  },
  outlineButton: {
    alignItems: "center",
    backgroundColor: "#050507",
    borderColor: "#27272A",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  outlineButtonPressed: {
    backgroundColor: "#18181B",
  },
  outlineButtonText: {
    color: "#FAFAFA",
    fontSize: 14,
    fontWeight: "600",
  },
  passwordInput: {
    paddingRight: 42,
  },
  passwordInputWrap: {
    position: "relative",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    height: 46,
    justifyContent: "center",
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#09090B",
    fontSize: 14,
    fontWeight: "700",
  },
  shell: {
    backgroundColor: "#020202",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 340,
    textAlign: "center",
  },
  title: {
    color: "#FAFAFA",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 6,
    textAlign: "center",
  },
});
