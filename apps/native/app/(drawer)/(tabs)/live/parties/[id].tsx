/* oxlint-disable one-var, sort-vars, eqeqeq, no-eq-null, complexity */
import { useLocalSearchParams, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useListeningPartyQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
    card: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
    },
    header: { gap: 6 },
    label: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
    metaRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    metaText: { fontSize: 12 },
    sectionGap: { gap: 18 },
    title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  }),
  formatDate = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? iso
      : date.toLocaleString(undefined, {
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          month: "short",
        });
  };

export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    party = useListeningPartyQuery(id ?? ""),
    { data } = party;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Party",
        }}
      />
      <View
        style={[
          styles.sectionGap,
          { backgroundColor: theme.background, flex: 1, padding: 20 },
        ]}
      >
        {party.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.label, { color: theme.primary }]}>
                {data.status === "live" ? "LIVE PARTY" : "UPCOMING PARTY"}
              </Text>
              <Text style={[styles.title, { color: theme.text }]}>
                {data.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {formatDate(data.scheduledStartAt)}
                </Text>
                {data.genre == null ? null : (
                  <Text style={[styles.metaText, { color: theme.mutedText }]}>
                    {data.genre}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>
                {data.description ??
                  "Community Album Premiere & Listening Room"}
              </Text>
            </View>

            <Text
              style={{ color: theme.mutedText, fontSize: 13, lineHeight: 19 }}
            >
              The live listening room runs on the SoundKit web app. Open
              soundkit.com to join this party with the creator and other fans.
            </Text>
          </>
        )}
      </View>
    </>
  );
}
