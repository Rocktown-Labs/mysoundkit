import { useLocalSearchParams, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { useBattleQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cover: {
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  participant: { flex: 1, gap: 4 },
  participantName: { fontSize: 13, fontWeight: "700" },
  participantsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionGap: { gap: 16 },
  statText: { fontSize: 12 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  versus: { fontSize: 15, fontWeight: "800", paddingHorizontal: 10 },
});

export default function BattleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    battle = useBattleQuery(id ?? ""),
    data = battle.data,
    tracks = data?.tracks ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Battle",
        }}
      />
      <View
        style={[
          styles.sectionGap,
          { backgroundColor: theme.background, flex: 1, padding: 20 },
        ]}
      >
        {battle.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <NativeImage
              source={tracks[0]?.cover ?? tracks[1]?.cover ?? undefined}
              style={styles.cover}
            />
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                {data.title}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <Text
                  style={[
                    styles.statText,
                    {
                      color:
                        data.status === "live"
                          ? theme.destructive
                          : theme.mutedText,
                    },
                  ]}
                >
                  {data.status === "live" ? "LIVE" : (data.status ?? "")}
                </Text>
                {data.genre != null ? (
                  <Text style={[styles.statText, { color: theme.mutedText }]}>
                    {data.genre}
                  </Text>
                ) : null}
                <Text style={[styles.statText, { color: theme.mutedText }]}>
                  {data.viewerCount.toLocaleString()} watching
                </Text>
                {data.round?.total != null ? (
                  <Text style={[styles.statText, { color: theme.mutedText }]}>
                    Round {data.round.current ?? 1}/{data.round.total}
                    {data.round.isVoting ? " • Voting" : ""}
                  </Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.participantsRow}>
                <View style={styles.participant}>
                  {tracks[0] != null ? (
                    <>
                      <Text
                        numberOfLines={2}
                        style={[styles.participantName, { color: theme.text }]}
                      >
                        {tracks[0].title}
                      </Text>
                      <Text style={{ color: theme.mutedText, fontSize: 12 }}>
                        {tracks[0].artist} • {tracks[0].votes} votes
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                      Waiting for track…
                    </Text>
                  )}
                </View>
                <Text style={[styles.versus, { color: theme.primary }]}>
                  VS
                </Text>
                <View style={[styles.participant, { alignItems: "flex-end" }]}>
                  {tracks[1] != null ? (
                    <>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.participantName,
                          { color: theme.text, textAlign: "right" },
                        ]}
                      >
                        {tracks[1].title}
                      </Text>
                      <Text
                        style={{
                          color: theme.mutedText,
                          fontSize: 12,
                          textAlign: "right",
                        }}
                      >
                        {tracks[1].artist} • {tracks[1].votes} votes
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                      Waiting for track…
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <Text
              style={{ color: theme.mutedText, fontSize: 13, lineHeight: 19 }}
            >
              Voting and live battle rooms run on the SoundKit web app. Open
              soundkit.com on desktop to join this battle room.
            </Text>
          </>
        )}
      </View>
    </>
  );
}
