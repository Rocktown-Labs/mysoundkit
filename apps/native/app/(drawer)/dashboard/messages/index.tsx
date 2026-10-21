/* oxlint-disable one-var, sort-vars, complexity, react/purity, react-hooks/refs, react-hooks/exhaustive-deps, react/preserve-manual-memoization */
/* eslint-disable one-var, sort-vars, complexity, react/purity, react-hooks/refs, react-hooks/exhaustive-deps, react/preserve-manual-memoization */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { NativeImage } from "@/components/native-image";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import {
  useConversationsQuery,
  useFriendsQuery,
  useMeQuery,
} from "@/lib/soundkit-api";
import type { ConversationSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

interface NoteItem {
  avatarUrl?: string;
  hasAudio?: boolean;
  id: string;
  isSelf?: boolean;
  name: string;
  noteText: string;
}

const SAMPLE_NOTES: NoteItem[] = [
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    id: "note-1",
    name: "krazesweetluv",
    noteText: "Familiar isn't always what's best I suppose..",
  },
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    id: "note-2",
    name: "Dead Party Media",
    noteText: "Have you voted? 🗳️",
  },
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
    hasAudio: true,
    id: "note-3",
    name: "Gretchen",
    noteText: "Angel - Lil Peep 🎶",
  },
  {
    avatarUrl:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150",
    id: "note-4",
    name: "Mads Henderson",
    noteText: "Mixing stems in Studio B 🎛️",
  },
];

const FALLBACK_CONVERSATIONS: (ConversationSummary & {
  isTyping?: boolean;
})[] = [
  {
    conversationType: "direct",
    id: "conv_kool_calm",
    isTyping: true,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    lastMessageBody:
      "100,000 to get a M building and fill it with businesses lol",
    lastMessageSenderId: "user_kool_calm",
    participantAvatarUrl:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    participantId: "user_kool_calm",
    participantName: "Kool Calm Influential",
    participantUsername: "kool_calm_influential",
    title: "kool_calm_influential",
    unreadCount: 1,
    updatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    conversationType: "direct",
    id: "conv_mads",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
    lastMessageBody: "Seen 15h ago",
    lastMessageSenderId: "user_mads",
    participantAvatarUrl:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150",
    participantId: "user_mads",
    participantName: "Mads Henderson",
    participantUsername: "mads_henderson",
    title: "Mads Henderson",
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
  },
  {
    conversationType: "direct",
    id: "conv_jaye",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 17).toISOString(),
    lastMessageBody: "Therapy as we speak · 17h",
    lastMessageSenderId: "user_jaye",
    participantAvatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    participantId: "user_jaye",
    participantName: "Jaye FreshEnt Gray",
    participantUsername: "jaye_freshent",
    title: "Jaye FreshEnt Gray",
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 17).toISOString(),
  },
  {
    conversationType: "direct",
    id: "conv_station",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    lastMessageBody: "Sent a message · 2d",
    lastMessageSenderId: "user_station",
    participantAvatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    participantId: "user_station",
    participantName: "The Station Bakery",
    participantUsername: "thestationbakery",
    title: "thestationbakery",
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    conversationType: "direct",
    id: "conv_dead_party",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    lastMessageBody: "😂 you not even lying lol · 3d",
    lastMessageSenderId: "user_dead_party",
    participantAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    participantId: "user_dead_party",
    participantName: "Dead Party Media",
    participantUsername: "dead_party_media",
    title: "Dead Party Media",
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
];

function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current,
    dot2 = useRef(new Animated.Value(0.3)).current,
    dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            duration: 350,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            duration: 350,
            toValue: 0.3,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = animateDot(dot1, 0),
      a2 = animateDot(dot2, 200),
      a3 = animateDot(dot3, 400);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingDotsContainer}>
      <Animated.View
        style={[styles.typingDot, { backgroundColor: color, opacity: dot1 }]}
      />
      <Animated.View
        style={[styles.typingDot, { backgroundColor: color, opacity: dot2 }]}
      />
      <Animated.View
        style={[styles.typingDot, { backgroundColor: color, opacity: dot3 }]}
      />
    </View>
  );
}

const openConversationThread = (conversationId: string) => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push(`/dashboard/messages/${conversationId}` as never);
};

