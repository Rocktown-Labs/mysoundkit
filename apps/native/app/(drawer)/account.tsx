import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeSectionScreen } from "@/components/native-section-screen";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function AccountScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession();

  return (
    <NativeSectionScreen
      description="Sign in to save music, join the conversation, and unlock your SoundKit workspace."
      eyebrow="Your SoundKit"
      title="Account"
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
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
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
