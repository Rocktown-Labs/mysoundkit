/* eslint-disable one-var, sort-vars, react/set-state-in-effect */
"use client";

import { lazy, Suspense, useEffect, useState } from "react";

import type { MapScope } from "@/lib/map-scopes";

export { mapScopes, type MapScope } from "@/lib/map-scopes";

const WorldAndUSAMapClient = lazy(async () => {
  const { WorldAndUSAMapClient: Map } =
    await import("./world-and-usa-map-client");
  return { default: Map };
});

interface WorldAndUSAMapProps {
  mapScope: MapScope;
  onRegionSelect: (regionName: string) => void;
  onScopeChange: (scope: MapScope) => void;
  selectedRegion: string | null;
  selectedRegions?: string[];
}

function MapFallback() {
  return (
    <div
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-border/50 bg-muted/30"
      data-testid="explore-map"
    >
      <div
        aria-busy="true"
        className="h-[280px] w-full sm:h-[380px] md:h-[460px] lg:h-[500px]"
      />
    </div>
  );
}

export function WorldAndUSAMap(props: WorldAndUSAMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <MapFallback />;
  }

  return (
    <Suspense fallback={<MapFallback />}>
      <WorldAndUSAMapClient {...props} />
    </Suspense>
  );
}
