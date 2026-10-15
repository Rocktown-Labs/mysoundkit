/* eslint-disable complexity, eqeqeq, no-eq-null, no-nested-ternary, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import {
  resolveApiUrl,
  useVideoCommentsQuery,
  useVideoQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
    action: { alignItems: "center", gap: 5, minWidth: 52 },
    actionLabel: { fontSize: 11, fontWeight: "700" },
    actionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    authorAvatar: { borderRadius: 22, height: 44, width: 44 },
    authorRow: { alignItems: "center", flexDirection: "row", gap: 12 },
    commentBody: { flex: 1, gap: 3 },
    commentRow: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
    commentSheet: {
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      flex: 1,
      marginTop: "28%",
      overflow: "hidden",
    },
    commentText: { fontSize: 14, lineHeight: 20 },
    commentTime: { fontSize: 11 },
    commentsList: { gap: 20, paddingBottom: 32 },
    content: { gap: 16, padding: 16, paddingBottom: 48 },
    description: { fontSize: 14, lineHeight: 21 },
    emptyComments: { paddingTop: 32, textAlign: "center" },
    handle: {
      alignSelf: "center",
      borderRadius: 999,
      height: 4,
      marginBottom: 16,
      width: 42,
    },
    meta: { fontSize: 13 },
    metadata: { gap: 5 },
    poster: {
      aspectRatio: 16 / 9,
      borderRadius: 14,
      overflow: "hidden",
      width: "100%",
    },
    screen: { flex: 1 },
    sheetBackdrop: {
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      flex: 1,
      justifyContent: "flex-end",
    },
    sheetHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 12,
    },
    sheetTitle: { fontSize: 22, fontWeight: "800" },
    subtitle: { fontSize: 15, fontWeight: "700" },
    title: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
    unavailableOverlay: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      inset: 0,
      justifyContent: "center",
      position: "absolute",
    },
    unavailableText: { color: "#FFFFFF", fontSize: 13, marginTop: 8 },
    webVideo: {
      aspectRatio: 16 / 9,
      backgroundColor: "#000000",
      borderRadius: 14,
      overflow: "hidden",
      width: "100%",
    },
  }),
  youtubeVideoIdFromUrl = (value: null | string | undefined) => {
    if (!value) {
      return null;
    }
    try {
      const url = new URL(value),
        hostname = url.hostname.toLowerCase().replace(/^www\./u, ""),
        pathSegments = url.pathname.split("/").filter(Boolean);
      if (hostname === "youtu.be") {
        return pathSegments[0] ?? null;
      }
      if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
        if (url.pathname === "/watch") {
          return url.searchParams.get("v");
        }
        if (["embed", "live", "shorts"].includes(pathSegments[0] ?? "")) {
          return pathSegments[1] ?? null;
        }
      }
    } catch {
      return null;
    }
    return null;
  };

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    video = useVideoQuery(id ?? ""),
    comments = useVideoCommentsQuery(id ?? ""),
    [commentsOpen, setCommentsOpen] = useState(false),
    { data } = video,
    youtubeVideoId = youtubeVideoIdFromUrl(data?.externalPlaybackUrl),
    youtubeEmbedSource = youtubeVideoId
      ? `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&playsinline=1&rel=0`
      : null,
    playbackSource = youtubeVideoId
      ? undefined
      : data?.sourceProvider === "mux" &&
          data.muxPlaybackId &&
          data.playbackPolicy === "public"
        ? `https://stream.mux.com/${data.muxPlaybackId}.m3u8`
        : (resolveApiUrl(data?.externalPlaybackUrl ?? null) ?? undefined),
    player = useVideoPlayer(playbackSource ?? null, (playerInstance) => {
      if (playbackSource != null) {
        playerInstance.play();
      }
    });

  return (
    <View style={StyleSheet.flatten(styles.screen)}>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Video",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={StyleSheet.flatten({
          backgroundColor: theme.background,
        })}
      >
        {video.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {youtubeEmbedSource ? (
              <WebView
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                source={{ uri: youtubeEmbedSource }}
                style={styles.webVideo}
              />
            ) : playbackSource ? (
              <VideoView
                allowsPictureInPicture
                contentFit="contain"
                fullscreenOptions={{ enable: true }}
                player={player}
                style={styles.poster}
              />
            ) : (
              <View style={styles.poster}>
                <NativeImage
                  contentFit="cover"
                  source={data.thumbnailUrl ?? undefined}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.unavailableOverlay}>
                  <Ionicons
                    color="#FFFFFF"
                    name="play-circle-outline"
                    size={48}
                  />
                  <Text style={styles.unavailableText}>
                    This video has no public playback yet.
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.metadata}>
              <Text
                style={StyleSheet.flatten([
                  styles.title,
                  { color: theme.text },
                ])}
              >
                {data.title}
              </Text>
              <View style={styles.authorRow}>
                <View style={styles.authorAvatar}>
                  <NativeImage
                    contentFit="cover"
                    source={data.creatorAvatarUrl ?? undefined}
                  />
                </View>
                {data.creatorUsername ? (
                  <Link
                    href={`/artist/${data.creatorUsername}` as never}
                    asChild
                  >
                    <Text
                      style={StyleSheet.flatten([
                        styles.subtitle,
                        { color: theme.primary },
                      ])}
                    >
                      {data.creatorName ?? "SoundKit creator"}
                    </Text>
                  </Link>
                ) : (
                  <Text
                    style={StyleSheet.flatten([
                      styles.subtitle,
                      { color: theme.text },
                    ])}
                  >
                    {data.creatorName ?? "SoundKit creator"}
                  </Text>
                )}
              </View>
              <Text
                style={StyleSheet.flatten([
                  styles.meta,
                  { color: theme.mutedText },
                ])}
              >
                {(data.viewCount ?? 0).toLocaleString()} views ·{" "}
                {data.videoKind.replaceAll("_", " ")}
              </Text>
            </View>
            <View style={styles.actionRow}>
              <Pressable
                accessibilityLabel="Like video"
                accessibilityRole="button"
                style={styles.action}
              >
                <Ionicons color={theme.text} name="heart-outline" size={24} />
                <Text
                  style={StyleSheet.flatten([
                    styles.actionLabel,
                    { color: theme.mutedText },
                  ])}
                >
                  Like
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Share video"
                accessibilityRole="button"
                onPress={() => {
                  void Share.share({ message: data.title });
                }}
                style={styles.action}
              >
                <Ionicons color={theme.text} name="share-outline" size={24} />
                <Text
                  style={StyleSheet.flatten([
                    styles.actionLabel,
                    { color: theme.mutedText },
                  ])}
                >
                  Share
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Open comments"
                accessibilityRole="button"
                onPress={() => {
                  setCommentsOpen(true);
                }}
                style={styles.action}
              >
                <Ionicons
                  color={theme.text}
                  name="chatbubble-outline"
                  size={24}
                />
                <Text
                  style={StyleSheet.flatten([
                    styles.actionLabel,
                    { color: theme.mutedText },
                  ])}
                >
                  Comments {comments.data?.length ?? 0}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="More video actions"
                accessibilityRole="button"
                style={styles.action}
              >
                <Ionicons
                  color={theme.text}
                  name="ellipsis-horizontal"
                  size={24}
                />
                <Text
                  style={StyleSheet.flatten([
                    styles.actionLabel,
                    { color: theme.mutedText },
                  ])}
                >
                  More
                </Text>
              </Pressable>
            </View>
            {data.description ? (
              <View>
                <Text
                  style={StyleSheet.flatten([
                    styles.description,
                    { color: theme.text },
                  ])}
                >
                  {data.description}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setCommentsOpen(false);
        }}
        transparent
        visible={commentsOpen}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={StyleSheet.flatten([
              styles.commentSheet,
              { backgroundColor: theme.background },
            ])}
          >
            <View
              style={StyleSheet.flatten([
                styles.handle,
                { backgroundColor: theme.muted },
              ])}
            />
            <View style={styles.sheetHeader}>
              <Text
                style={StyleSheet.flatten([
                  styles.sheetTitle,
                  { color: theme.text },
                ])}
              >
                Comments {comments.data?.length ?? 0}
              </Text>
              <Pressable
                accessibilityLabel="Close comments"
                accessibilityRole="button"
                onPress={() => {
                  setCommentsOpen(false);
                }}
              >
                <Ionicons color={theme.text} name="close" size={28} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.commentsList}
              showsVerticalScrollIndicator={false}
            >
              {comments.isLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : comments.data?.length ? (
                comments.data.map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <View style={styles.authorAvatar}>
                      <NativeImage
                        contentFit="cover"
                        source={comment.authorAvatarUrl ?? undefined}
                      />
                    </View>
                    <View style={styles.commentBody}>
                      <Text
                        style={StyleSheet.flatten([
                          styles.subtitle,
                          { color: theme.text },
                        ])}
                      >
                        {comment.authorName}
                      </Text>
                      <Text
                        style={StyleSheet.flatten([
                          styles.commentText,
                          { color: theme.text },
                        ])}
                      >
                        {comment.body}
                      </Text>
                      <Text
                        style={StyleSheet.flatten([
                          styles.commentTime,
                          { color: theme.mutedText },
                        ])}
                      >
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text
                  style={StyleSheet.flatten([
                    styles.emptyComments,
                    { color: theme.mutedText },
                  ])}
                >
                  No comments yet. Start the conversation.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
