/* oxlint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuthShell } from "@/components/auth/auth-shell";

const ACCOUNT_TYPES = [
  {
    description:
      "Release tracks, join battles, build your audience, and monetize your sound.",
    icon: "mic-outline" as const,
    label: "I'm an Artist",
    type: "artist",
  },
  {
    description:
      "Discover new music, follow artists, join communities, and support the scene.",
    icon: "headset-outline" as const,
    label: "I'm a Fan",
    type: "fan",
  },
];

export default function SignupChooserScreen() {
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      style={{ backgroundColor: "#020202", flex: 1 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AuthShell
        subtitle="Choose how you'll use SoundKit. You can always join the other side later."
        title="Join SoundKit"
      >
        <View style={styles.cards}>
          {ACCOUNT_TYPES.map((accountType) => (
            <Link
              asChild
              href={`/signup/credentials?type=${accountType.type}`}
              key={accountType.type}
            >
              <Pressable
                accessibilityHint={`Signs up as ${accountType.type}`}
                accessibilityLabel={accountType.label}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={styles.cardIconWrap}>
                  <Ionicons color="#B8A3FF" name={accountType.icon} size={26} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{accountType.label}</Text>
                  <Text style={styles.cardDescription}>
                    {accountType.description}
                  </Text>
                </View>
                <Ionicons color="#8F8F8F" name="chevron-forward" size={18} />
              </Pressable>
            </Link>
          ))}
        </View>
        <View style={styles.loginRow}>
          <Text style={styles.loginPrompt}>Already have an account?</Text>
          <Link asChild href="/login">
            <Text style={styles.loginAction}>Log In</Text>
          </Link>
        </View>
      </AuthShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    justifyContent: "flex-start",
    minHeight: 190,
    padding: 14,
  },
  cardCopy: { alignItems: "center", gap: 4 },
  cardDescription: {
    color: "#8F8F8F",
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
  },
  cardIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.12)",
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  cardTitle: {
    color: "#F8F8F8",
    fontSize: 15,
    fontWeight: "800",
  },
  cards: { flexDirection: "row", gap: 10 },
  loginAction: {
    color: "#B8A3FF",
    fontSize: 14,
    fontWeight: "800",
  },
  loginPrompt: {
    color: "#8F8F8F",
    fontSize: 14,
  },
  loginRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 22,
  },
});
