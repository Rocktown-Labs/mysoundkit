/* oxlint-disable one-var, sort-vars, sort-keys, complexity, eqeqeq, no-eq-null, no-nested-ternary, prefer-string-replace-all */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { resolveApiUrl, useLibraryPurchasesQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

export default function PurchaseDetailScreen() {
  const { "purchase-id": purchaseId } = useLocalSearchParams<{ "purchase-id": string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    purchasesQuery = useLibraryPurchasesQuery(),
    purchase = (purchasesQuery.data ?? []).find(
      (item) => item.id === purchaseId || item.productId === purchaseId
    ),
    downloadUrl = purchase?.downloadUrl
      ? resolveApiUrl(purchase.downloadUrl)
      : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Purchased",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: purchase?.title ?? "Purchase",
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: theme.background }}
        >
          {purchasesQuery.isLoading ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : (purchase == null ? (
            <View style={[styles.emptyBox, { borderColor: theme.border }]}>
              <Ionicons color="#8F8F8F" name="bag-outline" size={36} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                This purchase could not be found.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.heroCard}>
                <View style={styles.cover}>
                  <NativeImage
                    source={purchase.cover ?? undefined}
                    style={styles.coverImage}
                  />
                </View>
                <View style={styles.ownedPill}>
                  <Ionicons color="#171717" name="checkmark" size={11} />
                  <Text style={styles.ownedPillText}>Owned</Text>
                </View>
                <View style={styles.headerCopy}>
                  <Text style={[styles.title, { color: theme.text }]}>
                    {purchase.title}
                  </Text>
                  <Text style={[styles.artist, { color: theme.primary }]}>
                    {purchase.artist}
                  </Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {purchase.productType.replaceAll(/_/gu, " ")}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {purchase.purchaseMode.replaceAll(/_/gu, " ")}
                  </Text>
                </View>
                {purchase.licenseName ? (
                  <View style={[styles.badge, styles.licenseBadge]}>
                    <Ionicons
                      color="#B8A3FF"
                      name="shield-checkmark-outline"
                      size={12}
                    />
                    <Text style={[styles.badgeText, { color: "#B8A3FF" }]}>
                      {purchase.licenseName}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.metaGrid}>
                <MetaChip label="Paid" value={purchase.priceLabel} />
                <MetaChip
                  label="Purchased"
                  value={formatDate(purchase.purchasedAt)}
                />
                {purchase.duration ? (
                  <MetaChip label="Length" value={purchase.duration} />
                ) : null}
              </View>

              {downloadUrl ? (
                <Pressable
                  accessibilityHint="Downloads the purchased file"
                  accessibilityLabel="Download"
                  accessibilityRole="button"
                  onPress={() => {
                    void Linking.openURL(downloadUrl);
                  }}
                  style={({ pressed }) => [
                    styles.downloadButton,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Ionicons color="#171717" name="download-outline" size={18} />
                  <Text style={styles.downloadText}>Download</Text>
                </Pressable>
              ) : (
                <View style={[styles.lockedBox, { borderColor: theme.border }]}>
                  <Ionicons
                    color="#8F8F8F"
                    name="lock-closed-outline"
                    size={18}
                  />
                  <Text style={[styles.lockedText, { color: theme.mutedText }]}>
                    Your download will appear here once the release is ready.
                  </Text>
                </View>
              )}
            </>
          ))}
        </ScrollView>
      </Container>
    </>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  artist: { fontSize: 15, fontWeight: "700" },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "#212121",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeText: {
    color: "#F8F8F8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  content: {
    gap: 18,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cover: {
    borderRadius: 16,
    height: 128,
    overflow: "hidden",
    width: 128,
  },
  coverImage: { backgroundColor: "#0B0B0B", height: "100%", width: "100%" },
  downloadButton: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 13,
  },
  downloadText: {
    color: "#171717",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyBox: {
    alignItems: "center",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    paddingVertical: 36,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  headerCopy: { flex: 1, gap: 4 },
  heroCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
  },
  licenseBadge: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.12)",
    flexDirection: "row",
    gap: 5,
  },
  loader: { marginTop: 48 },
  lockedBox: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  lockedText: { flex: 1, fontSize: 13 },
  metaChip: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaLabel: { color: "#8F8F8F", fontSize: 11, fontWeight: "600" },
  metaValue: { color: "#F8F8F8", fontSize: 14, fontWeight: "800" },
  ownedPill: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 6,
    flexDirection: "row",
    gap: 3,
    left: 10,
    paddingHorizontal: 7,
    position: "absolute",
    paddingVertical: 3,
    top: 10,
  },
  ownedPillText: {
    color: "#171717",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});
