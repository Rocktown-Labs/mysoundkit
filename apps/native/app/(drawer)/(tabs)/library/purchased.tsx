import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { LibraryItemRow } from "@/components/library-item-row";
import { NAV_THEME } from "@/lib/constants";
import { useLibraryPurchasesQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function PurchasedScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: items = [], isLoading } = useLibraryPurchasesQuery();

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Link href="/library" asChild>
            <Pressable style={styles.backRow}>
              <Ionicons color="#B8A3FF" name="arrow-back" size={18} />
              <Text style={styles.backText}>My SoundKit</Text>
            </Pressable>
          </Link>
          <View style={styles.titleRow}>
            <Ionicons color="#22c55e" name="bag-handle-outline" size={26} />
            <Text style={[styles.title, { color: theme.text }]}>Purchased</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Music, drops, and physical merchandise you own
          </Text>
        </View>

        {isLoading && (
          <View style={[styles.stateBox, { borderColor: "#212121" }]}>
            <Text style={{ color: theme.mutedText }}>Loading purchases…</Text>
          </View>
        )}
        {!isLoading && items.length > 0 && (
          <View style={styles.list}>
            {items.map((item, idx) => (
              <LibraryItemRow
                badge="OWNED"
                href={`/library/purchased/${item.id}`}
                imageUrl={item.cover}
                index={idx}
                key={item.id}
                subtitle={item.artist ?? "SoundKit Creator"}
                title={item.title}
              />
            ))}
          </View>
        )}
        {!isLoading && items.length === 0 && (
          <View style={[styles.stateBox, { borderColor: "#212121" }]}>
            <Ionicons color="#8F8F8F" name="bag-handle-outline" size={36} />
            <Text style={styles.emptyTitle}>No purchases yet</Text>
            <Text style={styles.emptyDesc}>
              Support independent artists directly by purchasing singles,
              albums, or merch.
            </Text>
            <Link href="/shop" asChild>
              <Pressable style={styles.browseBtn}>
                <Text style={styles.browseBtnText}>Explore Shop</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  backText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  browseBtn: {
    backgroundColor: "#B8A3FF",
    borderRadius: 12,
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  browseBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    gap: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyDesc: {
    color: "#8F8F8F",
    fontSize: 13,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    gap: 6,
  },
  list: {
    gap: 10,
  },
  stateBox: {
    alignItems: "center",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  subtitle: {
    fontSize: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
});
