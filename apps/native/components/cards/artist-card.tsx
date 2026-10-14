/* oxlint-disable one-var, sort-vars, eqeqeq, no-eq-null */
import { StyleSheet, Text, View } from "react-native";

import { CardMeta, NativeCardShell } from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { ArtistSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const ARTIST_CARD_WIDTH = 130;

const styles = StyleSheet.create({
    avatar: { borderRadius: 16, overflow: "hidden" },
    avatarWrapper: {
      alignItems: "center",
      aspectRatio: 1,
      justifyContent: "center",
      width: "100%",
    },
    fallbackText: {
      fontSize: 34,
      fontWeight: "800",
      opacity: 0.4,
    },
    genreBadge: {
      borderRadius: 6,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    genreText: { fontSize: 10, fontWeight: "700" },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      paddingBottom: 10,
    },
    metaText: { fontSize: 11 },
    verified: { fontSize: 11, marginLeft: 2 },
  }),
  THUMB_RATIO = { aspectRatio: 1 };

export function ArtistCard({ artist }: { artist: ArtistSummary }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeCardShell
      href={`/artist/${artist.username}`}
      width={ARTIST_CARD_WIDTH}
    >
      <View style={styles.avatarWrapper}>
        {artist.avatarUrl == null ? (
          <Text style={[styles.fallbackText, { color: theme.mutedText }]}>
            {artist.name.slice(0, 2).toUpperCase()}
          </Text>
        ) : (
          <NativeImage
            source={artist.avatarUrl}
            style={[THUMB_RATIO, styles.avatar]}
          />
        )}
      </View>
      <CardMeta
        subtitle={artist.genre ?? undefined}
        subtitleColor={theme.mutedText}
        title={artist.name}
        titleColor={theme.text}
      />
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: theme.mutedText }]}>
          {(artist.followers ?? 0).toLocaleString()} followers
        </Text>
        {artist.verified ? (
          <Text style={[styles.verified, { color: theme.primary }]}>✓</Text>
        ) : null}
      </View>
    </NativeCardShell>
  );
}
