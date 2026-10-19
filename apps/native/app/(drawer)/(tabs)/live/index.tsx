/* oxlint-disable one-var, sort-vars */
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AvatarHeaderButton } from "@/components/avatar-header-button";
import { BattleCard } from "@/components/cards/battle-card";
import { PartyCard } from "@/components/cards/party-card";
import { StreamCard } from "@/components/cards/stream-card";
import { CartHeaderButton } from "@/components/cart/cart-header-button";
import { Container } from "@/components/container";
import { NativeEmptyState } from "@/components/native-collection-grid";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { useTabMenu } from "@/components/tab-menu-sheets";
import { NAV_THEME } from "@/lib/constants";
import {
  useBattlesQuery,
  useListeningPartiesQuery,
  usePublicLiveExperiencesQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
    content: {
      gap: 24,
      paddingBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    title: {
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
  }),
  GLOBAL_REGION = { region: "all", regionType: "global" } as const;

export default function LiveScreen() {
  const { colorScheme } = useColorScheme(),
    { openLibraryMenu } = useTabMenu(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    battles = useBattlesQuery(GLOBAL_REGION),
    streams = usePublicLiveExperiencesQuery("stream", GLOBAL_REGION),
    parties = useListeningPartiesQuery(GLOBAL_REGION);

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>Live</Text>
          <View style={styles.headerActions}>
            <CartHeaderButton />
            <AvatarHeaderButton onSinglePress={openLibraryMenu} />
          </View>
        </View>

        <NativeSection title="Live Battles" viewAllHref="/live/battles">
          <NativeRail>
            {battles.isLoading ? (
              <ActivityIndicator
                color={theme.primary}
                style={{ padding: 16 }}
              />
            ) : null}
            {(battles.data ?? []).map((battle) => (
              <BattleCard battle={battle} key={battle.id} />
            ))}
            {battles.data?.length === 0 ? (
              <NativeEmptyState>
                No battles are live right now.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        <NativeSection title="Streams" viewAllHref="/live/streams">
          <NativeRail>
            {streams.isLoading ? (
              <ActivityIndicator
                color={theme.primary}
                style={{ padding: 16 }}
              />
            ) : null}
            {(streams.data ?? []).map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
            {streams.data?.length === 0 ? (
              <NativeEmptyState>
                No live streams currently broadcasting.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        <NativeSection title="Listening Parties" viewAllHref="/live/parties">
          <NativeRail>
            {parties.isLoading ? (
              <ActivityIndicator
                color={theme.primary}
                style={{ padding: 16 }}
              />
            ) : null}
            {(parties.data ?? []).map((party) => (
              <PartyCard key={party.id} party={party} />
            ))}
            {parties.data?.length === 0 ? (
              <NativeEmptyState>
                No upcoming listening parties scheduled.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>
      </ScrollView>
    </Container>
  );
}
