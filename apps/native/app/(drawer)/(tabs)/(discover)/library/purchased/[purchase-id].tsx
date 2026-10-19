/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
import {
  resolveApiUrl,
  useLibraryPurchaseDetailQuery,
  useLibraryPurchasesQuery,
} from "@/lib/soundkit-api";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatProductType(productType: string, licenseName?: string | null) {
  if (licenseName) {
    return licenseName;
  }
  switch (productType) {
    case "track_download": {
      return "Track Download";
    }
    case "project_download": {
      return "Project Bundle";
    }
    case "stem_bundle": {
      return "Stem Pack";
    }
    case "beat_license": {
      return "Beat License";
    }
    default: {
      return "Digital Release";
    }
  }
}

export default function PurchaseDetailScreen() {
  const router = useRouter();
  const { "purchase-id": purchaseId } = useLocalSearchParams<{
    "purchase-id": string;
  }>();
  const detailQuery = useLibraryPurchaseDetailQuery(purchaseId ?? "");
  const purchasesQuery = useLibraryPurchasesQuery();

  const fallbackPurchase = (purchasesQuery.data ?? []).find(
    (item) => item.id === purchaseId || item.productId === purchaseId
  );
  const purchase = detailQuery.data?.purchase ?? fallbackPurchase ?? null;
  const downloads = detailQuery.data?.downloads ?? [];

  const isLoading = detailQuery.isLoading && !purchase;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Purchased",
          headerShown: true,
          headerStyle: { backgroundColor: "#060606" },
          headerTintColor: "#FFFFFF",
          title: purchase?.title ?? "Purchase Details",
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.push("/library/purchased" as never);
            }}
            style={styles.backRow}
          >
            <Ionicons color="#B8A3FF" name="arrow-back" size={16} />
            <Text style={styles.backText}>Back to Purchased Music</Text>
          </Pressable>

          {isLoading ? (
            <ActivityIndicator color="#B8A3FF" style={styles.loader} />
          ) : null}

          {!isLoading && purchase === null ? (
            <View style={styles.emptyCard}>
              <Ionicons color="#8F8F8F" name="bag-outline" size={34} />
              <Text style={styles.emptyTitle}>Purchase not found</Text>
              <Text style={styles.emptyDescription}>
                We couldn&apos;t locate this purchase in your library.
              </Text>
            </View>
          ) : null}

          {!isLoading && purchase !== null ? (
            <>
              <View style={styles.heroCard}>
                <View style={styles.coverBox}>
                  {purchase.cover ? (
                    <NativeImage
                      contentFit="cover"
                      source={purchase.cover}
                      style={styles.coverImage}
                    />
                  ) : (
                    <View style={styles.coverFallback}>
                      <Ionicons color="#8F8F8F" name="musical-note" size={32} />
                    </View>
                  )}
                </View>

                <View style={styles.heroInfo}>
                  <View style={styles.typePill}>
                    <Ionicons
                      color="#22C55E"
                      name="bag-handle-outline"
                      size={12}
                    />
                    <Text style={styles.typePillText}>
                      {formatProductType(
                        purchase.productType,
                        purchase.licenseName
                      )}
                    </Text>
                  </View>
                  <Text style={styles.title}>{purchase.title}</Text>
                  <Pressable
                    disabled={!purchase.artistSlug}
                    onPress={() => {
                      if (purchase.artistSlug) {
                        router.push(`/artist/${purchase.artistSlug}` as never);
                      }
                    }}
                  >
                    <Text style={styles.artist}>{purchase.artist}</Text>
                  </Pressable>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Paid</Text>
                      <Text style={styles.metaValue}>
                        {purchase.priceLabel}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Purchased on</Text>
                      <Text style={styles.metaValue}>
                        {formatDate(purchase.purchasedAt)}
                      </Text>
                    </View>
                    {purchase.duration ? (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Duration</Text>
                        <Text style={styles.metaValue}>
                          {purchase.duration}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={styles.downloadsCard}>
                <View style={styles.downloadsHeader}>
                  <Text style={styles.downloadsTitle}>Downloads</Text>
                  <Text style={styles.downloadsSubtitle}>
                    Files unlocked by this purchase.
                  </Text>
                </View>

                {downloads.length === 0 && purchase.downloadUrl ? (
                  <View style={styles.downloadRow}>
                    <View style={styles.downloadInfo}>
                      <Ionicons
                        color="#B8A3FF"
                        name="document-outline"
                        size={18}
                      />
                      <Text style={styles.downloadLabel}>{purchase.title}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const resolved = resolveApiUrl(purchase.downloadUrl);
                        if (resolved) {
                          void Linking.openURL(resolved);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.downloadBtn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        color="#000000"
                        name="download-outline"
                        size={15}
                      />
                      <Text style={styles.downloadBtnText}>Download</Text>
                    </Pressable>
                  </View>
                ) : null}

                {downloads.length === 0 && !purchase.downloadUrl ? (
                  <Text style={styles.noDownloadsText}>
                    No downloadable files are attached to this purchase yet.
                  </Text>
                ) : null}

                {downloads.length > 0 ? (
                  <View style={styles.downloadList}>
                    {downloads.map((download) => (
                      <View key={download.id} style={styles.downloadRow}>
                        <View style={styles.downloadInfo}>
                          <Ionicons
                            color="#B8A3FF"
                            name="musical-note-outline"
                            size={18}
                          />
                          <Text numberOfLines={2} style={styles.downloadLabel}>
                            {download.label}
                          </Text>
                        </View>
                        {download.downloadUrl ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              const resolved = resolveApiUrl(
                                download.downloadUrl
                              );
                              if (resolved) {
                                void Linking.openURL(resolved);
                              }
                            }}
                            style={({ pressed }) => [
                              styles.downloadBtn,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Ionicons
                              color="#000000"
                              name="download-outline"
                              size={15}
                            />
                            <Text style={styles.downloadBtnText}>Download</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  artist: {
    color: "#B8A3FF",
    fontSize: 14,
    fontWeight: "600",
  },
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  backText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    gap: 18,
    paddingBottom: 48,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  coverBox: {
    borderRadius: 16,
    height: 120,
    overflow: "hidden",
    width: 120,
  },
  coverFallback: {
    alignItems: "center",
    backgroundColor: "#141417",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  coverImage: {
    height: "100%",
    width: "100%",
  },
  downloadBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 10,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  downloadBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
  downloadInfo: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  downloadLabel: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  downloadList: {
    gap: 10,
  },
  downloadRow: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  downloadsCard: {
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  downloadsHeader: {
    gap: 2,
  },
  downloadsSubtitle: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  downloadsTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 32,
  },
  emptyDescription: {
    color: "#8F8F8F",
    fontSize: 13,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  heroInfo: {
    gap: 8,
  },
  loader: {
    marginTop: 40,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  metaItem: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaLabel: {
    color: "#8F8F8F",
    fontSize: 11,
  },
  metaValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  noDownloadsText: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  pressed: {
    opacity: 0.82,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  typePill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(34, 197, 94, 0.14)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: {
    color: "#22C55E",
    fontSize: 11,
    fontWeight: "700",
  },
});
