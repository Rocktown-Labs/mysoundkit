/* oxlint-disable one-var, sort-vars */
/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeImage } from "@/components/native-image";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { resolveApiUrl, useMeQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const AVATAR_SIZE = 34,
  DOUBLE_PRESS_DELAY_MS = 300,
  styles = StyleSheet.create({
    avatar: {
      alignItems: "center",
      borderRadius: AVATAR_SIZE / 2,
      borderWidth: 2,
      height: AVATAR_SIZE,
      justifyContent: "center",
      overflow: "hidden",
      width: AVATAR_SIZE,
    },
    avatarImage: { height: AVATAR_SIZE - 4, width: AVATAR_SIZE - 4 },
    avatarInitials: { fontSize: 12, fontWeight: "800" },
  });

/**
 * Header avatar button backed by the user's real SoundKit profile data.
 *
 * Checks `meQuery.data?.user.avatarUrl` with fallback to `session?.user.image`.
 * A single tap opens the library menu sheet; a rapid double tap navigates to
 * the full /library screen. Follows Apple fluid interface standards (sub-150ms
 * active feedback, haptic response, 44pt touch area).
 */
export function AvatarHeaderButton({
  onSinglePress,
}: {
  onSinglePress: () => void;
}) {
  const { colorScheme } = useColorScheme(),
    lastPressRef = useRef(0),
    router = useRouter(),
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    meQuery = useMeQuery(signedIn),
    meUser = meQuery.data?.user,
    singlePressTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    triggerPress = () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!session?.user) {
        router.push("/login");
        return;
      }
      const now = Date.now(),
        previousPressAt = lastPressRef.current;
      lastPressRef.current = now;
      if (now - previousPressAt <= DOUBLE_PRESS_DELAY_MS) {
        if (singlePressTimerRef.current) {
          clearTimeout(singlePressTimerRef.current);
          singlePressTimerRef.current = null;
        }
        router.push("/library");
        return;
      }
      singlePressTimerRef.current = setTimeout(() => {
        singlePressTimerRef.current = null;
        onSinglePress();
      }, DOUBLE_PRESS_DELAY_MS);
    },
    userImage =
      resolveApiUrl(meUser?.avatarUrl) ||
      (session?.user?.image ? resolveApiUrl(session.user.image) : null),
    displayName = meUser?.displayName || session?.user?.name || "",
    userInitials = displayName
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");

  return (
    <Pressable
      accessibilityHint="Opens your library menu, or double tap for the full library"
      accessibilityLabel={displayName ? `Account: ${displayName}` : "Account"}
      accessibilityRole="button"
      hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
      onPress={triggerPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: theme.primary, borderColor: theme.background },
        ]}
      >
        {userImage ? (
          <NativeImage source={userImage} style={styles.avatarImage} />
        ) : (
          <Text
            style={[styles.avatarInitials, { color: theme.primaryForeground }]}
          >
            {userInitials || <Ionicons name="person" size={16} />}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
