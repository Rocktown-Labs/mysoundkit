import { useLocalSearchParams, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { TrackCard } from "@/components/cards/track-card";
import { NativeImage } from "@/components/native-image";
import { NativeSection } from "@/components/native-section";
import { NAV_THEME } from "@/lib/constants";
import { usePublicProjectQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  cover: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  metaText: { fontSize: 12 },
  sectionGap: { gap: 18 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
});

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    project = usePublicProjectQuery(id ?? ""),
    data = project.data;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Project",
        }}
      />
      <View
        style={[
          styles.sectionGap,
          { backgroundColor: theme.background, flex: 1, padding: 20 },
        ]}
      >
        {project.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <NativeImage
              source={data.coverArtUrl ?? undefined}
              style={styles.cover}
            />
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                {data.title}
              </Text>
              <Text
                style={{
                  color: theme.mutedText,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {data.artistName ?? data.genre ?? "SoundKit artist"}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {data.projectType}
                </Text>
                {data.genre != null ? (
                  <Text style={[styles.metaText, { color: theme.mutedText }]}>
                    {data.genre}
                  </Text>
                ) : null}
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {data.duration ?? "0:00"}
                </Text>
              </View>
            </View>
            <NativeSection title="Tracks">
              <View style={{ gap: 12 }}>
                {(data.tracks ?? []).map((track) => (
                  <TrackCard key={track.id} track={track} />
                ))}
                {(data.tracks ?? []).length === 0 ? (
                  <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                    No tracks published in this project yet.
                  </Text>
                ) : null}
              </View>
            </NativeSection>
          </>
        )}
      </View>
    </>
  );
}
