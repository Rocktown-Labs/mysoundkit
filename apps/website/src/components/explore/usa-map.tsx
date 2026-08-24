import { WorldAndUSAMap } from "./world-and-usa-map";

interface USAMapProps {
  selectedState: string | null;
  onStateSelect: (state: string) => void;
}

export function USAMap({ selectedState, onStateSelect }: USAMapProps) {
  return (
    <WorldAndUSAMap
      mapScope="usa"
      onRegionSelect={onStateSelect}
      onScopeChange={() => null}
      selectedRegion={selectedState}
    />
  );
}
