/* eslint-disable one-var, sort-vars, sort-keys, complexity, eqeqeq, no-eq-null, no-nested-ternary, react/set-state-in-effect, no-void */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { NativeImage } from "@/components/native-image";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { appendChatMessage, postLiveRoom, useLiveRoom } from "@/lib/live-room";
import type { LiveRoomArtist, LiveRoomState } from "@/lib/live-room";
import { useBattleQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const formatPhase = (phase: string) =>
  phase
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function BattleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    battle = useBattleQuery(id ?? ""),
    liveRoom = useLiveRoom(id ?? ""),
    { data: session } = authClient.useSession(),
    insets = useSafeAreaInsets(),
    [chatDraft, setChatDraft] = useState(""),
    [voteBusyArtist, setVoteBusyArtist] = useState<null | string>(null),
    [roomError, setRoomError] = useState<null | string>(null),
    { room } = liveRoom;

  const castVote = async (artist: LiveRoomArtist) => {
    if (voteBusyArtist || !room?.battle?.currentRoundId) {
      return;
    }
    setVoteBusyArtist(artist.id);
    try {
      const updated = await postLiveRoom(id ?? "", "vote", {
        artistId: artist.id,
        roundId: room.battle.currentRoundId,
      });
      liveRoom.setRoom(updated ?? null);
      void HapticLight();
    } catch (error) {
      setRoomError(
        error instanceof Error
          ? error.message
          : "Your vote could not be counted right now."
      );
    }
    setVoteBusyArtist(null);
  };

  const sendChat = async () => {
    const message = chatDraft.trim();
    if (message.length === 0) {
      return;
    }
    setChatDraft("");
    try {
      const updated = await postLiveRoom(id ?? "", "chat", {
        message,
        userName: session?.user?.name ?? "Guest",
      });
      liveRoom.setRoom((previous) => {
        const fresh = updated ?? previous;
        if (fresh) {
          return appendChatMessage(fresh, {
            avatarUrl: null,
            id: `local-${Date.now()}`,
            message,
            sentAt: new Date().toISOString(),
            userName: session?.user?.name ?? "Guest",
          });
        }
        return fresh;
      });
    } catch {
      setChatDraft(message);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Battles",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: room?.title ?? battle.data?.title ?? "Battle",
        }}
      />
      <Container>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {liveRoom.room == null && liveRoom.error == null ? (
            <ActivityIndicator
              color={theme.primary}
              style={{ marginTop: 48 }}
            />
          ) : null}

          {liveRoom.error || roomError ? (
            <View style={styles.notice}>
              <Ionicons color="#E05D4D" name="alert-circle-outline" size={15} />
              <Text style={styles.noticeText}>
                {liveRoom.error ?? roomError}
              </Text>
            </View>
          ) : null}

          {room ? (
            <BattleRoomView
              castVote={castVote}
              chatDraft={chatDraft}
              isConnected={liveRoom.isConnected}
              onChatDraftChange={setChatDraft}
              onSendChat={() => {
                void sendChat();
              }}
              room={room}
              voteBusyArtist={voteBusyArtist}
            />
          ) : room == null && liveRoom.error == null ? null : (
            battle.data && (
              <View style={styles.staticNotice}>
                <Text style={styles.staticNoticeText}>
                  This room opens when the battle goes live.
                </Text>
              </View>
            )
          )}
        </KeyboardAvoidingView>
        <View style={{ height: insets.bottom }} />
      </Container>
    </>
  );
}

