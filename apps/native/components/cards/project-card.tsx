/* oxlint-disable one-var, sort-vars, eqeqeq, no-eq-null */
import { StyleSheet, Text, View } from "react-native";

import {
  CardBadge,
  CardMeta,
  NativeCardShell,
} from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { PublicProjectSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const PROJECT_CARD_WIDTH = 150;

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    left: 8,
    position: "absolute",
    top: 8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 4,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  metaText: { fontSize: 11 },
  thumb: { height: "100%", width: "100%" },
  thumbRatio: { aspectRatio: 1 },
});

export function ProjectCard({
  compact = false,
  project,
}: {
  compact?: boolean;
  project: PublicProjectSummary;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeCardShell
      href={`/projects/${project.slug || project.id}`}
      width={compact ? 140 : PROJECT_CARD_WIDTH}
    >
      <View style={styles.thumbRatio}>
        <NativeImage
          source={project.coverArtUrl ?? undefined}
          style={styles.thumb}
        />
        <View style={styles.badgeRow}>
          <CardBadge>{project.projectType}</CardBadge>
          {project.isForSale ? (
            <CardBadge tone="primary">Sale</CardBadge>
          ) : null}
        </View>
      </View>
      <CardMeta
        subtitle={project.artistName ?? project.genre ?? "SoundKit artist"}
        subtitleColor={theme.mutedText}
        title={project.title}
        titleColor={theme.text}
      />
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: theme.mutedText }]}>
          {project.trackCount} tracks • {project.duration ?? "0:00"}
        </Text>
      </View>
    </NativeCardShell>
  );
}
