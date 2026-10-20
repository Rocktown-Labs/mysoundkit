/* oxlint-disable one-var, sort-vars */
/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

interface CreateActionItem {
  badge?: string;
  description: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}

interface CreateSectionConfig {
  description: string;
  items: [CreateActionItem, CreateActionItem, CreateActionItem];
  title: string;
}

const CREATE_SECTIONS: CreateSectionConfig[] = [
  {
    description: "Upload singles, records, and visuals",
    items: [
      {
        description: "Audio & Stems",
        href: "/dashboard/music/tracks/new",
        icon: "musical-notes",
        title: "Track",
      },
      {
        description: "Album / EP",
        href: "/dashboard/music/projects/new",
        icon: "albums",
        title: "Project",
      },
      {
        description: "Music Video",
        href: "/dashboard/music/videos/new",
        icon: "videocam",
        title: "Video",
      },
    ],
    title: "Music",
  },
  {
    description: "Broadcasts, listening rooms, and matchups",
    items: [
      {
        description: "Duel Matchup",
        href: "/dashboard/live/battles",
        icon: "trophy",
        title: "Battle",
      },
      {
        description: "OBS Stream",
        href: "/dashboard/live/streams",
        icon: "radio",
        title: "Stream",
      },
      {
        description: "Listening Room",
        href: "/dashboard/live/parties",
        icon: "headset",
        title: "Party",
      },
    ],
    title: "Live",
  },
  {
    description: "Manufacture & ship physical catalog drops",
    items: [
      {
        description: "Kunaki Audio",
        href: "/dashboard/music/projects",
        icon: "disc",
        title: "CDs",
      },
      {
        description: "12-Inch Pressing",
        href: "/dashboard/music/projects",
        icon: "disc-outline",
        title: "Vinyl",
      },
      {
        description: "Visual Editions",
        href: "/dashboard/music/videos",
        icon: "film",
        title: "DVDs",
      },
    ],
    title: "Store",
  },
  {
    description: "Fan apparel, tour prints, and accessories",
    items: [
      {
        description: "Tees & Hoodies",
        href: "/dashboard/career/settings",
        icon: "shirt",
        title: "Apparel",
      },
      {
        description: "Album Prints",
        href: "/dashboard/career/settings",
        icon: "image",
        title: "Posters",
      },
      {
        description: "Caps & Stickers",
        href: "/dashboard/career/settings",
        icon: "bag-handle",
        title: "Merch",
      },
    ],
    title: "Merch",
  },
  {
    description: "Crowd activations, promos, and announcements",
    items: [
      {
        description: "Collab Challenge",
        href: "/dashboard/music/open-verses/new",
        icon: "mic",
        title: "Open Verse",
      },
      {
        description: "Targeted Reach",
        href: "/dashboard/career/ads",
        icon: "megaphone",
        title: "Ads",
      },
      {
        description: "Fan Movement",
        href: "/dashboard/music/community",
        icon: "chatbox-ellipses",
        title: "Post",
      },
    ],
    title: "Community",
  },
];

function handleAction(href: string) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push(href as never);
}

export default function CreateScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <DashboardTopBar
          showExit={true}
          subtitle="Choose what you want to create and launch on SoundKit."
          title="Create"
        />

        <View style={styles.sections}>
          {CREATE_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {section.title}
                </Text>
                <Text style={[styles.sectionDesc, { color: theme.mutedText }]}>
                  {section.description}
                </Text>
              </View>

              {/* 3 Horizontal Buttons */}
              <View style={styles.row}>
                {section.items.map((item) => (
                  <Pressable
                    key={item.title}
                    onPress={() => handleAction(item.href)}
                    style={({ pressed }) => [
                      styles.btn,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                        opacity: pressed ? 0.85 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
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
                    <Text
                      numberOfLines={1}
                      style={[styles.btnTitle, { color: theme.text }]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.btnDesc, { color: theme.mutedText }]}
                    >
                      {item.description}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  btnDesc: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
  btnTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 64,
  },
  iconTile: {
    alignItems: "center",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  section: {
    gap: 10,
  },
  sectionDesc: {
    fontSize: 12,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sections: {
    gap: 24,
  },
});
