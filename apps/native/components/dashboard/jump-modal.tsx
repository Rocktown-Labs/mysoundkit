/* oxlint-disable one-var, sort-vars */
/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LiquidGlassView } from "@/components/liquid-glass";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface DashboardJumpItem {
  badge?: string;
  description: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}

export function DashboardJumpModal({
  items,
  onClose,
  subtitle = "Jump directly to any section",
  title,
  visible,
}: {
  items: DashboardJumpItem[];
  onClose: () => void;
  subtitle?: string;
  title: string;
  visible: boolean;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    handleSelect = (href: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
      router.push(href as never);
    },
    handleExitToSoundKit = () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onClose();
      router.replace("/(drawer)/(tabs)/(discover)" as never);
    };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.modalWrapper}
        >
          <LiquidGlassView
            borderRadius={22}
            style={styles.card}
            variant="sheet"
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {title}
                </Text>
                <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                  {subtitle}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close navigation menu"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    backgroundColor: pressed ? "#2A2A2A" : "#1A1A1A",
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons color="#8F8F8F" name="close" size={18} />
              </Pressable>
            </View>

            {/* List */}
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
            >
              {items.map((item) => (
                <Pressable
                  key={item.href}
                  onPress={() => handleSelect(item.href)}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: pressed
                        ? "rgba(184, 163, 255, 0.08)"
                        : "rgba(255, 255, 255, 0.03)",
                      borderColor: theme.border,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconTile,
                      {
                        backgroundColor: "rgba(184, 163, 255, 0.12)",
                      },
                    ]}
                  >
                    <Ionicons
                      color={theme.primary}
                      name={item.icon}
                      size={20}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemTitleRow}>
                      <Text
                        numberOfLines={1}
                        style={[styles.itemTitle, { color: theme.text }]}
                      >
                        {item.title}
                      </Text>
                      {item.badge ? (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: theme.primary },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: theme.primaryForeground },
                            ]}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.itemDesc, { color: theme.mutedText }]}
                    >
                      {item.description}
                    </Text>
                  </View>
                  <Ionicons color="#555555" name="chevron-forward" size={16} />
                </Pressable>
              ))}
            </ScrollView>

            {/* Bottom Exit Action */}
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <Pressable
                onPress={handleExitToSoundKit}
                style={({ pressed }) => [
                  styles.exitBtn,
                  {
                    backgroundColor: pressed ? "#212121" : "#111111",
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons color={theme.primary} name="arrow-back" size={15} />
                <Text style={[styles.exitBtnText, { color: theme.text }]}>
                  Exit to SoundKit (Fan View)
                </Text>
              </Pressable>
            </View>
          </LiquidGlassView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  card: {
    padding: 18,
    width: "100%",
  },
  closeBtn: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  exitBtn: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 11,
    width: "100%",
  },
  exitBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  footer: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 14,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconTile: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  item: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  list: {
    gap: 8,
  },
  modalWrapper: {
    maxWidth: 420,
    width: "100%",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
});
