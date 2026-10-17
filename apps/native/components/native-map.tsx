/* oxlint-disable one-var, sort-vars, sort-keys, no-nested-ternary, eqeqeq, no-eq-null */
import { Ionicons } from "@expo/vector-icons";
import { geoAlbersUsa, geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

import { mapScopeLabel } from "@/lib/explore-region";
import type { MapScope } from "@/lib/explore-region";
import { isWorldCountryInMapScope } from "@/lib/map-country-scopes";
import { mapScopes } from "@/lib/map-scopes";

import usTopo from "../assets/maps/us-states-10m.json";
import worldTopo from "../assets/maps/world-countries-110m.json";

const VIEW = { height: 420, width: 800 } as const,
  US_VIEW = { height: 500, width: 800 } as const;

const SCOPE_PROJECTION_CONFIG: Record<
  string,
  { center: [number, number]; scale: number }
> = {
  africa: { center: [18, 2], scale: 300 },
  asia: { center: [85, 32], scale: 320 },
  canada: { center: [-105, 58], scale: 270 },
  europe: { center: [15, 54], scale: 300 },
  "latin-america": { center: [-65, -15], scale: 300 },
  mexico: { center: [-102, 23], scale: 400 },
  oceania: { center: [135, -25], scale: 420 },
};

// Web-parity dark palette (see apps/website/src/app/globals.css).
const MAP_COLORS = {
  border: "#212121",
  canvas: "#060606",
  card: "#060606",
  hovered: "#2A2D35",
  shape: "#16181D",
  shapePressed: "#2E3138",
  selected: "#A855F7",
  selectedPressed: "#C084FC",
  stroke: "#2A2D35",
  strokeSelected: "#C084FC",
  surface: "#111111",
  surfacePressed: "#0B0B0B",
  text: "#F8F8F8",
} as const;

const geographyName = (properties: unknown, id: unknown): string | null => {
  const props = properties as Record<string, unknown> | undefined,
    candidate = props?.name ?? props?.NAME ?? id;
  return typeof candidate === "string" || typeof candidate === "number"
    ? String(candidate)
    : null;
};

function useGeographies(scope: MapScope) {
  return useMemo(() => {
    if (scope === "usa") {
      const collection = feature(
        usTopo as unknown as Topology,
        (usTopo as unknown as { objects: { states: unknown } }).objects.states
      ) as unknown as FeatureCollection<Geometry>;
      return { collection, view: US_VIEW };
    }
    const collection = feature(
      worldTopo as unknown as Topology,
      (worldTopo as unknown as { objects: { countries: unknown } }).objects
        .countries
    ) as unknown as FeatureCollection<Geometry>;
    return { collection, view: VIEW };
  }, [scope]);
}

export interface NativeMapProps {
  onRegionSelect: (regionName: string | null) => void;
  onResetGlobal?: () => void;
  onScopeChange: (scope: MapScope, regionName?: null | string) => void;
  /** Non-interactive compact variant used as the Discover map preview. */
  preview?: boolean;
  scope: MapScope;
  selectedRegion: null | string;
}

export function NativeMap({
  onRegionSelect,
  onResetGlobal,
  onScopeChange,
  preview = false,
  scope,
  selectedRegion,
}: NativeMapProps) {
  const [countryPickerOpen, setCountryPickerOpen] = useState(false),
    [pressedPathName, setPressedPathName] = useState<null | string>(null),
    [canvasSize, setCanvasSize] = useState({
      height: 260,
      width: 320,
    }),
    { collection, view } = useGeographies(scope),
    paths = useMemo(() => {
      if (scope === "usa") {
        const projection = geoAlbersUsa();
        projection.fitSize([view.width, view.height], collection);
        const generator = geoPath(projection);
        return collection.features.map((geography) => ({
          d: generator(geography) ?? "",
          id: String(geography.id ?? ""),
          name: geographyName(geography.properties, geography.id),
        }));
      }

      const projection = geoMercator();
      const config = SCOPE_PROJECTION_CONFIG[scope];
      if (config) {
        projection.translate([view.width / 2, view.height / 2]);
        projection.center(config.center);
        projection.scale(config.scale);
      } else {
        projection.fitSize([view.width, view.height], collection);
      }
      const generator = geoPath(projection),
        // Scope slices (web parity): drop countries outside the active scope
        // so e.g. the Europe scope renders only European shapes instead of a
        // zoomed chunk of the world map.
        features = collection.features.filter((geography) => {
          const name = geographyName(geography.properties, geography.id);
          return name != null && isWorldCountryInMapScope(scope, name);
        });
      return features.map((geography) => ({
        d: generator(geography) ?? "",
        id: String(geography.id ?? ""),
        name: geographyName(geography.properties, geography.id),
      }));
    }, [collection, scope, view.height, view.width]),
    activeCountryLabel = mapScopeLabel(scope),
    displayRegionName = selectedRegion ?? mapScopeLabel(scope);

  const mapCard = (
    <View
      style={[
        styles.mapCard,
        {
          backgroundColor: MAP_COLORS.card,
          borderColor: MAP_COLORS.border,
        },
      ]}
    >
      {preview ? null : (
        <>
          {/* Scope dropdown selector */}
          <Pressable
            accessibilityLabel={`Change region, currently ${activeCountryLabel}`}
            accessibilityRole="button"
            onPress={() => {
              setCountryPickerOpen(!countryPickerOpen);
            }}
            style={({ pressed }) => [
              styles.countryDropdown,
              {
                backgroundColor: pressed
                  ? MAP_COLORS.surfacePressed
                  : MAP_COLORS.surface,
                borderColor: MAP_COLORS.border,
              },
            ]}
          >
            <Text style={styles.countryDropdownText}>{activeCountryLabel}</Text>
            <Ionicons
              color="#8F8F8F"
              name={countryPickerOpen ? "chevron-up" : "chevron-down"}
              size={16}
            />
          </Pressable>

          {/* Floating dropdown options when open */}
          {countryPickerOpen ? (
            <View style={styles.dropdownMenu}>
              <ScrollView bounces={false} style={styles.dropdownScroll}>
                {mapScopes.map((option) => {
                  const isSelected = scope === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        onScopeChange(option.id, null);
                        setCountryPickerOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownMenuItem,
                        {
                          backgroundColor: isSelected
                            ? "rgba(168, 85, 247, 0.15)"
                            : pressed
                              ? MAP_COLORS.surface
                              : "transparent",
                        },
                      ]}
                    >
                      <Ionicons
                        color={isSelected ? "#C084FC" : "#8F8F8F"}
                        name={option.icon as keyof typeof Ionicons.glyphMap}
                        size={14}
                      />
                      <Text
                        style={[
                          styles.dropdownMenuItemText,
                          isSelected && {
                            color: "#C084FC",
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}

      {/* Floating selected badge over map */}
      {displayRegionName ? (
        <View style={styles.floatingRegionBadge}>
          <Ionicons color="#000000" name="location-sharp" size={14} />
          <Text style={styles.floatingRegionBadgeText}>
            {displayRegionName}
          </Text>
        </View>
      ) : null}

      {/* Map SVG Canvas — explicit measured dimensions so the shapes
            always render, even inside bottom-sheet scroll containers. */}
      <View
        onLayout={(e) => {
          const { height, width } = e.nativeEvent.layout;
          setCanvasSize({ height, width });
        }}
        style={[styles.mapCanvas, preview && styles.mapCanvasPreview]}
      >
        <Svg
          height={canvasSize.height}
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${view.width} ${view.height}`}
          width={canvasSize.width}
        >
          {paths.map((path) => {
            const isSelected =
                Boolean(path.name) &&
                selectedRegion?.toLowerCase() === path.name?.toLowerCase(),
              isPressed = pressedPathName === path.name,
              interactive = !preview && path.name != null;

            return (
              <Path
                d={path.d}
                fill={
                  isSelected
                    ? isPressed
                      ? MAP_COLORS.selectedPressed
                      : MAP_COLORS.selected
                    : isPressed
                      ? MAP_COLORS.shapePressed
                      : MAP_COLORS.shape
                }
                key={path.id || path.d}
                onPress={
                  interactive
                    ? () => {
                        onRegionSelect(path.name as string);
                      }
                    : undefined
                }
                onPressIn={
                  interactive
                    ? () => {
                        setPressedPathName(path.name ?? null);
                      }
                    : undefined
                }
                onPressOut={() => {
                  setPressedPathName(null);
                }}
                stroke={
                  isSelected ? MAP_COLORS.strokeSelected : MAP_COLORS.stroke
                }
                strokeWidth={isSelected ? 1.8 : 0.6}
              />
            );
          })}
        </Svg>
      </View>

      {preview ? (
        <View style={styles.hintPill}>
          <Ionicons color="#C084FC" name="expand-outline" size={13} />
          <Text style={styles.hintText}>Tap to change region</Text>
        </View>
      ) : (
        <View style={styles.legendPill}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#2E3138" }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#A855F7" }]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
        </View>
      )}
    </View>
  );

  if (preview) {
    return <View style={styles.wrapper}>{mapCard}</View>;
  }

  return (
    <View style={styles.wrapper}>
      {/* Top action row: Reset to Global View + Selected region pill */}
      <View style={styles.topActionRow}>
        <Pressable
          accessibilityLabel="Reset to Global View"
          accessibilityRole="button"
          onPress={() => {
            onScopeChange("global", null);
            onResetGlobal?.();
          }}
          style={({ pressed }) => [
            styles.resetButton,
            {
              backgroundColor: pressed
                ? MAP_COLORS.surfacePressed
                : MAP_COLORS.card,
              borderColor: MAP_COLORS.border,
            },
          ]}
        >
          <Ionicons color={MAP_COLORS.text} name="refresh-outline" size={14} />
          <Text style={styles.resetButtonText}>Reset to Global View</Text>
        </Pressable>

        {selectedRegion ? (
          <View style={styles.selectedPillTop}>
            <Ionicons color="#C084FC" name="location-sharp" size={13} />
            <Text style={styles.selectedPillTopText}>{selectedRegion}</Text>
          </View>
        ) : null}
      </View>

      {mapCard}
    </View>
  );
}

const styles = StyleSheet.create({
  countryDropdown: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: 140,
  },
  countryDropdownText: {
    color: "#F8F8F8",
    fontSize: 14,
    fontWeight: "700",
  },
  dropdownMenu: {
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    left: 16,
    maxHeight: 220,
    overflow: "hidden",
    position: "absolute",
    top: 60,
    width: 180,
    zIndex: 50,
  },
  dropdownMenuItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownMenuItemText: {
    color: "#F8F8F8",
    fontSize: 13,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  floatingRegionBadge: {
    alignItems: "center",
    backgroundColor: "#A855F7",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    right: 16,
    top: 16,
    zIndex: 10,
  },
  floatingRegionBadgeText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
  hintPill: {
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 12,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  hintText: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "600",
  },
  legendDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendPill: {
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 16,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  legendText: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "600",
  },
  mapCanvas: {
    height: 260,
    justifyContent: "center",
    marginTop: 8,
    width: "100%",
  },
  mapCanvasPreview: {
    height: 150,
  },
  mapCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  resetButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resetButtonText: {
    color: "#F8F8F8",
    fontSize: 12,
    fontWeight: "700",
  },
  selectedPillTop: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedPillTopText: {
    color: "#F8F8F8",
    fontSize: 12,
    fontWeight: "700",
  },
  topActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  wrapper: {
    width: "100%",
  },
});

export default memo(NativeMap);
