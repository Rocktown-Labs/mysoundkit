/* eslint-disable sort-vars */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { NativeImage } from "@/components/native-image";
import { NativePhysicalMediaVisual } from "@/components/shop/physical-media-visual";
import { useCart } from "@/contexts/cart-context";
import { NAV_THEME } from "@/lib/constants";
import {
  usePublicMerchDesignQuery,
  usePublicPhysicalReleaseQuery,
} from "@/lib/soundkit-api";
import type {
  PublicMerchDesign,
  PublicPhysicalRelease,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const FORMAT_LABELS: Record<
    "cd" | "digital" | "dvd" | "vinyl_12" | "vinyl_7",
    string
  > = {
    cd: "Audio CD",
    digital: "Digital Download",
    dvd: "DVD",
    vinyl_12: '12" Vinyl',
    vinyl_7: '7" Vinyl',
  },
  formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function ShopDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; type?: string }>(),
    router = useRouter(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    id = params.id ?? "",
    type =
      params.type === "merch" || params.type === "release"
        ? params.type
        : undefined,
    merchQuery = usePublicMerchDesignQuery(id, type !== "release"),
    releaseQuery = usePublicPhysicalReleaseQuery(id, type !== "merch"),
    isLoading =
      (type === "merch" && merchQuery.isLoading) ||
      (type === "release" && releaseQuery.isLoading) ||
      (!type &&
        !merchQuery.data &&
        !releaseQuery.data &&
        (merchQuery.isLoading || releaseQuery.isLoading)),
    merch = type === "release" ? undefined : merchQuery.data,
    release = type === "merch" ? undefined : releaseQuery.data;

  if (isLoading) {
    return (
      <Container>
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      </Container>
    );
  }

  if (merch) {
    return <NativeMerchDetail merch={merch} />;
  }

  if (release) {
    return <NativePhysicalReleaseDetail release={release} />;
  }

  return (
    <Container>
      <View style={styles.center}>
        <Ionicons color="#71717A" name="cube-outline" size={40} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          Product not found
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backPill}>
          <Text style={styles.backPillText}>Back to Store</Text>
        </Pressable>
      </View>
    </Container>
  );
}

