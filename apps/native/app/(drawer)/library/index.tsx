import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeMenuList } from "@/components/native-menu-list";
import { NativeSectionScreen } from "@/components/native-section-screen";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { LIBRARY_MENU_ITEMS } from "@/lib/native-navigation";
import { useColorScheme } from "@/lib/use-color-scheme";

const ACCOUNT_LINKS = [
    {
      description: "Your artist workspace, uploads, and analytics",
      href: "/dashboard",
      icon: "speedometer-outline",
      label: "Artist Dashboard",
    },
    {
      description: "Account, notifications, and listener settings",
      href: "/library/settings",
      icon: "settings-outline",
      label: "Settings",
    },
  ] as const,
  styles = StyleSheet.create({
    email: { fontSize: 14, marginBottom: 20 },
    signOut: {
      alignItems: "center",
      borderRadius: 11,
      justifyContent: "center",
      minHeight: 46,
    },
    signOutText: { fontSize: 14, fontWeight: "800" },
    userCard: { borderRadius: 18, borderWidth: 1, padding: 18 },
    welcome: { fontSize: 18, fontWeight: "800", marginBottom: 7 },
  });

export default function LibraryScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession();

  return (
    <NativeSectionScreen
      description="Keep your saved music, listening history, playlists, purchases, and account settings close."
      eyebrow="My SoundKit"
      title="Library"
    >
      {session?.user ? (
        <View
          style={[
            styles.userCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text selectable style={[styles.welcome, { color: theme.text }]}>
            Welcome, {session.user.name}
          </Text>
          <Text selectable style={[styles.email, { color: theme.mutedText }]}>
            {session.user.email}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void authClient.signOut();
            }}
            style={({ pressed }) => [
              styles.signOut,
              {
                backgroundColor: pressed ? theme.muted : theme.text,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.signOutText, { color: theme.background }]}>
              Sign out
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <SignIn />
          <SignUp />
        </>
      )}
      <NativeMenuList items={ACCOUNT_LINKS} label="Workspace" />
      <NativeMenuList items={LIBRARY_MENU_ITEMS} label="Library menu" />
    </NativeSectionScreen>
  );
}