export default function MessagesInboxScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    meQuery = useMeQuery(signedIn),
    user = meQuery.data?.user,
    conversationsQuery = useConversationsQuery(signedIn),
    friendsQuery = useFriendsQuery(signedIn),
    [searchQuery, setSearchQuery] = useState(""),
    [activeTab, setActiveTab] = useState<"messages" | "requests">("messages"),
    [myNote, setMyNote] = useState("In the studio 🎧"),
    [noteModalVisible, setNoteModalVisible] = useState(false),
    [noteInput, setNoteInput] = useState(""),
    [composeModalVisible, setComposeModalVisible] = useState(false),
    username = user?.username ?? user?.displayName ?? "Artist",
    conversationsList =
      conversationsQuery.data && conversationsQuery.data.length > 0
        ? conversationsQuery.data
        : FALLBACK_CONVERSATIONS,
    friends = friendsQuery.data ?? [],
    filteredConversations = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        return conversationsList;
      }
      return conversationsList.filter(
        (c) =>
          (c.title?.toLowerCase().includes(q) ?? false) ||
          (c.lastMessageBody?.toLowerCase().includes(q) ?? false) ||
          (c.participantName?.toLowerCase().includes(q) ?? false) ||
          (c.participantUsername?.toLowerCase().includes(q) ?? false)
      );
    }, [conversationsList, searchQuery]),
    totalUnread = useMemo(
      () => conversationsList.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0),
      [conversationsList]
    );

  const handleSaveNote = () => {
    if (noteInput.trim()) {
      setMyNote(noteInput.trim());
    }
    setNoteModalVisible(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Container>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <Pressable
            accessibilityLabel="Switch account or profile"
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.usernameRow}
          >
            <Text style={[styles.handleText, { color: theme.text }]}>
              {username}
            </Text>
            <Ionicons color={theme.text} name="chevron-down" size={16} />
            {totalUnread > 0 ? <View style={styles.unreadBadgeDot} /> : null}
          </Pressable>

          <Pressable
            accessibilityLabel="New message"
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setComposeModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons color={theme.text} name="create-outline" size={24} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.mutedText} name="search" size={17} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchQuery}
              placeholder="Search or ask SoundKit AI"
              placeholderTextColor={theme.mutedText}
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setSearchQuery("")}
              >
                <Ionicons
                  color={theme.mutedText}
                  name="close-circle"
                  size={16}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Notes Avatar Rail */}
          <View style={styles.notesSection}>
            <ScrollView
              contentContainerStyle={styles.notesRail}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {/* Your note */}
              <Pressable
                onPress={() => {
                  setNoteInput(myNote);
                  setNoteModalVisible(true);
                }}
                style={styles.noteItem}
              >
                <View style={styles.speechBubbleWrapper}>
                  <View
                    style={[
                      styles.speechBubble,
                      {
                        backgroundColor: "#202024",
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={2}
                      style={[styles.speechBubbleText, { color: theme.text }]}
                    >
                      {myNote || "Share a thought..."}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.bubblePointer,
                      { backgroundColor: "#202024" },
                    ]}
                  />
                </View>

                <View style={styles.avatarWrapper}>
                  <NativeImage
                    source={user?.avatarUrl}
                    style={styles.noteAvatarImage}
                  />
                  <View
                    style={[
                      styles.selfAddBadge,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <Ionicons color="#000000" name="add" size={12} />
                  </View>
                </View>

                <Text
                  numberOfLines={1}
                  style={[styles.noteNameText, { color: theme.mutedText }]}
                >
                  Your note
                </Text>
              </Pressable>

              {/* Contacts notes */}
              {SAMPLE_NOTES.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.noteItem}
                >
                  <View style={styles.speechBubbleWrapper}>
                    <View
                      style={[
                        styles.speechBubble,
                        item.hasAudio
                          ? styles.audioSpeechBubble
                          : {
                              backgroundColor: "#221C35",
                              borderColor: theme.border,
                            },
                      ]}
                    >
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.speechBubbleText,
                          {
                            color: item.hasAudio ? "#FFFFFF" : "#E9D5FF",
                          },
                        ]}
                      >
                        {item.noteText}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.bubblePointer,
                        {
                          backgroundColor: item.hasAudio
                            ? "#4C1D95"
                            : "#221C35",
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.avatarWrapper}>
                    <NativeImage
                      source={item.avatarUrl}
                      style={styles.noteAvatarImage}
                    />
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[styles.noteNameText, { color: theme.mutedText }]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Messages & Requests Header Tabs */}
          <View style={styles.tabsHeader}>
            <View style={styles.tabLeft}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab("messages");
                }}
                style={styles.activeTabBtn}
              >
                <Text
                  style={[
                    styles.tabHeading,
                    {
                      color:
                        activeTab === "messages" ? theme.text : theme.mutedText,
                    },
                  ]}
                >
                  Messages
                </Text>
              </Pressable>
              <Ionicons
                color={theme.mutedText}
                name="volume-medium-outline"
                size={16}
              />
            </View>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab("requests");
              }}
              style={styles.requestsBtn}
            >
              <Text
                style={[
                  styles.requestsText,
                  {
                    color:
                      activeTab === "requests"
                        ? theme.primary
                        : theme.mutedText,
                  },
                ]}
              >
                Requests
              </Text>
              <View
                style={[
                  styles.requestsBadge,
                  { backgroundColor: "rgba(184, 163, 255, 0.2)" },
                ]}
              >
                <Text
                  style={[styles.requestsBadgeText, { color: theme.primary }]}
                >
                  2
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Conversations Thread List */}
          {conversationsQuery.isLoading ? (
            <ActivityIndicator
              color={theme.primary}
              style={{ marginTop: 40 }}
            />
          ) : (
            <View style={styles.threadsList}>
              {filteredConversations.map((item) => {
                const contactName =
                    item.participantName ?? item.title ?? "SoundKit User",
                  handle = item.participantUsername ?? "user",
                  isOnline = true,
                  isTyping = Boolean((item as { isTyping?: boolean }).isTyping);

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openConversationThread(item.id)}
                    style={({ pressed }) => [
                      styles.threadRow,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <View style={styles.threadAvatarArea}>
                      <NativeImage
                        source={item.participantAvatarUrl}
                        style={styles.threadAvatar}
                      />
                      {isOnline ? (
                        <View style={styles.onlineBadgeGreen} />
                      ) : null}
                    </View>

                    <View style={styles.threadDetails}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.contactTitle,
                          {
                            color: theme.text,
                            fontWeight: item.unreadCount > 0 ? "800" : "600",
                          },
                        ]}
                      >
                        {handle || contactName}
                      </Text>

                      {isTyping ? (
                        <View style={styles.liveTypingRow}>
                          <Text
                            style={[
                              styles.liveTypingText,
                              { color: theme.primary },
                            ]}
                          >
                            typing
                          </Text>
                          <TypingDots color={theme.primary} />
                        </View>
                      ) : (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.snippetText,
                            {
                              color:
                                item.unreadCount > 0
                                  ? theme.text
                                  : theme.mutedText,
                              fontWeight: item.unreadCount > 0 ? "700" : "400",
                            },
                          ]}
                        >
                          {item.lastMessageBody || "Sent a message"}
                        </Text>
                      )}
                    </View>

                    <View style={styles.threadActions}>
                      <Ionicons
                        color={theme.mutedText}
                        name="camera-outline"
                        size={20}
                      />
                      {item.unreadCount > 0 ? (
                        <View
                          style={[
                            styles.unreadDot,
                            { backgroundColor: theme.primary },
                          ]}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Note Edit Modal */}
        <Modal
          animationType="fade"
          onRequestClose={() => setNoteModalVisible(false)}
          transparent
          visible={noteModalVisible}
        >
          <Pressable
            accessibilityLabel="Close modal"
            onPress={() => setNoteModalVisible(false)}
            style={styles.modalOverlay}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.noteModalCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.noteModalTitle, { color: theme.text }]}>
                Share a thought...
              </Text>
              <TextInput
                autoFocus
                maxLength={60}
                onChangeText={setNoteInput}
                placeholder="What's on your mind? (e.g. In the studio 🎧)"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.noteTextInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={noteInput}
              />
              <View style={styles.noteModalActions}>
                <Pressable
                  onPress={() => setNoteModalVisible(false)}
                  style={[
                    styles.noteBtnSecondary,
                    { borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.noteBtnSecondaryText,
                      { color: theme.mutedText },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveNote}
                  style={[
                    styles.noteBtnPrimary,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={styles.noteBtnPrimaryText}>Share</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* New Message / Compose Modal */}
        <Modal
          animationType="slide"
          onRequestClose={() => setComposeModalVisible(false)}
          transparent
          visible={composeModalVisible}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.composeCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.composeHeader}>
                <Text style={[styles.composeTitle, { color: theme.text }]}>
                  New Message
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => setComposeModalVisible(false)}
                >
                  <Ionicons color={theme.mutedText} name="close" size={22} />
                </Pressable>
              </View>

              <Text
                style={[styles.composeSubtitle, { color: theme.mutedText }]}
              >
                Collaborators & Friends
              </Text>

              <ScrollView style={{ maxHeight: 300 }}>
                {friends.length === 0 ? (
                  <Pressable
                    onPress={() => {
                      setComposeModalVisible(false);
                      openConversationThread("conv_kool_calm");
                    }}
                    style={styles.friendRow}
                  >
                    <NativeImage
                      source="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                      style={styles.friendAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.friendName, { color: theme.text }]}>
                        Kool Calm Influential
                      </Text>
                      <Text
                        style={[
                          styles.friendHandle,
                          { color: theme.mutedText },
                        ]}
                      >
                        @kool_calm_influential
                      </Text>
                    </View>
                    <Ionicons
                      color={theme.primary}
                      name="paper-plane-outline"
                      size={18}
                    />
                  </Pressable>
                ) : (
                  friends.map((friend) => (
                    <Pressable
                      key={friend.id}
                      onPress={() => {
                        setComposeModalVisible(false);
                        openConversationThread(`conv_${friend.id}`);
                      }}
                      style={styles.friendRow}
                    >
                      <NativeImage
                        source={friend.avatarUrl}
                        style={styles.friendAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.friendName, { color: theme.text }]}
                        >
                          {friend.name}
                        </Text>
                        <Text
                          style={[
                            styles.friendHandle,
                            { color: theme.mutedText },
                          ]}
                        >
                          @{friend.username}
                        </Text>
                      </View>
                      <Ionicons
                        color={theme.primary}
                        name="paper-plane-outline"
                        size={18}
                      />
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  activeTabBtn: {
    paddingVertical: 4,
  },
  audioSpeechBubble: {
    backgroundColor: "#4C1D95",
    borderColor: "#6D28D9",
  },
  avatarWrapper: {
    position: "relative",
  },
  bubblePointer: {
    borderRadius: 2,
    bottom: -3,
    height: 7,
    position: "absolute",
    transform: [{ rotate: "45deg" }],
    width: 7,
  },
  composeCard: {
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: "80%",
    padding: 20,
    width: "90%",
  },
  composeHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  composeSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  contactTitle: {
    fontSize: 15,
  },
  friendAvatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  friendHandle: {
    fontSize: 12,
  },
  friendName: {
    fontSize: 14,
    fontWeight: "700",
  },
  friendRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  handleText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  iconBtn: {
    padding: 4,
  },
  liveTypingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  liveTypingText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  noteAvatarImage: {
    borderRadius: 36,
    height: 72,
    width: 72,
  },
  noteBtnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  noteBtnPrimaryText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  noteBtnSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noteBtnSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  noteItem: {
    alignItems: "center",
    gap: 6,
    width: 86,
  },
  noteModalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 14,
  },
  noteModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 400,
    padding: 20,
    width: "90%",
  },
  noteModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  noteNameText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  noteTextInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notesRail: {
    gap: 16,
    paddingHorizontal: 16,
  },
  notesSection: {
    marginBottom: 16,
    marginTop: 6,
  },
  onlineBadgeGreen: {
    backgroundColor: "#10B981",
    borderColor: "#000000",
    borderRadius: 6,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: "absolute",
    right: 0,
    width: 12,
  },
  requestsBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  requestsBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  requestsBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  requestsText: {
    fontSize: 14,
    fontWeight: "700",
  },
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  searchBar: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selfAddBadge: {
    alignItems: "center",
    borderColor: "#000000",
    borderRadius: 10,
    borderWidth: 2,
    bottom: 0,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 20,
  },
  snippetText: {
    fontSize: 13,
  },
  speechBubble: {
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 82,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  speechBubbleText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  speechBubbleWrapper: {
    alignItems: "center",
    minHeight: 46,
  },
  tabHeading: {
    fontSize: 16,
    fontWeight: "800",
  },
  tabLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  tabsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  threadActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  threadAvatar: {
    borderRadius: 28,
    height: 56,
    width: 56,
  },
  threadAvatarArea: {
    position: "relative",
  },
  threadDetails: {
    flex: 1,
    gap: 3,
  },
  threadRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  threadsList: {
    gap: 2,
  },
  topHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  typingDot: {
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  typingDotsContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
  },
  unreadBadgeDot: {
    backgroundColor: "#EF4444",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  unreadDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  usernameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
});