function NativeMerchDetail({ merch }: { merch: PublicMerchDesign }) {
  const { addItem } = useCart(),
    colors = [
      ...new Map(
        merch.variantDetails
          .filter((v) => v.color && v.colorCode)
          .map((v) => [
            v.colorCode as string,
            {
              color: v.color as string,
              colorCode: v.colorCode as string,
              mockupUrl: v.mockupUrl ?? null,
            },
          ])
      ).values(),
    ],
    [selectedColorCode, setSelectedColorCode] = useState<string | null>(
      colors[0]?.colorCode ?? null
    ),
    availableSizes = merch.variantDetails.filter(
      (v) =>
        v.inStock &&
        (selectedColorCode === null || v.colorCode === selectedColorCode)
    ),
    [selectedVariantId, setSelectedVariantId] = useState<string | null>(
      availableSizes[0]?.id ?? null
    ),
    [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const nextSizes = merch.variantDetails.filter(
      (v) =>
        v.inStock &&
        (selectedColorCode === null || v.colorCode === selectedColorCode)
    );
    if (!nextSizes.some((v) => v.id === selectedVariantId)) {
      setSelectedVariantId(nextSizes[0]?.id ?? null);
    }
  }, [merch.variantDetails, selectedColorCode, selectedVariantId]);

  const selectedColor = colors.find((c) => c.colorCode === selectedColorCode),
    selectedVariant = availableSizes.find((v) => v.id === selectedVariantId),
    heroImage = selectedColor?.mockupUrl ?? merch.previewMockupUrl,
    handleAddToCart = () => {
      if (!selectedVariant) {
        return;
      }
      if (process.env.EXPO_OS === "ios") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const label = [selectedVariant.color, selectedVariant.size]
        .filter(Boolean)
        .join(" / ");
      addItem({
        artistName: merch.artistName ?? undefined,
        coverArtUrl: heroImage,
        id: `${merch.id}:${selectedVariant.id}`,
        merchDesignId: merch.id,
        priceCents: merch.retailPriceCents,
        printfulVariantId: selectedVariant.id,
        purchaseMode: "physical_merch",
        quantity,
        title: label ? `${merch.title} (${label})` : merch.title,
      });
    };

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.heroFrame}>
          {heroImage ? (
            <NativeImage
              contentFit="cover"
              source={heroImage}
              style={styles.fill}
            />
          ) : (
            <View style={styles.center}>
              <Ionicons color="#71717A" name="shirt-outline" size={44} />
            </View>
          )}
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.eyebrow}>
            {merch.artistName ?? merch.brand ?? "SoundKit Creator"}
            {merch.category ? ` · ${merch.category}` : ""}
          </Text>
          <Text selectable style={styles.title}>
            {merch.title}
          </Text>
          <Text selectable style={styles.price}>
            {formatPrice(merch.retailPriceCents)}
          </Text>
        </View>

        {colors.length > 0 ? (
          <View style={styles.selectorGroup}>
            <Text style={styles.selectorLabel}>
              Color · {selectedColor?.color ?? "Default"}
            </Text>
            <View style={styles.swatchList}>
              {colors.map((color) => {
                const active = selectedColorCode === color.colorCode;
                return (
                  <Pressable
                    accessibilityLabel={color.color}
                    key={color.colorCode}
                    onPress={() => setSelectedColorCode(color.colorCode)}
                    style={[
                      styles.swatchButton,
                      { backgroundColor: color.colorCode },
                      active && styles.swatchButtonActive,
                    ]}
                  >
                    {active ? (
                      <Ionicons color="#FFFFFF" name="checkmark" size={14} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {availableSizes.length > 0 ? (
          <View style={styles.selectorGroup}>
            <Text style={styles.selectorLabel}>Size</Text>
            <View style={styles.sizeRow}>
              {availableSizes.map((variant) => {
                const active = selectedVariantId === variant.id;
                return (
                  <Pressable
                    key={variant.id}
                    onPress={() => setSelectedVariantId(variant.id)}
                    style={[styles.sizePill, active && styles.sizePillActive]}
                  >
                    <Text
                      style={[styles.sizeText, active && styles.sizeTextActive]}
                    >
                      {variant.size ?? "One Size"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.ctaRow}>
          <View style={styles.qtyBox}>
            <Pressable
              accessibilityLabel="Decrease quantity"
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              style={styles.qtyBtn}
            >
              <Ionicons color="#F8F8F8" name="remove" size={16} />
            </Pressable>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <Pressable
              accessibilityLabel="Increase quantity"
              onPress={() => setQuantity((q) => Math.min(10, q + 1))}
              style={styles.qtyBtn}
            >
              <Ionicons color="#F8F8F8" name="add" size={16} />
            </Pressable>
          </View>

          <Pressable
            disabled={!selectedVariant}
            onPress={handleAddToCart}
            style={({ pressed }) => [
              styles.ctaButton,
              !selectedVariant && { opacity: 0.45 },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons color="#09090B" name="cart-outline" size={18} />
            <Text style={styles.ctaText}>
              Add to Cart · {formatPrice(merch.retailPriceCents * quantity)}
            </Text>
          </Pressable>
        </View>

        {merch.description ? (
          <Text selectable style={styles.description}>
            {merch.description}
          </Text>
        ) : null}
      </ScrollView>
    </Container>
  );
}

function NativePhysicalReleaseDetail({
  release,
}: {
  release: PublicPhysicalRelease;
}) {
  const { addItem } = useCart(),
    router = useRouter(),
    [quantity, setQuantity] = useState(1),
    formatLabel = FORMAT_LABELS[release.mediaFormat],
    handleAddToCart = () => {
      if (process.env.EXPO_OS === "ios") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      addItem({
        artistName: release.artistName ?? undefined,
        coverArtUrl: release.coverArtUrl,
        id: release.id,
        mediaFormat: release.mediaFormat,
        physicalReleaseId: release.id,
        priceCents: release.retailPriceCents,
        purchaseMode: "physical_merch",
        quantity,
        title: `${release.title} (${formatLabel})`,
      });
    };

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.heroFrame}>
          <NativePhysicalMediaVisual
            artworkUrl={release.coverArtUrl}
            format={release.mediaFormat}
            size="lg"
          />
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.eyebrow}>
            {release.artistName ?? "SoundKit Artist"} · {formatLabel}
          </Text>
          <Text selectable style={styles.title}>
            {release.title}
          </Text>
          <Text selectable style={styles.price}>
            {formatPrice(release.retailPriceCents)}
          </Text>
          {release.includesDigitalDownload ? (
            <Text style={styles.digitalNotice}>
              Includes instant digital download in your SoundKit library
            </Text>
          ) : null}
        </View>

        {/* Format Switcher */}
        {release.siblingFormats.length > 1 ? (
          <View style={styles.selectorGroup}>
            <Text style={styles.selectorLabel}>Edition / Format</Text>
            <View style={styles.formatGrid}>
              {release.siblingFormats.map((option) => {
                const isCurrent =
                  option.mediaFormat === release.mediaFormat &&
                  option.id === release.id;
                return (
                  <Pressable
                    key={`${option.mediaFormat}-${option.id}`}
                    onPress={() => {
                      if (isCurrent) {
                        return;
                      }
                      if (option.mediaFormat === "digital") {
                        if (release.projectId) {
                          router.push(
                            `/projects/${release.projectId}` as never
                          );
                        } else if (release.trackId) {
                          router.push(`/tracks/${release.trackId}` as never);
                        }
                        return;
                      }
                      router.replace(
                        `/shop/${option.id}?type=release` as never
                      );
                    }}
                    style={[
                      styles.formatOption,
                      isCurrent && styles.formatOptionActive,
                    ]}
                  >
                    <Text style={styles.formatOptionTitle}>
                      {FORMAT_LABELS[option.mediaFormat]}
                    </Text>
                    <Text style={styles.formatOptionPrice}>
                      {formatPrice(option.retailPriceCents)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.ctaRow}>
          <View style={styles.qtyBox}>
            <Pressable
              accessibilityLabel="Decrease quantity"
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              style={styles.qtyBtn}
            >
              <Ionicons color="#F8F8F8" name="remove" size={16} />
            </Pressable>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <Pressable
              accessibilityLabel="Increase quantity"
              onPress={() => setQuantity((q) => Math.min(10, q + 1))}
              style={styles.qtyBtn}
            >
              <Ionicons color="#F8F8F8" name="add" size={16} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleAddToCart}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons color="#09090B" name="cart-outline" size={18} />
            <Text style={styles.ctaText}>
              Add to Cart · {formatPrice(release.retailPriceCents * quantity)}
            </Text>
          </Pressable>
        </View>

        {release.description ? (
          <Text selectable style={styles.description}>
            {release.description}
          </Text>
        ) : null}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  backPill: {
    borderColor: "#3F3F46",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  backPillText: { color: "#F8F8F8", fontSize: 13, fontWeight: "700" },
  center: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 32,
  },
  content: { gap: 18, padding: 18, paddingBottom: 72 },
  ctaButton: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderCurve: "continuous",
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  ctaRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  ctaText: { color: "#09090B", fontSize: 14, fontWeight: "800" },
  description: { color: "#A1A1AA", fontSize: 14, lineHeight: 21 },
  digitalNotice: { color: "#B8A3FF", fontSize: 12, fontWeight: "600" },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  eyebrow: { color: "#A1A1AA", fontSize: 12, fontWeight: "600" },
  fill: { height: "100%", width: "100%" },
  formatGrid: { gap: 8 },
  formatOption: {
    alignItems: "center",
    backgroundColor: "#0D0D10",
    borderColor: "#27272A",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formatOptionActive: {
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderColor: "#B8A3FF",
  },
  formatOptionPrice: {
    color: "#B8A3FF",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  formatOptionTitle: { color: "#F8F8F8", fontSize: 13, fontWeight: "700" },
  heroFrame: {
    aspectRatio: 1,
    backgroundColor: "#111114",
    borderColor: "#222228",
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  infoBlock: { gap: 6 },
  price: {
    color: "#B8A3FF",
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  qtyBox: {
    alignItems: "center",
    backgroundColor: "#111114",
    borderColor: "#27272A",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 4,
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  qtyValue: {
    color: "#F8F8F8",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  selectorGroup: { gap: 10 },
  selectorLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  sizePill: {
    backgroundColor: "#0D0D10",
    borderColor: "#27272A",
    borderCurve: "continuous",
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 48,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sizePillActive: { backgroundColor: "#B8A3FF", borderColor: "#B8A3FF" },
  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sizeText: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  sizeTextActive: { color: "#09090B" },
  swatchButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  swatchButtonActive: { borderColor: "#B8A3FF" },
  swatchList: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  title: { color: "#F8F8F8", fontSize: 24, fontWeight: "800" },
});
