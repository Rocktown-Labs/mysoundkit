/* oxlint-disable one-var, sort-vars, eqeqeq, no-eq-null, complexity */
import { useLocalSearchParams, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { TrackAudioPlayer } from "@/components/track-audio-player";
import { NAV_THEME } from "@/lib/constants";
import { useLiveExperienceQuery, resolveApiUrl } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  header: { gap: 6 },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  metaText: { fontSize: 12 },
  sectionGap: { gap: 18 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
});

export default function StreamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    stream = useLiveExperienceQuery(id ?? ""),
    { data } = stream,
    playbackSrc = resolveApiUrl(data?.playbackUrl ?? null);

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Stream",
        }}
      />
      <View
        style={[
          styles.sectionGap,
          { backgroundColor: theme.background, flex: 1, padding: 20 },
        ]}
      >
        {stream.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                {data.title}
              </Text>
              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.metaText,
                    {
                      color:
                        data.status === "live"
                          ? theme.destructive
                          : theme.mutedText,
                    },
                  ]}
                >
                  {data.status === "live" ? "LIVE" : (data.status ?? "")}
                </Text>
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {(data.viewerCount ?? 0).toLocaleString()} watching
                </Text>
              </View>
            </View>

            {playbackSrc == null ? (
              <Text
                style={{ color: theme.mutedText, fontSize: 13, lineHeight: 19 }}
              >
                {data.status === "live"
                  ? "This stream is live on the SoundKit web app — open soundkit.com to watch the broadcast room."
                  : "This broadcast has not started yet. Check back at its scheduled time."}
              </Text>
            ) : (
              <TrackAudioPlayer source={playbackSrc} title={data.title} />
            )}
          </>
        )}
      </View>
    </>
  );
}
