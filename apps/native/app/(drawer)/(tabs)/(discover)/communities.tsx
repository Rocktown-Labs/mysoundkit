/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
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

export default function CommunitiesScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    communitiesQuery = useCommunitiesQuery({ sort: "members-desc" }),
    communities = communitiesQuery.data ?? [];

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <Text style={[styles.title, { color: theme.text }]}>Communities</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Join artist-led spaces, posts, and member chat.
        </Text>

        {communitiesQuery.isLoading ? (
          <ActivityIndicator color={theme.primary} style={styles.loader} />
        ) : null}

        <View style={styles.list}>
          {communities.map((community) => {
            const priceLabel =
              community.monthlyPriceCents > 0
                ? `$${(community.monthlyPriceCents / 100).toFixed(2)}/mo`
                : "Free";
            return (
              <Link
                asChild
                href={`/communities/${community.id}`}
                key={community.id}
              >
                <Pressable
                  accessibilityLabel={`${community.name} community`}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.card,
                    { borderColor: theme.border },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={styles.coverWrap}>
                    <NativeImage
                      source={community.coverImageUrl ?? undefined}
                      style={styles.cover}
                    />
                    <View style={styles.pricePill}>
                      <Text style={styles.pricePillText}>{priceLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <Text
                        numberOfLines={1}
                        style={[styles.name, { color: theme.text }]}
                      >
                        {community.name}
                      </Text>
                      {community.isMember ? (
                        <View style={styles.memberPill}>
                          <Ionicons
                            color="#171717"
                            name="checkmark"
                            size={10}
                          />
                          <Text style={styles.memberPillText}>Joined</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.artist, { color: theme.primary }]}>
                      {community.artist.name}
                    </Text>
                    {community.description ? (
                      <Text
                        numberOfLines={2}
                        style={[styles.description, { color: theme.mutedText }]}
                      >
                        {community.description}
                      </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                      {community.genre ? (
                        <View style={styles.genreChip}>
                          <Text style={styles.genreChipText}>
                            {community.genre.name}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.membersRow}>
                        <Ionicons
                          color="#8F8F8F"
                          name="people-outline"
                          size={13}
                        />
                        <Text
                          style={[
                            styles.membersText,
                            { color: theme.mutedText },
                          ]}
                        >
                          {community.memberCount.toLocaleString()} members
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Link>
            );
          })}
        </View>

        {!communitiesQuery.isLoading && communities.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: theme.border }]}>
            <Ionicons color="#8F8F8F" name="people-outline" size={36} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No communities yet
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.mutedText }]}>
              Artist communities will appear here as they open their doors.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  artist: { fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardBody: { gap: 5, padding: 14 },
  cover: { backgroundColor: "#0B0B0B", height: "100%", width: "100%" },
  coverWrap: { aspectRatio: 16 / 7, width: "100%" },
  content: {
    gap: 18,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  description: { fontSize: 13, lineHeight: 18 },
  emptyBox: {
    alignItems: "center",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    paddingVertical: 36,
  },
  emptyDesc: { fontSize: 13, textAlign: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  genreChip: {
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genreChipText: {
    color: "#B8A3FF",
    fontSize: 11,
    fontWeight: "700",
  },
  list: { gap: 14 },
  loader: { paddingVertical: 24 },
  memberPill: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 6,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  memberPillText: {
    color: "#171717",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  membersRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  membersText: { fontSize: 12 },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  name: { flex: 1, fontSize: 16, fontWeight: "800" },
  pricePill: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 999,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    top: 10,
  },
  pricePillText: {
    color: "#F8F8F8",
    fontSize: 11,
    fontWeight: "800",
  },
  subtitle: { fontSize: 14 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});
