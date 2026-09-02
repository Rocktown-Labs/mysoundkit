/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/set-state-in-effect */
"use client";

import { geoCentroid } from "d3-geo";
import { MapPin } from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

import { exploreRegionSlug } from "@/lib/explore-region";
import { isWorldCountryInMapScope } from "@/lib/map-country-scopes";
import { mapScopes } from "@/lib/map-scopes";
import type { MapScope } from "@/lib/map-scopes";

export interface BioMapProps {
  mapScope: MapScope;
  onRegionSelect: (regionName: string) => void;
  onScopeChange: (scope: MapScope) => void;
  selectedRegion: string | null;
}

const getUsGeoUrl = (): string => {
    try {
      return new URL("../assets/maps/us-states-10m.json", import.meta.url).href;
    } catch {
      return "/assets/maps/us-states-10m.json";
    }
  },
  getWorldGeoUrl = (): string => {
    try {
      return new URL(
        "../assets/maps/world-countries-110m.json",
        import.meta.url
      ).href;
    } catch {
      return "/assets/maps/world-countries-110m.json";
    }
  },
  geographyName = (geography: {
    id?: string | number;
    properties?: Record<string, unknown>;
  }): string | null => {
    const { properties } = geography,
      candidate =
        properties?.name ??
        properties?.NAME ??
        properties?.name_long ??
        geography.id;
    return typeof candidate === "string" || typeof candidate === "number"
      ? String(candidate)
      : null;
  },
  geographyStyle = (selected: boolean) => ({
    default: {
      fill: selected ? "hsl(271 91% 65%)" : "hsl(240 5.9% 12%)",
      outline: "none",
      stroke: selected ? "hsl(271 91% 75%)" : "hsl(240 3.7% 22%)",
      strokeWidth: selected ? 1.8 : 0.6,
    },
    hover: {
      cursor: "pointer",
      fill: selected ? "hsl(271 91% 65%)" : "hsl(271 70% 32%)",
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
  });

export function BioMapClient({
  mapScope,
  onRegionSelect,
  onScopeChange,
  selectedRegion,
}: BioMapProps) {
  const usGeoUrl = useMemo(() => getUsGeoUrl(), []),
    worldGeoUrl = useMemo(() => getWorldGeoUrl(), []),
    [hoveredRegion, setHoveredRegion] = useState<string | null>(null),
    [zoomCenter, setZoomCenter] = useState<[number, number] | null>(null),
    scopeConfig =
      mapScopes.find((scope) => scope.id === mapScope) ?? mapScopes[0],
    isUsaScope = mapScope === "usa",
    displayRegion = hoveredRegion ?? selectedRegion,
    selectedRegionSlug = selectedRegion
      ? exploreRegionSlug(selectedRegion)
      : null,
    isSelectedRegion = (name: string): boolean => {
      if (!selectedRegionSlug) {
        return false;
      }
      const slug = exploreRegionSlug(name);
      return slug === selectedRegionSlug || `us-${slug}` === selectedRegionSlug;
    },
    selectGeography = (
      geography: Parameters<typeof geoCentroid>[0],
      name: string
    ) => {
      const [longitude, latitude] = geoCentroid(geography);
      setZoomCenter([longitude, latitude]);
      onRegionSelect(name);
    },
    changeScope = (scope: MapScope) => {
      setZoomCenter(null);
      onScopeChange(scope);
    },
    renderGeography = (
      geography: Parameters<typeof geoCentroid>[0] & {
        id?: string | number;
        properties?: Record<string, unknown>;
        rsmKey: string;
      }
    ) => {
      const name = geographyName(geography);
      if (!name) {
        return null;
      }

      const selected = isSelectedRegion(name);
      return (
        <Geography
          geography={geography}
          key={geography.rsmKey}
          onClick={() => selectGeography(geography, name)}
          onMouseEnter={() => setHoveredRegion(name)}
          onMouseLeave={() => setHoveredRegion(null)}
          style={geographyStyle(selected)}
        />
      );
    };

  return (
    <div
      className="relative w-full max-w-full overflow-hidden rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl"
      data-testid="explore-map"
    >
      <div className="relative h-[320px] w-full sm:h-[420px] md:h-[480px]">
        {/* Top Controls: Scope Pills and Selected Region */}
        <div className="absolute top-4 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Scope Selector */}
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border/60 bg-card/90 p-1 shadow-lg backdrop-blur-xl pointer-events-auto">
            {mapScopes.map((scope) => (
              <button
                className={`shrink-0 rounded-full px-3 py-1 font-semibold text-xs transition-all ${
                  mapScope === scope.id
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
                key={scope.id}
                onClick={() => changeScope(scope.id)}
                type="button"
              >
                {scope.label}
              </button>
            ))}
          </div>

          {displayRegion ? (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/20 px-3.5 py-1 text-xs font-bold text-primary shadow-lg backdrop-blur pointer-events-auto">
              <MapPin className="size-3.5" />
              <span>{displayRegion}</span>
            </div>
          ) : null}
        </div>

        {/* Map SVG */}
        <ComposableMap
          className="size-full"
          projection={scopeConfig.projection}
          projectionConfig={{
            center: scopeConfig.center,
            scale: scopeConfig.scale,
          }}
        >
          {isUsaScope ? (
            <Geographies geography={usGeoUrl}>
              {({ geographies }) => geographies.map(renderGeography)}
            </Geographies>
          ) : (
            <ZoomableGroup
              center={zoomCenter ?? scopeConfig.center ?? [0, 0]}
              maxZoom={5}
              minZoom={1}
              zoom={zoomCenter ? 2.4 : 1}
            >
              <Geographies geography={worldGeoUrl}>
                {({ geographies }) =>
                  geographies
                    .filter((geography) => {
                      const name = geographyName(geography);
                      return name
                        ? isWorldCountryInMapScope(mapScope, name)
                        : false;
                    })
                    .map(renderGeography)
                }
              </Geographies>
            </ZoomableGroup>
          )}
        </ComposableMap>

        {/* Bottom Legend */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-full border border-border/50 bg-card/90 px-3.5 py-1.5 text-xs shadow-md backdrop-blur">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full border border-primary/40 bg-primary/20" />
            <span className="text-muted-foreground text-[11px]">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-primary" />
            <span className="font-semibold text-foreground text-[11px]">
              Selected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
