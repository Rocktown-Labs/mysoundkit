/* eslint-disable one-var, sort-vars, react/set-state-in-effect */
"use client";

import { lazy, Suspense, useEffect, useState } from "react";

import type { MapScope } from "@/lib/map-scopes";

export { mapScopes, type MapScope } from "@/lib/map-scopes";

const BioMapClient = lazy(async () => {
  const { BioMapClient: Map } = await import("./bio-map-client");
  return { default: Map };
});

export interface BioMapProps {
  mapScope: MapScope;
  onRegionSelect: (regionName: string) => void;
  onScopeChange: (scope: MapScope) => void;
  selectedRegion: string | null;
}

function MapFallback() {
  return (
    <div
      className="relative h-[320px] w-full sm:h-[420px] md:h-[480px] overflow-hidden rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl flex items-center justify-center"
      data-testid="explore-map"
    >
      <div className="text-xs text-muted-foreground animate-pulse">
        Loading regional map...
      </div>
    </div>
  );
}

export function BioMap(props: BioMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <MapFallback />;
  }

  return (
    <Suspense fallback={<MapFallback />}>
      <BioMapClient {...props} />
    </Suspense>
  );
}
