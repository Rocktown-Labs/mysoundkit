import { Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { NativeSection } from "@/components/native-section";
import { NativeRail } from "@/components/native-rail";
import { FramelessCard } from "@/components/dashboard/frameless-card";
import { NAV_THEME } from "@/lib/constants";
import { useOpenVersesInfiniteQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

/* eslint-disable sort-vars */
const styles = StyleSheet.create({
    content: { gap: 20, padding: 20, paddingBottom: 48 },
  }),
  GENRE_ROWS = [
    { label: "Hip-Hop", slug: "hip-hop" },
    { label: "R&B", slug: "r-b" },
    { label: "Pop", slug: "pop" },
    { label: "Electronic", slug: "electronic" },
  ];

export default function DashboardOpenVersesScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: "Open Verses",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <View style={styles.content}>
          <DashboardPageHeader
            ctaHref="/dashboard/music/open-verses/new"
            ctaLabel="New Open Verse"
            subtitle="Invite collaborators over your beats"
            title="Open Verses"
          />
          <GenreRail genreSlug={undefined} label="Latest" signedIn={signedIn} />
          {GENRE_ROWS.map((row) => (
            <GenreRail
              genreSlug={row.slug}
              key={row.slug}
              label={row.label}
              signedIn={signedIn}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function GenreRail({
  genreSlug,
  label,
  signedIn,
}: {
  genreSlug?: string;
  label: string;
  signedIn: boolean;
}) {
  const listingsQuery = useOpenVersesInfiniteQuery(signedIn, {
      genre: genreSlug,
      limit: "10",
    }),
    listings = listingsQuery.data?.pages[0]?.items ?? [];

  if (!listingsQuery.isLoading && listings.length === 0) {
    return null;
  }

  return (
    <NativeSection description="Open verse listings" title={label}>
      <NativeRail>
        {listings.map((listing) => (
          <FramelessCard
            href="/dashboard/music/open-verses"
            image={listing.coverArtUrl}
            key={listing.id}
            title={listing.title}
            width={140}
          />
        ))}
      </NativeRail>
    </NativeSection>
  );
}
