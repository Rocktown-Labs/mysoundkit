import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { SoundKitBrand } from "@/components/soundkit-brand";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export function NativeSectionScreen({
  children,
  description,
  eyebrow = "SoundKit",
  title,
}: {
  children?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.brandRow}>
          <SoundKitBrand />
          <Text style={[styles.brandCaption, { color: theme.mutedText }]}>
            MOBILE APP
          </Text>
        </View>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>
          {eyebrow}
        </Text>
        <Text selectable style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
        <Text
          selectable
          style={[styles.description, { color: theme.mutedText }]}
        >
          {description}
        </Text>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  body: { gap: 22 },
  brandCaption: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 34,
  },
  content: { gap: 0, padding: 20 },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginBottom: 8,
  },
});
