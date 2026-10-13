import { StyleSheet, Text, View } from "react-native";

import { DiscoverSection } from "@/components/discover-section";
import type { DiscoverCardData } from "@/components/discover-section";
import { NativeMenuList } from "@/components/native-menu-list";
import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import { useDiscoverNewReleasesQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const MUSIC_MENU_ITEMS = [
    {
      description: "Songs, charts, and regional track discovery",
      href: "/tracks",
      icon: "musical-notes-outline",
      label: "Songs",
    },
    {
      description: "Albums, EPs, mixtapes, and bundles",
      href: "/projects",
      icon: "albums-outline",
      label: "Projects",
    },
    {
      description: "Music videos and visual releases",
      href: "/videos",
      icon: "videocam-outline",
      label: "Videos",
    },
    {
      description: "Browse by sound, scene, and style",
      href: "/genres",
      icon: "pricetags-outline",
      label: "Genres",
    },
    {
      description: "Paid drops and fan purchases",
      href: "/shop",
      icon: "bag-handle-outline",
      label: "Shop",
    },
  ] as const,
  styles = StyleSheet.create({
    heroCard: {
      borderRadius: 18,
      gap: 6,
      padding: 18,
    },
    heroEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
    heroTitle: { fontSize: 20, fontWeight: "800", lineHeight: 26 },
  });

export default function MusicScreen() {
  const { colorScheme } = useColorScheme(),
    newReleases = useDiscoverNewReleasesQuery({
      region: "all",
      regionType: "global",
    }),
    releaseCards: DiscoverCardData[] = (newReleases.data ?? []).map(
      (track) => ({
        href: "/tracks",
        id: track.id,
        imageUrl: track.coverArtUrl,
        subtitle: track.artistName,
        title: track.title,
      })
    ),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeSectionScreen
      description="Every release on SoundKit — charts, fresh drops, videos, and collections."
      eyebrow="Listen"
      title="Music"
    >
      <View style={[styles.heroCard, { backgroundColor: theme.text }]}>
        <Text style={[styles.heroEyebrow, { color: theme.background }]}>
          NEW THIS WEEK
        </Text>
        <Text
          selectable
          style={[styles.heroTitle, { color: theme.background }]}
        >
          Fresh drops from independent artists
        </Text>
      </View>
      <DiscoverSection
        data={releaseCards}
        emptyMessage="No new releases yet — check back soon."
        isLoading={newReleases.isLoading}
        seeAllHref="/tracks"
        title="New releases"
      />
      <NativeMenuList items={MUSIC_MENU_ITEMS} label="Browse music" />
    </NativeSectionScreen>
  );
}
