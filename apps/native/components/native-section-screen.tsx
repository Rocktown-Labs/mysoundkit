import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export function NativeSectionScreen({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.text }]}>
          {description}
        </Text>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  content: { padding: 20 },
  description: { fontSize: 15, marginBottom: 24, opacity: 0.7 },
  title: { fontSize: 30, fontWeight: "700", marginBottom: 8 },
});
