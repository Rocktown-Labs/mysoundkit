import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const CREATE_ITEMS = [
    {
      description: "Upload audio, stems, and metadata",
      href: "/dashboard/music/tracks/new",
      icon: "musical-notes" as const,
      title: "New Track",
    },
    {
      description: "Create an album, EP, or single",
      href: "/dashboard/music/projects/new",
      icon: "folder-open" as const,
      title: "New Project",
    },
    {
      description: "Mux upload or YouTube link",
      href: "/dashboard/music/videos/new",
      icon: "videocam" as const,
      title: "New Video",
    },
    {
      description: "Invite collaborators over a beat",
      href: "/dashboard/music/open-verses/new",
      icon: "mic" as const,
      title: "New Open Verse",
    },
  ],
  styles = StyleSheet.create({
    card: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 14,
      padding: 16,
    },
    iconTile: {
      alignItems: "center",
      borderRadius: 12,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    itemDescription: { fontSize: 12, marginTop: 2 },
    itemTitle: { fontSize: 15, fontWeight: "700" },
    screenTitle: {
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      marginBottom: 4,
    },
    subtitle: { fontSize: 14, marginBottom: 20 },
    tip: { fontSize: 12, fontStyle: "italic", marginTop: 16 },
  });

export default function CreateScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Container>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Create</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Choose what you want to add to SoundKit.
        </Text>
        <View style={{ gap: 10 }}>
          {CREATE_ITEMS.map((item) => (
            <Pressable
              key={item.title}
              onPress={() => {
                router.push(item.href as never);
              }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.iconTile,
                  { backgroundColor: theme.primary, opacity: 0.15 },
                ]}
              >
                <Ionicons color={theme.primary} name={item.icon} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.itemDescription, { color: theme.mutedText }]}
                >
                  {item.description}
                </Text>
              </View>
              <Ionicons
                color={theme.mutedText}
                name="chevron-forward"
                size={16}
              />
            </Pressable>
          ))}
        </View>
        <Text style={[styles.tip, { color: theme.mutedText }]}>
          Verified uploads available for Pro+
        </Text>
      </View>
    </Container>
  );
}