/** Optimistic-feel haptic on vote commit. */
const HapticLight = async () => {
  const Haptics = await import("expo-haptics");
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

function BattleRoomView({
  castVote,
  chatDraft,
  isConnected,
  onChatDraftChange,
  onSendChat,
  room,
  voteBusyArtist,
}: {
  castVote: (artist: LiveRoomArtist) => void;
  chatDraft: string;
  isConnected: boolean;
  onChatDraftChange: (value: string) => void;
  onSendChat: () => void;
  room: LiveRoomState;
  voteBusyArtist: null | string;
}) {
  const { battle } = room,
    [artistA, artistB] = battle?.artists ?? [],
    coordination = battle?.coordination,
    round =
      battle?.rounds.find((item) => item.id === battle.currentRoundId) ??
      battle?.rounds.find((item) => item.status === "voting") ??
      battle?.rounds.find((item) => item.status === "live") ??
      null,
    votingOpen = round?.status === "voting",
    votesA = round ? (round.voteTotals[artistA?.id ?? ""] ?? 0) : 0,
    votesB = round ? (round.voteTotals[artistB?.id ?? ""] ?? 0) : 0,
    totalVotes = votesA + votesB,
    shareA = totalVotes > 0 ? votesA / totalVotes : 0.5;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status strip */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: room.status === "live" ? "#E05D4D" : "#8F8F8F",
              },
            ]}
          />
          <Text style={styles.statusText}>
            {room.status === "live"
              ? `LIVE • Rd ${coordination?.roundNumber ?? 1}${
                  coordination
                    ? `/${coordination.format.replace("best_of_", "")}`
                    : ""
                }`
              : room.status === "upcoming"
                ? "Upcoming"
                : "Ended"}
          </Text>
          {coordination ? (
            <Text style={styles.phaseText}>
              {formatPhase(coordination.phase)}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Ionicons
            color={isConnected ? "#4ADE80" : "#8F8F8F"}
            name={isConnected ? "wifi" : "wifi-outline"}
            size={14}
          />
          <Text style={styles.viewerText}>
            {room.viewerCount.toLocaleString()} watching
          </Text>
        </View>

        {/* Artists + vote bar */}
        {artistA && artistB ? (
          <View style={styles.stageCard}>
            <View style={styles.vsRow}>
              <ArtistBlock artist={artistA} align="left" />
              <Text style={styles.vsLabel}>VS</Text>
              <ArtistBlock artist={artistB} align="right" />
            </View>

            {/* Vote share bar */}
            <View style={styles.voteBar}>
              <View
                style={[styles.voteBarA, { flex: Math.max(0.05, shareA) }]}
              />
              <View style={{ flex: Math.max(0.05, 1 - shareA) }} />
            </View>

            <View style={styles.voteActionRow}>
              <Pressable
                accessibilityHint="Votes for this artist in the current round"
                accessibilityLabel={`Vote ${artistA.name}`}
                accessibilityRole="button"
                disabled={!votingOpen || voteBusyArtist !== null}
                onPress={() => {
                  void castVote(artistA);
                }}
                style={({ pressed }) => [
                  styles.voteButton,
                  !votingOpen && styles.voteDisabled,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Text
                  style={[
                    styles.voteButtonText,
                    !votingOpen && { color: "#8F8F8F" },
                  ]}
                >
                  {votesA.toLocaleString()} — {votingOpen ? "Vote" : "Locked"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityHint="Votes for this artist in the current round"
                accessibilityLabel={`Vote ${artistB.name}`}
                accessibilityRole="button"
                disabled={!votingOpen || voteBusyArtist !== null}
                onPress={() => {
                  void castVote(artistB);
                }}
                style={({ pressed }) => [
                  styles.voteButton,
                  !votingOpen && styles.voteDisabled,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Text
                  style={[
                    styles.voteButtonText,
                    !votingOpen && { color: "#8F8F8F" },
                  ]}
                >
                  {votingOpen ? "Vote" : "Locked"} — {votesB.toLocaleString()}
                </Text>
              </Pressable>
            </View>

            {/* Round tracks */}
            {round ? (
              <View style={styles.roundTracks}>
                <Text style={styles.roundTracksLabel}>
                  Round {round.number}
                  {round.isTiebreaker ? " (tiebreaker)" : ""}
                </Text>
                <Text style={styles.roundTrack} numberOfLines={1}>
                  {round.artistATrack.title} vs {round.artistBTrack.title}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Rounds scoreboard */}
        {battle && battle.rounds.length > 0 ? (
          <View style={styles.roundsCard}>
            <Text style={styles.cardHeading}>Rounds</Text>
            {battle.rounds.map((item) => (
              <View key={item.id} style={styles.roundRow}>
                <Text style={styles.roundNumber}>R{item.number}</Text>
                <Text numberOfLines={1} style={styles.roundTrackRow}>
                  {item.artistATrack.title} vs {item.artistBTrack.title}
                </Text>
                <Text
                  style={[
                    styles.roundStatus,
                    item.status === "complete" && { color: "#4ADE80" },
                    item.status === "voting" && { color: "#B8A3FF" },
                  ]}
                >
                  {item.status === "complete"
                    ? "Done"
                    : item.status === "voting"
                      ? "Voting"
                      : item.status === "live"
                        ? "Live"
                        : "Queued"}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Chat */}
        <View style={styles.chatCard}>
          <Text style={styles.cardHeading}>Room Chat</Text>
          {room.chat.length === 0 ? (
            <Text style={styles.chatEmpty}>
              No messages yet — say something when the room is live.
            </Text>
          ) : (
            room.chat.slice(-30).map((message) => (
              <View key={message.id} style={styles.chatRow}>
                <Text style={styles.chatName}>{message.userName}</Text>
                <Text style={styles.chatBody}>{message.message}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Chat composer */}
      <View style={styles.composerRow}>
        <TextInput
          onChangeText={onChatDraftChange}
          onSubmitEditing={onSendChat}
          placeholder="Send a message…"
          placeholderTextColor="#8F8F8F"
          returnKeyType="send"
          style={styles.composerInput}
          value={chatDraft}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onSendChat}
          style={({ pressed }) => [
            styles.composerSend,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons color="#171717" name="send" size={17} />
        </Pressable>
      </View>
    </View>
  );
}

function ArtistBlock({
  align,
  artist,
}: {
  align: "left" | "right";
  artist: LiveRoomArtist;
}) {
  return (
    <View style={align === "right" ? styles.artistRight : styles.artistLeft}>
      <View style={styles.artistAvatar}>
        <NativeImage
          source={artist.avatarUrl || undefined}
          style={{ height: "100%", width: "100%" }}
        />
      </View>
      <Text numberOfLines={1} style={styles.artistName}>
        {artist.name}
      </Text>
      <Text style={styles.artistMeta}>
        {artist.roundsWon} won{artist.rank ? ` • #${artist.rank}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  artistAvatar: {
    borderColor: "#212121",
    borderRadius: 22,
    borderWidth: 1,
    height: 84,
    overflow: "hidden",
    width: 84,
  },
  artistLeft: { alignItems: "center", flex: 1, gap: 5 },
  artistMeta: { color: "#8F8F8F", fontSize: 11 },
  artistName: { color: "#F8F8F8", fontSize: 14, fontWeight: "800" },
  artistRight: { alignItems: "center", flex: 1, gap: 5 },
  body: { flex: 1 },
  cardHeading: {
    color: "#F8F8F8",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  chatBody: {
    color: "#F8F8F8",
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  chatCard: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  chatEmpty: { color: "#8F8F8F", fontSize: 12 },
  chatName: {
    color: "#B8A3FF",
    fontSize: 12,
    fontWeight: "800",
    marginRight: 8,
  },
  chatRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 8,
  },
  composerInput: {
    backgroundColor: "#0B0B0B",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    color: "#F8F8F8",
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  composerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  composerSend: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  content: {
    gap: 14,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  notice: {
    alignItems: "center",
    backgroundColor: "rgba(224, 93, 77, 0.12)",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    color: "#E05D4D",
    flex: 1,
    fontSize: 12,
  },
  phaseText: {
    color: "#B8A3FF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  root: { flex: 1 },
  roundNumber: { color: "#8F8F8F", fontSize: 12, fontWeight: "800", width: 24 },
  roundRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  roundStatus: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  roundTrack: {
    color: "#F8F8F8",
    fontSize: 12,
    textAlign: "center",
  },
  roundTrackRow: {
    color: "#F8F8F8",
    flex: 1,
    fontSize: 12,
  },
  roundTracks: {
    alignItems: "center",
    borderTopColor: "#212121",
    borderTopWidth: 1,
    gap: 3,
    paddingTop: 10,
  },
  roundTracksLabel: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  roundsCard: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  stageCard: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  staticNotice: { padding: 20 },
  staticNoticeText: { color: "#8F8F8F", fontSize: 13, textAlign: "center" },
  statusDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  statusText: {
    color: "#F8F8F8",
    fontSize: 12,
    fontWeight: "800",
  },
  viewerText: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  voteActionRow: { flexDirection: "row", gap: 10 },
  voteBar: {
    backgroundColor: "#111111",
    borderRadius: 999,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
    width: "100%",
  },
  voteBarA: { backgroundColor: "#B8A3FF" },
  voteButton: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 11,
  },
  voteButtonText: {
    color: "#171717",
    fontSize: 13,
    fontWeight: "800",
  },
  voteDisabled: { backgroundColor: "rgba(255, 255, 255, 0.06)" },
  vsLabel: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "900",
  },
  vsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
});
