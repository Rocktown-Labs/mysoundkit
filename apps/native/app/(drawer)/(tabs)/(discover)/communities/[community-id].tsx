/* oxlint-disable one-var, sort-vars, sort-keys, complexity, eqeqeq, no-eq-null, no-nested-ternary */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { useCommunitiesQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function CommunityDetailScreen() {
  const { "community-id": communityId } = useLocalSearchParams<{
      "community-id": string;
    }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    // Same key as the communities list screen so deep links share its cache
    // and land on a populated room instead of "could not be found".
    communitiesQuery = useCommunitiesQuery({ sort: "members-desc" }),
    community = (communitiesQuery.data ?? []).find(
      (item) => item.id === communityId
    ),
    { isLoading } = communitiesQuery;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Communities",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: community?.name ?? "Community",
        }}
      />
      <Container>
        {!isLoading && community == null ? (
          <View style={[styles.emptyBox, { borderColor: theme.border }]}>
            <Ionicons color="#8F8F8F" name="people-outline" size={36} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              This community could not be found.
            </Text>
          </View>
        ) : isLoading || community == null ? (
          <ActivityIndicator color={theme.primary} style={styles.loader} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            style={{ backgroundColor: theme.background }}
          >
            <>
              <View style={styles.hero}>
                <NativeImage
                  source={community.coverImageUrl ?? undefined}
                  style={styles.heroImage}
                />
                <View
                  style={[
                    styles.heroScrim,
                    { backgroundColor: theme.background },
                  ]}
                />
              </View>

              <View style={styles.card}>
                <View style={styles.identityRow}>
                  <View style={styles.avatar}>
                    <NativeImage
                      source={community.artist.avatarUrl ?? undefined}
                      style={styles.avatarImage}
                    />
                  </View>
                  <View style={styles.identityText}>
                    <Text style={styles.name}>{community.name}</Text>
                    <Link asChild href={`/artist/${community.artist.username}`}>
                      <Pressable>
                        <Text style={styles.artistLink}>
                          {community.artist.name}
                        </Text>
                      </Pressable>
                    </Link>
                  </View>
                </View>

                <View style={styles.statRow}>
                  <StatChip
                    icon="people-outline"
                    label="Members"
                    value={community.memberCount.toLocaleString()}
                  />
                  <StatChip
                    icon="musical-notes-outline"
                    label="Genre"
                    value={community.genre?.name ?? "—"}
                  />
                  <StatChip
                    icon="card-outline"
                    label="Price"
                    value={
                      community.monthlyPriceCents > 0
                        ? `$${(community.monthlyPriceCents / 100).toFixed(2)}/mo`
                        : "Free"
                    }
                  />
                </View>

                {community.description ? (
                  <Text style={styles.description}>
                    {community.description}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityHint={
                    community.isMember
                      ? "You are already a member"
                      : "Joins this community"
                  }
                  accessibilityLabel={community.isMember ? "Joined" : "Join"}
                  accessibilityRole="button"
                  onPress={() => {
                    // Membership checkout lands with the billing phase.
                  }}
                  style={({ pressed }) => [
                    styles.joinButton,
                    community.isMember && styles.joinButtonSecondary,
                    pressed && {
                      opacity: 0.85,
                      transform: [{ scale: 0.97 }],
                    },
                  ]}
                >
                  <Ionicons
                    color={community.isMember ? "#B8A3FF" : "#171717"}
                    name={
                      community.isMember ? "checkmark-circle" : "add-circle"
                    }
                    size={18}
                  />
                  <Text
                    style={[
                      styles.joinButtonText,
                      community.isMember && { color: "#B8A3FF" },
                    ]}
                  >
                    {community.isMember ? "Joined" : "Join Community"}
                  </Text>
                </Pressable>

                <View style={styles.chatNote}>
                  <Ionicons
                    color="#8F8F8F"
                    name="chatbubble-ellipses-outline"
                    size={16}
                  />
                  <Text style={styles.chatNoteText}>
                    Member chat, posts, and drops open here once you join.
                  </Text>
                </View>
              </View>
            </>
          </ScrollView>
        )}
      </Container>
    </>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons color="#B8A3FF" name={icon} size={15} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  artistLink: { color: "#B8A3FF", fontSize: 13, fontWeight: "700" },
  avatar: {
    borderColor: "#212121",
    borderRadius: 20,
    borderWidth: 1,
    height: 72,
    overflow: "hidden",
    width: 72,
  },
  avatarImage: { backgroundColor: "#0B0B0B", height: "100%", width: "100%" },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "#212121",
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    marginHorizontal: 16,
    marginTop: -48,
    padding: 18,
  },
  chatNote: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  chatNoteText: {
    color: "#8F8F8F",
    flex: 1,
    fontSize: 12,
  },
  content: { paddingBottom: 48 },
  description: {
    color: "#F8F8F8",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyBox: {
    alignItems: "center",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    flex: 1,
    gap: 8,
    justifyContent: "center",
    margin: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  hero: { height: 180, width: "100%" },
  heroImage: { backgroundColor: "#0B0B0B", height: "100%", width: "100%" },
  heroScrim: {
    bottom: -1,
    height: 70,
    opacity: 0.92,
    position: "absolute",
    width: "100%",
  },
  identityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  identityText: { flex: 1, gap: 3 },
  joinButton: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 13,
  },
  joinButtonSecondary: { backgroundColor: "rgba(184, 163, 255, 0.16)" },
  joinButtonText: {
    color: "#171717",
    fontSize: 14,
    fontWeight: "800",
  },
  loader: { marginTop: 48 },
  name: {
    color: "#F8F8F8",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  statChip: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  statLabel: { color: "#8F8F8F", fontSize: 11, fontWeight: "600" },
  statRow: { flexDirection: "row", gap: 8 },
  statValue: { color: "#F8F8F8", fontSize: 14, fontWeight: "800" },
});
