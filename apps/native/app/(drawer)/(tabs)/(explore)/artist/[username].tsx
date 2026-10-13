import { useLocalSearchParams, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { TrackCard } from "@/components/cards/track-card";
import { NativeImage } from "@/components/native-image";
import { NativeSection } from "@/components/native-section";
import { NAV_THEME } from "@/lib/constants";
import { useArtistMediaQuery, useArtistQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  avatar: { aspectRatio: 1, borderRadius: 20, overflow: "hidden", width: 120 },
  avatarRow: { alignItems: "center", flexDirection: "row", gap: 16 },
  bio: { fontSize: 14, lineHeight: 20 },
  header: { flex: 1, gap: 6 },
  name: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  sectionGap: { gap: 18 },
  stat: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  verified: { color: undefined, fontSize: 13, fontWeight: "700" },
});

export default function ArtistDetailScreen() {
  const { username } = useLocalSearchParams<{ username: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    artist = useArtistQuery(username ?? ""),
    media = useArtistMediaQuery(username ?? ""),
    data = artist.data,
    mediaData = media.data;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.name ?? "Artist",
        }}
      />
      <View
        style={[
          styles.sectionGap,
          { backgroundColor: theme.background, flex: 1, padding: 20 },
        ]}
      >
        {artist.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <NativeImage
                  source={data.avatarUrl ?? undefined}
                  style={{ height: "100%", width: "100%" }}
                />
              </View>
              <View style={styles.header}>
                <Text style={[styles.name, { color: theme.text }]}>
                  {data.name}
                </Text>
                {data.verified ? (
                  <Text style={[styles.verified, { color: theme.primary }]}>
                    ✓ Verified artist
                  </Text>
                ) : null}
                {data.genre != null ? (
                  <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                    {data.genre}
                  </Text>
                ) : null}
                <View style={styles.statsRow}>
                  <Text style={[styles.stat, { color: theme.mutedText }]}>
                    {(data.followers ?? 0).toLocaleString()} followers
                  </Text>
                  <Text style={[styles.stat, { color: theme.mutedText }]}>
                    {(data.weeklyPlays ?? 0).toLocaleString()} weekly plays
                  </Text>
                </View>
              </View>
            </View>
            {data.bio != null && data.bio.length > 0 ? (
              <Text style={[styles.bio, { color: theme.text }]}>
                {data.bio}
              </Text>
            ) : null}
            <NativeSection title="Tracks">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {(mediaData?.featuredTracks ?? mediaData?.tracks ?? []).map(
                  (track) => (
                    <TrackCard key={track.id} track={track} />
                  )
                )}
              </View>
              {(mediaData?.featuredTracks ?? mediaData?.tracks ?? []).length ===
              0 ? (
                <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                  No public tracks yet.
                </Text>
              ) : null}
            </NativeSection>
          </>
        )}
      </View>
    </>
  );
}
