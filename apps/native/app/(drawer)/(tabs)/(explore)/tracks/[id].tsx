import { Link, useLocalSearchParams, Stack } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NativeImage } from "@/components/native-image";
import { TrackAudioPlayer } from "@/components/track-audio-player";
import { NAV_THEME } from "@/lib/constants";
import { useTrackQuery, resolveApiUrl } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  cover: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  header: { gap: 6 },
  link: { color: undefined, fontSize: 14, fontWeight: "600" },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  metaText: { fontSize: 12 },
  sectionGap: { gap: 18 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
});

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    track = useTrackQuery(id ?? ""),
    data = track.data;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Track",
        }}
      />
      <View
        style={[
          styles.sectionGap,
          { backgroundColor: theme.background, flex: 1, padding: 20 },
        ]}
      >
        {track.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <NativeImage
              source={data.coverArtUrl ?? undefined}
              style={styles.cover}
            />
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                {data.title}
              </Text>
              {data.artistUsername ? (
                <Link href={`/artist/${data.artistUsername}` as never} asChild>
                  <Text style={[styles.link, { color: theme.primary }]}>
                    {data.artistName}
                  </Text>
                </Link>
              ) : (
                <Text style={[styles.link, { color: theme.mutedText }]}>
                  {data.artistName}
                </Text>
              )}
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {data.genre}
                </Text>
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {data.duration}
                </Text>
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {data.plays.toLocaleString()} plays
                </Text>
                {data.bpm != null ? (
                  <Text style={[styles.metaText, { color: theme.mutedText }]}>
                    {data.bpm} BPM
                  </Text>
                ) : null}
                {data.musicalKey != null ? (
                  <Text style={[styles.metaText, { color: theme.mutedText }]}>
                    {data.musicalKey}
                  </Text>
                ) : null}
              </View>
            </View>

            {(() => {
              const playbackSrc = resolveApiUrl(
                data.playbackUrl ?? data.previewUrl ?? null
              );
              return playbackSrc != null ? (
                <TrackAudioPlayer
                  artistName={data.artistName}
                  source={playbackSrc}
                  title={data.title}
                />
              ) : (
                <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                  This track has no public audio preview yet.
                </Text>
              );
            })()}

            {(() => {
              const links = data.streamingLinks;
              const entries = links
                ? (
                    [
                      ["Spotify", links.spotify],
                      ["Apple Music", links.appleMusic],
                      ["YouTube", links.youtube],
                    ] as const
                  ).filter(([, url]) => url != null)
                : [];
              return entries.length > 0 ? (
                <View style={styles.sectionGap}>
                  {entries.map(([label, url]) => (
                    <Text
                      accessibilityRole="link"
                      key={label}
                      onPress={() => {
                        void Linking.openURL(url as string);
                      }}
                      style={{
                        color: theme.primary,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      Listen on {label}
                    </Text>
                  ))}
                </View>
              ) : null;
            })()}
          </>
        )}
      </View>
    </>
  );
}
