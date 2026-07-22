"use client";

import React, { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const usGeoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const worldGeoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json";

export type MapScope =
  | "global"
  | "north-america"
  | "africa"
  | "europe"
  | "asia"
  | "latin-america"
  | "oceania";

export interface RegionOption {
  center: [number, number];
  id: MapScope;
  label: string;
  projection: "geoAlbersUsa" | "geoMercator" | "geoEqualEarth";
  zoom: number;
}

export const mapScopes: RegionOption[] = [
  { center: [0, 20], id: "global", label: "Global View", projection: "geoEqualEarth", zoom: 1 },
  { center: [-96, 38], id: "north-america", label: "North America", projection: "geoAlbersUsa", zoom: 1 },
  { center: [20, 0], id: "africa", label: "Africa", projection: "geoMercator", zoom: 2.2 },
  { center: [15, 54], id: "europe", label: "Europe", projection: "geoMercator", zoom: 3.5 },
  { center: [90, 30], id: "asia", label: "Asia", projection: "geoMercator", zoom: 2 },
  { center: [-60, -15], id: "latin-america", label: "Latin America", projection: "geoMercator", zoom: 2.2 },
  { center: [135, -25], id: "oceania", label: "Oceania", projection: "geoMercator", zoom: 2.8 },
];

interface WorldAndUSAMapProps {
  mapScope: MapScope;
  onRegionSelect: (regionName: string) => void;
  selectedRegion: string | null;
}

export function WorldAndUSAMap({
  mapScope,
  onRegionSelect,
  selectedRegion,
}: WorldAndUSAMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const scopeConfig =
    mapScopes.find((s) => s.id === mapScope) ?? mapScopes[0];

  const isUSScope = mapScope === "north-america";
  const geoUrl = isUSScope ? usGeoUrl : worldGeoUrl;

  return (
    <div className="relative w-full max-w-full bg-muted/30 rounded-lg overflow-hidden border border-border/50">
      <div className="relative w-full h-[260px] sm:h-[360px] md:h-[440px] lg:h-[480px]">
        <ComposableMap
          projection={scopeConfig.projection}
          projectionConfig={{
            center: isUSScope ? undefined : scopeConfig.center,
            scale: isUSScope ? 900 : 120 * scopeConfig.zoom,
          }}
          className="w-full h-full"
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name =
                  geo.properties?.name ||
                  geo.properties?.NAME ||
                  geo.id ||
                  "Region";

                if (!name) return null;

                const isSelected =
                  selectedRegion?.toLowerCase() === name.toLowerCase();
                const isHovered =
                  hoveredRegion?.toLowerCase() === name.toLowerCase();

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onRegionSelect(name)}
                    onMouseEnter={() => setHoveredRegion(name)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    style={{
                      default: {
                        fill: isSelected
                          ? "hsl(271 91% 65%)"
                          : "hsl(240 5.9% 10%)",
                        outline: "none",
                        stroke: isSelected
                          ? "hsl(271 91% 75%)"
                          : "hsl(240 3.7% 20%)",
                        strokeWidth: isSelected ? 1.8 : 0.6,
                      },
                      hover: {
                        cursor: "pointer",
                        fill: isSelected
                          ? "hsl(271 91% 65%)"
                          : "hsl(271 70% 30%)",
                        outline: "none",
                        stroke: "hsl(271 91% 65%)",
                        strokeWidth: 1.8,
                      },
                      pressed: {
                        fill: "hsl(271 91% 65%)",
                        outline: "none",
                        stroke: "hsl(271 91% 65%)",
                        strokeWidth: 2,
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>

        {/* Hovered region tooltip */}
        {hoveredRegion && (
          <div className="absolute top-3 left-3 bg-background/95 backdrop-blur px-3 py-1.5 rounded-lg border shadow-lg z-20 pointer-events-none">
            <p className="text-xs md:text-sm font-semibold">{hoveredRegion}</p>
          </div>
        )}

        {/* Map Legend */}
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur px-3 py-2 rounded-lg border shadow-md z-10 text-xs flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded bg-primary/20 border border-primary/40" />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded bg-primary" />
            <span className="font-semibold text-foreground">Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
