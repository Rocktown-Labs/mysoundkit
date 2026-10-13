import { Link, useLocalSearchParams, Stack } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { useVideoQuery, resolveApiUrl } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  meta: { fontSize: 12 },
  poster: {
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  sectionGap: { gap: 18 },
  subtitle: { fontSize: 14, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
});

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    video = useVideoQuery(id ?? ""),
    data = video.data,
    playbackSource =
      data?.sourceProvider === "mux" && data.muxPlaybackId
        ? `https://stream.mux.com/${data.muxPlaybackId}.m3u8`
        : (resolveApiUrl(data?.externalPlaybackUrl ?? null) ?? undefined),
    player = useVideoPlayer(playbackSource ?? null, (playerInstance) => {
      if (playbackSource != null) {
        playerInstance.play();
      }
    });

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Video",
        }}
      />
      <View
        style={[
          styles.sectionGap,
          { backgroundColor: theme.background, flex: 1, padding: 20 },
        ]}
      >
        {video.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : playbackSource == null ? (
          <>
            <NativeImage
              source={data.thumbnailUrl ?? undefined}
              style={styles.poster}
            />
            <Text style={{ color: theme.mutedText, fontSize: 13 }}>
              This video has no public playback available yet.
            </Text>
          </>
        ) : (
          <VideoView
            allowsPictureInPicture
            contentFit="contain"
            fullscreenOptions={{ enable: true }}
            player={player}
            style={styles.poster}
          />
        )}

        {data != null ? (
          <>
            <Text style={[styles.title, { color: theme.text }]}>
              {data.title}
            </Text>
            {data.creatorUsername ? (
              <Link href={`/artist/${data.creatorUsername}` as never} asChild>
                <Text style={[styles.subtitle, { color: theme.primary }]}>
                  {data.creatorName ?? "SoundKit creator"}
                </Text>
              </Link>
            ) : (
              <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                {data.creatorName ?? "SoundKit creator"}
              </Text>
            )}
            <Text style={[styles.meta, { color: theme.mutedText }]}>
              {data.viewCount ?? "0"} views •{" "}
              {data.videoKind.replace(/_/g, " ")}
            </Text>
            {data.description ? (
              <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>
                {data.description}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </>
  );
}
