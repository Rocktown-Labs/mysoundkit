import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { LibraryGrid } from "@/components/library-grid";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function LibraryScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession();

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header matching Image 4 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons color="#c084fc" name="musical-notes" size={28} />
            <Text style={[styles.title, { color: theme.text }]}>
              My SoundKit
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Access your music collection, playlists, and listening history
          </Text>
        </View>

        {/* 2-Column Rounded Cards Grid */}
        <LibraryGrid />

        {/* Account / Session section */}
        {session?.user ? (
          <View
            style={[
              styles.userCard,
              { backgroundColor: "#121215", borderColor: "#27272a" },
            ]}
          >
            <View style={styles.userRow}>
              <View style={styles.userAvatar}>
                <Ionicons color="#c084fc" name="person" size={20} />
              </View>
              <View style={styles.userCopy}>
                <Text style={styles.userName}>{session.user.name}</Text>
                <Text style={styles.userEmail}>{session.user.email}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Link href="/dashboard" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.dashboardBtn,
                    {
                      backgroundColor: pressed ? "#27272a" : "#18181b",
                    },
                  ]}
                >
                  <Ionicons
                    color="#a855f7"
                    name="speedometer-outline"
                    size={16}
                  />
                  <Text style={styles.dashboardBtnText}>Artist Dashboard</Text>
                </Pressable>
              </Link>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void authClient.signOut();
                }}
                style={({ pressed }) => [
                  styles.signOutBtn,
                  {
                    backgroundColor: pressed ? "#27272a" : "#18181b",
                  },
                ]}
              >
                <Text style={styles.signOutBtnText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.authBox}>
            <SignIn />
            <SignUp />
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  authBox: {
    gap: 12,
    marginTop: 12,
  },
  content: {
    gap: 22,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dashboardBtn: {
    alignItems: "center",
    borderColor: "#27272a",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
  },
  dashboardBtnText: {
    color: "#f4f4f5",
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    gap: 6,
  },
  signOutBtn: {
    alignItems: "center",
    borderColor: "#27272a",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  signOutBtnText: {
    color: "#e05d4d",
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  userAvatar: {
    alignItems: "center",
    backgroundColor: "#27272a",
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  userCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginTop: 8,
    padding: 16,
  },
  userCopy: {
    flex: 1,
    gap: 2,
  },
  userEmail: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  userName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  userRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
});
