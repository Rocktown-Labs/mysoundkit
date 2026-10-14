import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
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
 * Header avatar driven by the Better Auth session.
 *
 * A single tap opens the library menu sheet; a rapid double tap navigates to
 * the full /library screen.
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
    singlePressTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    triggerPress = () => {
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
    userImage = session?.user?.image ?? null,
    userInitials = (session?.user?.name ?? "")
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");

  return (
    <Pressable
      accessibilityHint="Opens your library menu, or double tap for the full library"
      accessibilityLabel={
        session?.user?.name ? `Account: ${session.user.name}` : "Account"
      }
      accessibilityRole="button"
      onPress={triggerPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: theme.primary, borderColor: theme.background },
        ]}
      >
        {userImage ? (
          <Image source={{ uri: userImage }} style={styles.avatarImage} />
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
