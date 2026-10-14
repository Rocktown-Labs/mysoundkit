/* oxlint-disable one-var, sort-vars, no-nested-ternary */
/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const ART_SIZE = 148,
  CARD_WIDTH = 148,
  styles = StyleSheet.create({
    art: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      height: ART_SIZE,
      justifyContent: "center",
      marginBottom: 8,
      overflow: "hidden",
      width: ART_SIZE,
    },
    artImage: { height: ART_SIZE, width: ART_SIZE },
    badge: {
      borderRadius: 999,
      bottom: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      position: "absolute",
      right: 6,
    },
    badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    cardSubtitle: { fontSize: 12, marginTop: 1, width: CARD_WIDTH },
    cardTitle: { fontSize: 14, fontWeight: "700", width: CARD_WIDTH },
    emptyBox: {
      borderRadius: 14,
      borderStyle: "dashed",
      borderWidth: 1,
      paddingVertical: 18,
    },
    emptyText: { fontSize: 13, textAlign: "center" },
    headerRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    row: { gap: 12, paddingRight: 20 },
    section: { marginBottom: 4 },
    sectionTitle: { fontSize: 20, fontWeight: "800" },
    seeAll: { fontSize: 13, fontWeight: "700" },
    stateBox: { borderRadius: 14, height: 96, justifyContent: "center" },
  });

export interface DiscoverCardData {
  badge?: string;
  href: string;
  id: string;
  imageUrl?: null | string;
  subtitle: string;
  title: string;
}

function DiscoverCard({ data }: { data: DiscoverCardData }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    isEmojiBadge = Boolean(
      data.badge &&
      !data.imageUrl &&
      (/\p{Extended_Pictographic}/u.test(data.badge) || data.badge.length <= 4)
    );

  return (
    <Link href={data.href as Href} asChild>
      <Pressable
        accessibilityLabel={`${data.title} by ${data.subtitle}`}
        accessibilityRole="button"
        style={({ pressed }) => ({
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={[
            styles.art,
            {
              backgroundColor: isEmojiBadge ? "#0d0d10" : theme.muted,
              borderColor: isEmojiBadge ? "#212121" : theme.border,
            },
          ]}
        >
          {data.imageUrl ? (
            <Image source={{ uri: data.imageUrl }} style={styles.artImage} />
          ) : isEmojiBadge ? (
            <Text style={{ fontSize: 52 }}>{data.badge}</Text>
          ) : (
            <Ionicons color={theme.mutedText} name="musical-notes" size={34} />
          )}
          {!isEmojiBadge && data.badge ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text
                style={[styles.badgeText, { color: theme.accentForeground }]}
              >
                {data.badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          selectable
          style={[styles.cardTitle, { color: theme.text }]}
        >
          {data.title}
        </Text>
        <Text
          numberOfLines={1}
          selectable
          style={[styles.cardSubtitle, { color: theme.mutedText }]}
        >
          {data.subtitle}
        </Text>
      </Pressable>
    </Link>
  );
}

/**
 * A titled Discover section that lays out its cards in a horizontal row.
 */
export function DiscoverSection({
  data,
  emptyMessage,
  isLoading,
  seeAllHref,
  title,
}: {
  data: readonly DiscoverCardData[];
  emptyMessage: string;
  isLoading?: boolean;
  seeAllHref: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text selectable style={[styles.sectionTitle, { color: theme.text }]}>
          {title}
        </Text>
        <Link href={seeAllHref as Href} asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <Text style={[styles.seeAll, { color: theme.primary }]}>
              See all
            </Text>
          </Pressable>
        </Link>
      </View>
      {isLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.primary} size="small" />
        </View>
      ) : null}
      {!isLoading && data.length === 0 ? (
        <View
          style={[
            styles.stateBox,
            styles.emptyBox,
            { borderColor: theme.border },
          ]}
        >
          <Text
            selectable
            style={[styles.emptyText, { color: theme.mutedText }]}
          >
            {emptyMessage}
          </Text>
        </View>
      ) : null}
      {!isLoading && data.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.row}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {data.map((item) => (
            <DiscoverCard data={item} key={item.id} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
