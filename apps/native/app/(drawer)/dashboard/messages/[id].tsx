/* oxlint-disable one-var, sort-vars, complexity, react/purity, react-hooks/refs, react-hooks/exhaustive-deps, react/preserve-manual-memoization */
/* eslint-disable one-var, sort-vars, complexity, react/purity, react-hooks/refs, react-hooks/exhaustive-deps, react/preserve-manual-memoization */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  useConversationMessagesQuery,
  useMarkConversationReadMutation,
  useMeQuery,
  useSendMessageMutation,
} from "@/lib/soundkit-api";
import type { MessageSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

interface ChatMessage {
  attachments?: {
    displayName: string;
    mimeType?: string;
    sourceProjectId?: string;
    sourceTrackId?: string;
    thumbnailUrl?: string;
    url: string;
  }[];
  body: string;
  createdAt: string;
  id: string;
  isSelf: boolean;
  senderName?: string;
}

const SLASH_COMMANDS = [
  {
    command: "/collab",
    description: "Send a shared draft project proposal with 24h expiration",
    label: "Start Collaboration",
  },
  {
    command: "/share",
    description: "Attach and share playable tracks or kits from your library",
    label: "Share Music",
  },
  {
    command: "/help",
    description: "Display SoundKit chat commands and shortcuts",
    label: "Chat Help",
  },
];

const INITIAL_KOOL_CALM_MESSAGES: ChatMessage[] = [
  {
    attachments: [
      {
        displayName: "Commercial Banking & Real Estate Moves",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400",
        url: "https://soundkit.app/videos/bank-preview",
      },
    ],
    body: "Nigga opened a bank and making his own money equivalent to usd?",
    createdAt: "8:57 AM",
    id: "msg-1",
    isSelf: false,
    senderName: "kool_calm_influential",
  },
  {
    body: "niggas funneling they money through they own bank without the guarantee lol",
    createdAt: "8:58 AM",
    id: "msg-2",
    isSelf: true,
  },
  {
    body: "Legends lol",
    createdAt: "8:59 AM",
    id: "msg-3",
    isSelf: false,
    senderName: "kool_calm_influential",
  },
  {
    body: "when you cop commercial real estate you only need 10% down lol",
    createdAt: "9:00 AM",
    id: "msg-4",
    isSelf: true,
  },
  {
    body: "100,000 to get a M building and fill it with businesses lol",
    createdAt: "9:01 AM",
    id: "msg-5",
    isSelf: true,
  },
];

function TypingBubble({ color }: { color: string }) {
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
    <View style={styles.typingBubble}>
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

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ id?: string }>(),
    conversationId = params.id ?? "conv_kool_calm",
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    meQuery = useMeQuery(signedIn),
    user = meQuery.data?.user,
    messagesQuery = useConversationMessagesQuery(conversationId, signedIn),
    sendMessageMutation = useSendMessageMutation(conversationId),
    markReadMutation = useMarkConversationReadMutation(conversationId),
    scrollViewRef = useRef<ScrollView>(null),
    [inputText, setInputText] = useState(""),
    [isOtherUserTyping, setIsOtherUserTyping] = useState(false),
    [localMessages, setLocalMessages] = useState<ChatMessage[]>(
      INITIAL_KOOL_CALM_MESSAGES
    ),
    [showSlashMenu, setShowSlashMenu] = useState(false),
    [collabModalVisible, setCollabModalVisible] = useState(false),
    [collabTitle, setCollabTitle] = useState("New Collaboration Draft"),
    contactUsername =
      conversationId === "conv_kool_calm"
        ? "kool_calm_influential"
        : conversationId.replace("conv_", ""),
    serverMessages = messagesQuery.data ?? [];

  // Mark conversation read on mount
  useEffect(() => {
    if (signedIn && conversationId) {
      markReadMutation.mutate();
    }
  }, [conversationId, markReadMutation, signedIn]);

  // Simulate typing response if chatting with demo user
  useEffect(() => {
    if (conversationId === "conv_kool_calm") {
      const timer = setTimeout(() => {
        setIsOtherUserTyping(true);
        const hideTimer = setTimeout(() => {
          setIsOtherUserTyping(false);
        }, 4000);
        return () => clearTimeout(hideTimer);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [conversationId]);

  // Format server messages if present
  const mergedMessages: ChatMessage[] = useMemo(() => {
    if (serverMessages.length > 0) {
      return serverMessages.map((m: MessageSummary) => ({
        attachments: m.attachments?.map((a) => ({
          displayName: a.displayName,
          mimeType: a.mimeType ?? undefined,
          thumbnailUrl: a.url,
          url: a.url,
        })),
        body: m.body,
        createdAt: new Date(m.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        id: m.id,
        isSelf: m.senderId === user?.id,
        senderName: contactUsername,
      }));
    }
    return localMessages;
  }, [contactUsername, localMessages, serverMessages, user?.id]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.startsWith("/")) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlashCommand = (cmd: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSlashMenu(false);
    if (cmd === "/collab") {
      setCollabModalVisible(true);
      setInputText("");
    } else if (cmd === "/share") {
      setInputText("Shared track: SoundKit Master Audio 🔥");
    } else {
      setInputText("");
    }
  };

  const handleSendMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newMsg: ChatMessage = {
      body: trimmed,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      id: `local-${Date.now()}`,
      isSelf: true,
    };

    setLocalMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setShowSlashMenu(false);

    if (signedIn && conversationId) {
      sendMessageMutation.mutate({ body: trimmed });
    }

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendCollabProposal = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newMsg: ChatMessage = {
      attachments: [
        {
          displayName: collabTitle,
          thumbnailUrl:
            "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400",
          url: "https://soundkit.app/collab",
        },
      ],
      body: `Shared a collaboration proposal: "${collabTitle}" (Expires in 24h)`,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      id: `local-collab-${Date.now()}`,
      isSelf: true,
    };

    setLocalMessages((prev) => [...prev, newMsg]);
    setCollabModalVisible(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <Container>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        style={[styles.screen, { backgroundColor: theme.background }]}
      >
        {/* Thread Top Bar */}
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: theme.background,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={styles.topBarLeft}>
            <Pressable
              accessibilityLabel="Back to messages"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={styles.backBtn}
            >
              <Ionicons color={theme.text} name="chevron-back" size={26} />
            </Pressable>

            <View style={styles.contactInfoRow}>
              <View style={styles.contactAvatarArea}>
                <NativeImage
                  source="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                  style={styles.contactAvatar}
                />
              </View>

              <View style={styles.contactNames}>
                <Text
                  numberOfLines={1}
                  style={[styles.headerName, { color: theme.text }]}
                >
                  {contactUsername}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.headerSub, { color: theme.mutedText }]}
                >
                  Business chat
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.topBarRight}>
            <Pressable
              accessibilityLabel="Call"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              }}
              style={styles.topIconBtn}
            >
              <Ionicons color={theme.text} name="call-outline" size={22} />
            </Pressable>

            <Pressable
              accessibilityLabel="Video chat"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              }}
              style={styles.topIconBtn}
            >
              <Ionicons color={theme.text} name="videocam-outline" size={24} />
            </Pressable>
          </View>
        </View>

        {/* Message Bubble Stream */}
        <ScrollView
          contentContainerStyle={styles.streamContent}
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.timestampHeader}>
            <Text
              style={[styles.timestampHeaderText, { color: theme.mutedText }]}
            >
              8:57 AM
            </Text>
          </View>

          {mergedMessages.map((msg) => {
            const hasAttachment = msg.attachments && msg.attachments.length > 0;

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  msg.isSelf ? styles.messageRowSelf : styles.messageRowOther,
                ]}
              >
                {msg.isSelf ? null : (
                  <View style={styles.msgAvatarWrapper}>
                    <NativeImage
                      source="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                      style={styles.miniMsgAvatar}
                    />
                  </View>
                )}

                <View style={styles.bubbleCol}>
                  {/* Embedded Video/Track Attachment Card if present */}
                  {hasAttachment ? (
                    <View
                      style={[
                        styles.attachmentCard,
                        {
                          backgroundColor: "#1C1C1E",
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <NativeImage
                        source={msg.attachments?.[0]?.thumbnailUrl}
                        style={styles.attachmentThumb}
                      />
                      <View style={styles.attachmentOverlay}>
                        <View style={styles.playIconCircle}>
                          <Ionicons color="#FFFFFF" name="play" size={18} />
                        </View>
                        <Text numberOfLines={1} style={styles.attachmentTitle}>
                          {msg.attachments?.[0]?.displayName}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Message Bubble */}
                  <View
                    style={[
                      styles.bubble,
                      msg.isSelf
                        ? [styles.bubbleSelf, { backgroundColor: "#7A5AF8" }]
                        : [styles.bubbleOther, { backgroundColor: "#262626" }],
                    ]}
                  >
                    <Text style={[styles.bubbleText, { color: "#FFFFFF" }]}>
                      {msg.body}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isOtherUserTyping ? (
            <View style={[styles.messageRow, styles.messageRowOther]}>
              <View style={styles.msgAvatarWrapper}>
                <NativeImage
                  source="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                  style={styles.miniMsgAvatar}
                />
              </View>
              <TypingBubble color="#B8A3FF" />
            </View>
          ) : null}
        </ScrollView>

        {/* Slash Command Suggestions Drawer */}
        {showSlashMenu ? (
          <View
            style={[
              styles.slashCommandsMenu,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.slashCommandsHeader}>
              <Ionicons
                color={theme.primary}
                name="terminal-outline"
                size={14}
              />
              <Text style={[styles.slashCommandsTitle, { color: theme.text }]}>
                SoundKit Commands
              </Text>
            </View>
            {SLASH_COMMANDS.map((item) => (
              <Pressable
                key={item.command}
                onPress={() => handleSelectSlashCommand(item.command)}
                style={({ pressed }) => [
                  styles.slashCommandRow,
                  {
                    backgroundColor: pressed ? "#1E1E24" : "transparent",
                  },
                ]}
              >
                <View style={styles.slashCommandBadge}>
                  <Text style={styles.slashCommandBadgeText}>
                    {item.command}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.slashCommandLabel, { color: theme.text }]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.slashCommandDesc,
                      { color: theme.mutedText },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Bottom Input Action Bar */}
        <View
          style={[
            styles.inputBarWrapper,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
            },
          ]}
        >
          {/* Camera Button */}
          <Pressable
            accessibilityLabel="Camera"
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.cameraBtn}
          >
            <Ionicons color="#FFFFFF" name="camera" size={18} />
          </Pressable>

          {/* Text Input */}
          <View
            style={[
              styles.inputBox,
              { backgroundColor: "#1C1C1E", borderColor: theme.border },
            ]}
          >
            <TextInput
              autoCapitalize="sentences"
              multiline
              onChangeText={handleInputChange}
              placeholder="Message... (try /collab or /share)"
              placeholderTextColor="#737373"
              style={[styles.textInput, { color: "#FFFFFF" }]}
              value={inputText}
            />

            {/* Input Right Actions */}
            <View style={styles.inputRightIcons}>
              {inputText.trim().length === 0 ? (
                <>
                  <Pressable
                    hitSlop={6}
                    onPress={() => {
                      void Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                    }}
                    style={styles.inputActionIcon}
                  >
                    <Ionicons color="#A3A3A3" name="mic-outline" size={20} />
                  </Pressable>
                  <Pressable
                    hitSlop={6}
                    onPress={() => {
                      void Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                    }}
                    style={styles.inputActionIcon}
                  >
                    <Ionicons color="#A3A3A3" name="image-outline" size={20} />
                  </Pressable>
                  <Pressable
                    hitSlop={6}
                    onPress={() => {
                      void Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                    }}
                    style={styles.inputActionIcon}
                  >
                    <Ionicons color="#A3A3A3" name="happy-outline" size={20} />
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityLabel="Send message"
                  accessibilityRole="button"
                  onPress={handleSendMessage}
                  style={styles.sendBtn}
                >
                  <Ionicons color="#FFFFFF" name="arrow-up" size={18} />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Collab Proposal Modal */}
        <Modal
          animationType="fade"
          onRequestClose={() => setCollabModalVisible(false)}
          transparent
          visible={collabModalVisible}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.collabCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.collabHeader, { color: theme.text }]}>
                Draft Collaboration Proposal
              </Text>
              <Text style={[styles.collabSub, { color: theme.mutedText }]}>
                Send a shared project invitation with 24-hour acceptance window.
              </Text>

              <TextInput
                onChangeText={setCollabTitle}
                placeholder="Project title (e.g. Summer Mixtape Vol. 2)"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.collabInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={collabTitle}
              />

              <View style={styles.collabActions}>
                <Pressable
                  onPress={() => setCollabModalVisible(false)}
                  style={[
                    styles.collabBtnSecondary,
                    { borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.collabBtnSecondaryText,
                      { color: theme.mutedText },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSendCollabProposal}
                  style={[
                    styles.collabBtnPrimary,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={styles.collabBtnPrimaryText}>Send Proposal</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  attachmentCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
    overflow: "hidden",
    position: "relative",
    width: 220,
  },
  attachmentOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    bottom: 0,
    flexDirection: "row",
    gap: 8,
    left: 0,
    padding: 8,
    position: "absolute",
    right: 0,
  },
  attachmentThumb: {
    height: 140,
    width: "100%",
  },
  attachmentTitle: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  backBtn: {
    padding: 2,
  },
  bubble: {
    borderRadius: 20,
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleCol: {
    gap: 4,
    maxWidth: "80%",
  },
  bubbleOther: {
    borderBottomLeftRadius: 6,
  },
  bubbleSelf: {
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  cameraBtn: {
    alignItems: "center",
    backgroundColor: "#7A5AF8",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  collabActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 16,
  },
  collabBtnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  collabBtnPrimaryText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  collabBtnSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  collabBtnSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  collabCard: {
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 400,
    padding: 20,
    width: "90%",
  },
  collabHeader: {
    fontSize: 17,
    fontWeight: "800",
  },
  collabInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  collabSub: {
    fontSize: 12,
    marginTop: 4,
  },
  contactAvatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  contactAvatarArea: {
    position: "relative",
  },
  contactInfoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  contactNames: {
    gap: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 11,
  },
  inputActionIcon: {
    padding: 4,
  },
  inputBarWrapper: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingBottom: Platform.OS === "ios" ? 18 : 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  inputBox: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  inputRightIcons: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  messageRowOther: {
    alignItems: "flex-end",
    gap: 8,
    justifyContent: "flex-start",
  },
  messageRowSelf: {
    justifyContent: "flex-end",
  },
  miniMsgAvatar: {
    borderRadius: 14,
    height: 28,
    width: 28,
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  msgAvatarWrapper: {
    marginBottom: 2,
  },
  playIconCircle: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  screen: {
    flex: 1,
  },
  sendBtn: {
    alignItems: "center",
    backgroundColor: "#7A5AF8",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  slashCommandBadge: {
    backgroundColor: "rgba(184, 163, 255, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  slashCommandBadgeText: {
    color: "#B8A3FF",
    fontSize: 12,
    fontWeight: "700",
  },
  slashCommandDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  slashCommandLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  slashCommandRow: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slashCommandsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  slashCommandsMenu: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    marginHorizontal: 14,
    padding: 8,
  },
  slashCommandsTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  streamContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: 8,
  },
  timestampHeader: {
    alignItems: "center",
    marginVertical: 10,
  },
  timestampHeaderText: {
    fontSize: 11,
    fontWeight: "600",
  },
  topBar: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topBarLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  topBarRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  topIconBtn: {
    padding: 4,
  },
  typingBubble: {
    alignItems: "center",
    backgroundColor: "#262626",
    borderBottomLeftRadius: 6,
    borderRadius: 18,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});
