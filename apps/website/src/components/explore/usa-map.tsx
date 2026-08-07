import { WorldAndUSAMap } from "./world-and-usa-map";

interface USAMapProps {
  selectedState: string | null;
  onStateSelect: (state: string) => void;
}

export function USAMap({ selectedState, onStateSelect }: USAMapProps) {
  return (
    <WorldAndUSAMap
      mapScope="north-america"
      onRegionSelect={onStateSelect}
      onScopeChange={() => {}}
      selectedRegion={selectedState}
    />
  );
}
