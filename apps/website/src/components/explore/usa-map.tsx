import { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface USAMapProps {
  selectedState: string | null;
  onStateSelect: (state: string) => void;
}

export function USAMap({ selectedState, onStateSelect }: USAMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  return (
    <div className="relative w-full max-w-full bg-muted/30 rounded-lg overflow-hidden">
      {/* Map */}
      <div className="relative w-full h-[200px] sm:h-[300px] md:h-[400px]">
        <ComposableMap projection="geoAlbersUsa" className="w-full h-full">
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = geo.properties?.name || geo.id;
                if (!stateName) {
                  return null;
                }

                const isSelected = selectedState === stateName;
                const isHovered = hoveredState === stateName;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onStateSelect(stateName)}
                    onMouseEnter={() => setHoveredState(stateName)}
                    onMouseLeave={() => setHoveredState(null)}
                    style={{
                      default: {
                        fill: isSelected ? "hsl(271 91% 65%)" : "#1a1a1a",
                        outline: "none",
                        stroke: isSelected ? "hsl(271 91% 65%)" : "#2a2a2a",
                        strokeWidth: isSelected ? 2 : 0.5,
                      },
                      hover: {
                        cursor: "pointer",
                        fill: isSelected ? "hsl(271 91% 65%)" : "#2a2a2a",
                        outline: "none",
                        stroke: "hsl(271 91% 65%)",
                        strokeWidth: 2,
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

        {/* Hovered state tooltip */}
        {hoveredState && (
          <div className="absolute top-2 left-2 bg-background/95 backdrop-blur px-3 py-1.5 rounded-lg border shadow-lg z-10">
            <p className="text-sm font-semibold">{hoveredState}</p>
          </div>
        )}

        {/* Desktop Legend (inside map) */}
        <div className="hidden md:block absolute bottom-3 left-3 bg-background/95 backdrop-blur p-3 rounded-lg border shadow-lg z-10">
          <p className="text-sm font-medium mb-2">Click a state to explore</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-primary/20 border border-primary/40" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-primary" />
              <span>Selected</span>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden flex justify-center mt-3 px-4">
        <div className="bg-background/95 backdrop-blur p-3 rounded-lg border shadow-lg max-w-fit">
          <p className="text-xs font-medium mb-1.5">Click a state to explore</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-primary/20 border border-primary/40" />
              <span className="text-xs">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-primary" />
              <span className="text-xs">Selected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
