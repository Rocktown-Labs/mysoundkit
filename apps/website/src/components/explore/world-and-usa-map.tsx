"use client";

import { MapPin } from "lucide-react";
import React, { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

import { mapScopes } from "../../lib/map-scopes";
import type { MapScope } from "../../lib/map-scopes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export { mapScopes, type MapScope } from "../../lib/map-scopes";

const usGeoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const worldGeoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const scopeConfig = mapScopes.find((s) => s.id === mapScope) ?? mapScopes[0];

  const isUSScope = mapScope === "north-america";
  const geoUrl = isUSScope ? usGeoUrl : worldGeoUrl;

  const displayRegion =
    hoveredRegion ||
    selectedRegion ||
    (selectedRegions?.length ? `${selectedRegions.length} selected` : null);
  const selectedRegionSet = new Set(
    (selectedRegions ?? []).map((region) => region.toLowerCase())
  );

  return (
    <div className="relative w-full max-w-full bg-muted/30 rounded-lg overflow-hidden border border-border/50">
      <div className="relative w-full h-[280px] sm:h-[380px] md:h-[460px] lg:h-[500px]">
        {/* Top-Left Overlay Navigation Bar */}
        <div className="absolute top-3 left-3 z-30 flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* Desktop Scope Pills */}
          <div className="hidden md:flex items-center gap-1 bg-background/90 backdrop-blur p-1 rounded-lg border border-border/60 shadow-lg">
            {mapScopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => {
                  onScopeChange(scope.id);
                  if (scope.id === "global") {
                    onRegionSelect("");
                  }
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  mapScope === scope.id
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          {/* Mobile Scope Dropdown */}
          <div className="md:hidden">
            <Select
              value={mapScope}
              onValueChange={(val) => {
                onScopeChange(val as MapScope);
                if (val === "global") {
                  onRegionSelect("");
                }
              }}
            >
              <SelectTrigger className="w-[170px] h-8 text-xs bg-background/90 backdrop-blur shadow-md">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                {mapScopes.map((scope) => (
                  <SelectItem
                    key={scope.id}
                    value={scope.id}
                    className="text-xs"
                  >
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Persistent Location Badge showing hovered or selected region */}
          {displayRegion && (
            <div className="bg-primary/95 text-primary-foreground backdrop-blur px-3 py-1 rounded-lg border shadow-lg z-30 flex items-center gap-1.5 text-xs font-semibold animate-in fade-in duration-150">
              <MapPin className="size-3.5" />
              <span>{displayRegion}</span>
            </div>
          )}
        </div>

        <ComposableMap
          projection={scopeConfig.projection}
          projectionConfig={{
            center: scopeConfig.center,
            scale: scopeConfig.scale,
          }}
          className="w-full h-full"
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name =
                  geo.properties?.name ||
                  geo.properties?.NAME ||
                  geo.properties?.name_long ||
                  geo.id;

                if (!name) {
                  return null;
                }

                const normalizedName = name.toLowerCase();
                const isSelected =
                  selectedRegion?.toLowerCase() === normalizedName ||
                  selectedRegionSet.has(normalizedName);
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
                          : "hsl(240 5.9% 12%)",
                        outline: "none",
                        stroke: isSelected
                          ? "hsl(271 91% 75%)"
                          : "hsl(240 3.7% 22%)",
                        strokeWidth: isSelected ? 1.8 : 0.6,
                      },
                      hover: {
                        cursor: "pointer",
                        fill: isSelected
                          ? "hsl(271 91% 65%)"
                          : "hsl(271 70% 32%)",
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

        {/* Map Legend */}
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur px-3 py-1.5 rounded-lg border shadow-md z-20 text-xs flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded bg-primary/20 border border-primary/40" />
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
