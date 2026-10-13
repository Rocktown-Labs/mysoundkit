import { Ionicons } from "@expo/vector-icons";
import { geoAlbersUsa, geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

import { NAV_THEME } from "@/lib/constants";
import type { MapScope } from "@/lib/explore-region";
import { useColorScheme } from "@/lib/use-color-scheme";

import usTopo from "../assets/maps/us-states-10m.json";
import worldTopo from "../assets/maps/world-countries-110m.json";

const VIEW = { height: 420, width: 800 } as const,
  US_VIEW = { height: 500, width: 800 } as const;

export const COUNTRY_OPTIONS = [
  { id: "usa", label: "USA" },
  { id: "canada", label: "Canada" },
  { id: "mexico", label: "Mexico" },
  { id: "uk", label: "United Kingdom" },
  { id: "germany", label: "Germany" },
  { id: "france", label: "France" },
  { id: "japan", label: "Japan" },
  { id: "australia", label: "Australia" },
  { id: "global", label: "Worldwide" },
] as const;

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
  onScopeChange: (scope: MapScope) => void;
  scope: MapScope;
  selectedRegion: null | string;
}

export function NativeMap({
  onRegionSelect,
  onResetGlobal,
  onScopeChange,
  scope,
  selectedRegion,
}: NativeMapProps) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [countryPickerOpen, setCountryPickerOpen] = useState(false),
    { collection, view } = useGeographies(scope),
    paths = useMemo(() => {
      const projection = scope === "usa" ? geoAlbersUsa() : geoMercator();
      projection.fitSize([view.width, view.height], collection);
      const generator = geoPath(projection);
      return collection.features.map((geography) => ({
        d: generator(geography) ?? "",
        id: String(geography.id ?? ""),
        name: geographyName(geography.properties, geography.id),
      }));
    }, [collection, scope, view.height, view.width]),
    activeCountryLabel =
      COUNTRY_OPTIONS.find((c) => c.id === scope)?.label ??
      (scope === "usa" ? "USA" : "Worldwide"),
    displayRegionName =
      selectedRegion ?? (scope === "usa" ? "Arkansas" : "Global");

  return (
    <View style={styles.wrapper}>
      {/* Top action row: Reset to Global View + Selected region pill */}
      <View style={styles.topActionRow}>
        <Pressable
          accessibilityLabel="Reset to Global View"
          accessibilityRole="button"
          onPress={() => {
            onScopeChange("global");
            onRegionSelect(null);
            onResetGlobal?.();
          }}
          style={({ pressed }) => [
            styles.resetButton,
            {
              backgroundColor: pressed ? "#27272a" : "#18181b",
              borderColor: "#27272a",
            },
          ]}
        >
          <Ionicons color="#f4f4f5" name="refresh-outline" size={14} />
          <Text style={styles.resetButtonText}>Reset to Global View</Text>
        </Pressable>

        {selectedRegion ? (
          <View style={styles.selectedPillTop}>
            <Ionicons color="#c084fc" name="location-sharp" size={13} />
            <Text style={styles.selectedPillTopText}>{selectedRegion}</Text>
          </View>
        ) : null}
      </View>

      {/* Main Map Card */}
      <View
        style={[
          styles.mapCard,
          { backgroundColor: "#0b0b0e", borderColor: "#27272a" },
        ]}
      >
        {/* Country dropdown selector */}
        <Pressable
          accessibilityLabel={`Change country, currently ${activeCountryLabel}`}
          accessibilityRole="button"
          onPress={() => {
            setCountryPickerOpen(!countryPickerOpen);
          }}
          style={styles.countryDropdown}
        >
          <Text style={styles.countryDropdownText}>{activeCountryLabel}</Text>
          <Ionicons
            color="#a1a1aa"
            name={countryPickerOpen ? "chevron-up" : "chevron-down"}
            size={16}
          />
        </Pressable>

        {/* Floating dropdown options when open */}
        {countryPickerOpen ? (
          <View style={styles.dropdownMenu}>
            {COUNTRY_OPTIONS.map((country) => (
              <Pressable
                key={country.id}
                onPress={() => {
                  onScopeChange(country.id as MapScope);
                  setCountryPickerOpen(false);
                  if (country.id !== "usa") {
                    onRegionSelect(country.label);
                  }
                }}
                style={({ pressed }) => [
                  styles.dropdownMenuItem,
                  {
                    backgroundColor:
                      scope === country.id
                        ? "#a855f725"
                        : (pressed
                          ? "#27272a"
                          : "transparent"),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dropdownMenuItemText,
                    scope === country.id && {
                      color: "#c084fc",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {country.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Floating selected badge over map */}
        {displayRegionName ? (
          <View style={styles.floatingRegionBadge}>
            <Ionicons color="#000000" name="location-sharp" size={14} />
            <Text style={styles.floatingRegionBadgeText}>
              {displayRegionName}
            </Text>
          </View>
        ) : null}

        {/* Map SVG Canvas */}
        <View style={styles.mapCanvas}>
          <Svg
            preserveAspectRatio="xMidYMid meet"
            viewBox={`0 0 ${view.width} ${view.height}`}
            width="100%"
          >
            {paths.map((path) => {
              const isSelected =
                Boolean(path.name) &&
                (selectedRegion?.toLowerCase() === path.name?.toLowerCase() ||
                  (!selectedRegion &&
                    scope === "usa" &&
                    path.name?.toLowerCase() === "arkansas"));

              return (
                <Path
                  d={path.d}
                  fill={isSelected ? "#a855f7" : "#1f1f24"}
                  key={path.id || path.d}
                  onPress={
                    path.name == null
                      ? undefined
                      : () => {
                          onRegionSelect(path.name as string);
                        }
                  }
                  stroke={isSelected ? "#c084fc" : "#2d2d35"}
                  strokeWidth={isSelected ? 1.8 : 0.6}
                />
              );
            })}
          </Svg>
        </View>

        {/* Bottom Legend indicator */}
        <View style={styles.legendPill}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#3b2b52" }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#a855f7" }]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  countryDropdown: {
    alignItems: "center",
    backgroundColor: "#16161a",
    borderColor: "#27272a",
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
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "700",
  },
  dropdownMenu: {
    backgroundColor: "#18181b",
    borderColor: "#27272a",
    borderRadius: 12,
    borderWidth: 1,
    left: 16,
    maxHeight: 180,
    position: "absolute",
    top: 60,
    width: 180,
    zIndex: 50,
  },
  dropdownMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownMenuItemText: {
    color: "#e4e4e7",
    fontSize: 13,
  },
  floatingRegionBadge: {
    alignItems: "center",
    backgroundColor: "#a855f7",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    top: 72,
    zIndex: 10,
  },
  floatingRegionBadgeText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
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
    backgroundColor: "#141418",
    borderColor: "#27272a",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 16,
    flexDirection: "row",
    gap: 14,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    zIndex: 10,
  },
  legendText: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "600",
  },
  mapCanvas: {
    height: 260,
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 10,
    width: "100%",
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
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: "700",
  },
  selectedPillTop: {
    alignItems: "center",
    backgroundColor: "#1f1f24",
    borderColor: "#27272a",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedPillTopText: {
    color: "#e4e4e7",
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
