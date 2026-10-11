import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

/** Common shell for view-all list pages: title, description, body. */
export function NativePageScreen({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description?: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.mutedText }]}>
            {description}
          </Text>
        ) : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  body: { gap: 24 },
  content: { padding: 20, paddingBottom: 48 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
});
