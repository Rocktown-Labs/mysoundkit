import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import { useExploreTracksQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ExploreScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    tracksQuery = useExploreTracksQuery();

  return (
    <NativeSectionScreen
      description="Discover tracks and artists from the same typed SoundKit API used by the web app."
      title="Explore"
    >
      <Text style={[styles.heading, { color: theme.text }]}>New tracks</Text>
      {tracksQuery.isLoading ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}
      {tracksQuery.error ? (
        <Text style={[styles.message, { color: theme.notification }]}>
          Explore is unavailable right now.
        </Text>
      ) : null}
      {tracksQuery.data?.map((track) => (
        <View
          key={track.id}
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.trackTitle, { color: theme.text }]}>
            {track.title}
          </Text>
          <Text style={[styles.artist, { color: theme.text }]}>
            {track.artistName}
          </Text>
        </View>
      ))}
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
  artist: { fontSize: 13, opacity: 0.65 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  heading: { fontSize: 18, fontWeight: "600" },
  message: { fontSize: 14 },
  trackTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
});
