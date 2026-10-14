import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function LibrarySettingsScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession();

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Link href="/library" asChild>
            <Pressable style={styles.backRow}>
              <Ionicons color="#B8A3FF" name="arrow-back" size={18} />
              <Text style={styles.backText}>My SoundKit</Text>
            </Pressable>
          </Link>
          <View style={styles.titleRow}>
            <Ionicons color="#9ca3af" name="settings-outline" size={26} />
            <Text style={[styles.title, { color: theme.text }]}>Account</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Manage your SoundKit account, profile, and listener preferences
          </Text>
        </View>

        {session?.user ? (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: "#060606", borderColor: "#212121" },
            ]}
          >
            <View style={styles.userRow}>
              <View style={styles.userAvatar}>
                <Ionicons color="#B8A3FF" name="person" size={24} />
              </View>
              <View style={styles.userCopy}>
                <Text style={styles.userName}>{session.user.name}</Text>
                <Text style={styles.userEmail}>{session.user.email}</Text>
              </View>
            </View>

            <View style={styles.itemRow}>
              <Text style={styles.itemLabel}>Appearance</Text>
              <View style={styles.badge}>
                <Ionicons color="#B8A3FF" name="moon" size={12} />
                <Text style={styles.badgeText}>Dark (Locked)</Text>
              </View>
            </View>

            <View style={styles.itemRow}>
              <Text style={styles.itemLabel}>Account ID</Text>
              <Text numberOfLines={1} style={styles.itemValue}>
                {session.user.id}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void authClient.signOut();
              }}
              style={({ pressed }) => [
                styles.signOutBtn,
                { backgroundColor: pressed ? "#212121" : "#111111" },
              ]}
            >
              <Ionicons color="#e05d4d" name="log-out-outline" size={18} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: "#060606", borderColor: "#212121" },
            ]}
          >
            <Text style={styles.emptyTitle}>Not signed in</Text>
            <Text style={styles.emptyDesc}>
              Log in to sync your library across web, mobile, and desktop.
            </Text>
            <Link href="/library" asChild>
              <Pressable style={styles.loginBtn}>
                <Text style={styles.loginBtnText}>Go to Login</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  backText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#212121",
    borderRadius: 6,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    gap: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyDesc: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    gap: 6,
  },
  itemLabel: {
    color: "#8F8F8F",
    fontSize: 14,
  },
  itemRow: {
    alignItems: "center",
    borderTopColor: "#212121",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  itemValue: {
    color: "#f4f4f5",
    fontSize: 13,
    maxWidth: 160,
  },
  loginBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 12,
  },
  loginBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  signOutBtn: {
    alignItems: "center",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
    paddingVertical: 12,
  },
  signOutText: {
    color: "#e05d4d",
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  userAvatar: {
    alignItems: "center",
    backgroundColor: "#212121",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  userCopy: {
    flex: 1,
    gap: 2,
  },
  userEmail: {
    color: "#8F8F8F",
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
