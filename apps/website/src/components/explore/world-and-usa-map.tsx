/* eslint-disable one-var, sort-vars */
"use client";

import { geoCentroid } from "d3-geo";
import { MapPin } from "lucide-react";
import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exploreRegionSlug } from "@/lib/explore-region";
import { isWorldCountryInMapScope } from "@/lib/map-country-scopes";
import { mapScopes } from "@/lib/map-scopes";
import type { MapScope } from "@/lib/map-scopes";

export { mapScopes, type MapScope } from "@/lib/map-scopes";

const usGeoUrl = new URL(
    "../../assets/maps/us-states-10m.json",
    import.meta.url
  ).href,
  worldGeoUrl = new URL(
    "../../assets/maps/world-countries-110m.json",
    import.meta.url
  ).href,
  northAmericaCountryNames = new Set(["Canada", "Mexico"]),
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

interface WorldAndUSAMapProps {
  mapScope: MapScope;
  onRegionSelect: (regionName: string) => void;
  onScopeChange: (scope: MapScope) => void;
  selectedRegion: string | null;
  selectedRegions?: string[];
}

export function WorldAndUSAMap({
  mapScope,
  onRegionSelect,
  onScopeChange,
  selectedRegion,
  selectedRegions,
}: WorldAndUSAMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null),
    [zoomCenter, setZoomCenter] = useState<[number, number] | null>(null),
    scopeConfig =
      mapScopes.find((scope) => scope.id === mapScope) ?? mapScopes[0],
    isNorthAmericaScope = mapScope === "north-america",
    displayRegion =
      hoveredRegion ??
      selectedRegion ??
      (selectedRegions?.length ? `${selectedRegions.length} selected` : null),
    selectedRegionSlugs = new Set(
      [selectedRegion, ...(selectedRegions ?? [])]
        .filter((region): region is string => Boolean(region))
        .map(exploreRegionSlug)
    ),
    isSelectedRegion = (name: string): boolean => {
      const slug = exploreRegionSlug(name);
      return (
        selectedRegionSlugs.has(slug) || selectedRegionSlugs.has(`us-${slug}`)
      );
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
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-border/50 bg-muted/30"
      data-testid="explore-map"
    >
      <div className="relative h-[280px] w-full sm:h-[380px] md:h-[460px] lg:h-[500px]">
        <div className="absolute top-3 left-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 sm:flex-row sm:items-center">
          <div className="hidden max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border/60 bg-background/90 p-1 shadow-lg backdrop-blur lg:flex">
            {mapScopes.map((scope) => (
              <button
                className={`shrink-0 rounded-md px-2.5 py-1 font-medium text-xs transition-all ${
                  mapScope === scope.id
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                key={scope.id}
                onClick={() => changeScope(scope.id)}
                type="button"
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="lg:hidden">
            <Select
              onValueChange={(value) => changeScope(value as MapScope)}
              value={mapScope}
            >
              <SelectTrigger className="h-8 w-[190px] bg-background/90 text-xs shadow-md backdrop-blur">
                <SelectValue placeholder="Map area" />
              </SelectTrigger>
              <SelectContent>
                {mapScopes.map((scope) => (
                  <SelectItem
                    className="text-xs"
                    key={scope.id}
                    value={scope.id}
                  >
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {displayRegion ? (
            <div className="z-30 flex max-w-full items-center gap-1.5 rounded-lg border bg-primary/95 px-3 py-1 font-semibold text-primary-foreground text-xs shadow-lg backdrop-blur animate-in fade-in duration-150">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{displayRegion}</span>
            </div>
          ) : null}
        </div>

        <ComposableMap
          className="h-full w-full"
          projection={scopeConfig.projection}
          projectionConfig={{
            center: scopeConfig.center,
            scale: scopeConfig.scale,
          }}
        >
          <ZoomableGroup
            center={zoomCenter ?? scopeConfig.center ?? [0, 0]}
            maxZoom={5}
            minZoom={1}
            zoom={zoomCenter ? 2.4 : 1}
          >
            {isNorthAmericaScope ? (
              <>
                <Geographies geography={worldGeoUrl}>
                  {({ geographies }) =>
                    geographies
                      .filter((geography) => {
                        const name = geographyName(geography);
                        return name
                          ? northAmericaCountryNames.has(name)
                          : false;
                      })
                      .map(renderGeography)
                  }
                </Geographies>
                <Geographies geography={usGeoUrl}>
                  {({ geographies }) => geographies.map(renderGeography)}
                </Geographies>
              </>
            ) : (
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
            )}
          </ZoomableGroup>
        </ComposableMap>

        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 rounded-lg border bg-background/90 px-3 py-1.5 text-xs shadow-md backdrop-blur">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded border border-primary/40 bg-primary/20" />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded bg-primary" />
            <span className="font-semibold text-foreground">Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
