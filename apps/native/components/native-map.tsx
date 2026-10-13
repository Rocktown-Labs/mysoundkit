import { geoAlbersUsa, geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { memo, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

import { NAV_THEME } from "@/lib/constants";
import type { MapScope } from "@/lib/explore-region";
import { useColorScheme } from "@/lib/use-color-scheme";

import usTopo from "../assets/maps/us-states-10m.json";
import worldTopo from "../assets/maps/world-countries-110m.json";

const VIEW = { height: 500, width: 800 } as const,
  US_VIEW = { height: 610, width: 975 } as const;

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  scopeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  scopeTab: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scopeTabText: { fontSize: 12, fontWeight: "700" },
  hint: { fontSize: 11, paddingVertical: 4 },
});

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (usTopo as unknown as { objects: Record<string, never> }).objects.states
      ) as unknown as FeatureCollection<Geometry>;
      return { collection, view: US_VIEW };
    }
    const collection = feature(
      worldTopo as unknown as Topology,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (worldTopo as unknown as { objects: Record<string, never> }).objects
        .countries
    ) as unknown as FeatureCollection<Geometry>;
    return { collection, view: VIEW };
  }, [scope]);
}
/**
 * World / USA TopoJSON map with tap-to-select regions, mirroring the web
 * explore map (region names feed the same query params).
 */
export function NativeMap({
  onRegionSelect,
  scope,
  selectedRegion,
  onScopeChange,
}: {
  onRegionSelect: (regionName: string) => void;
  onScopeChange: (scope: MapScope) => void;
  scope: MapScope;
  selectedRegion: null | string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
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
    [hint, setHint] = useState<string | null>(null);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.muted, borderColor: theme.border },
      ]}
    >
      <View style={styles.scopeRow}>
        {(["global", "usa"] as const).map((tab) => (
          <Text
            accessibilityRole="button"
            key={tab}
            onPress={() => {
              onScopeChange(tab);
            }}
            style={[
              styles.scopeTab,
              styles.scopeTabText,
              {
                backgroundColor: scope === tab ? theme.primary : theme.card,
                color:
                  scope === tab ? theme.primaryForeground : theme.mutedText,
              },
            ]}
          >
            {tab === "global" ? "World" : "USA"}
          </Text>
        ))}
      </View>
      <Svg
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${view.width} ${view.height}`}
      >
        {paths.map((path) => {
          const isSelected =
            selectedRegion != null &&
            path.name != null &&
            path.name === selectedRegion;
          return (
            <Path
              d={path.d}
              fill={isSelected ? theme.primary : theme.muted}
              key={path.id || path.d}
              onPress={
                path.name == null
                  ? undefined
                  : () => {
                      setHint(path.name);
                      onRegionSelect(path.name as string);
                    }
              }
              stroke={isSelected ? theme.primary : theme.border}
              strokeWidth={isSelected ? 1.8 : 0.6}
            />
          );
        })}
      </Svg>
      <Text style={[styles.hint, { color: theme.mutedText }]} numberOfLines={1}>
        {hint == null
          ? "Tap a country or state to focus your feed."
          : `Region selected: ${hint}`}
      </Text>
    </View>
  );
}

export default memo(NativeMap);
