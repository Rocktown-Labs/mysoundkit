/* eslint-disable one-var */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { mapScopeFromValue } from "./explore-region";
import type { MapScope } from "./explore-region";

/* Keys are scoped to this app (web persists its own localStorage keys); the
   map scope + region name are enough because the region type is always
   derivable from the scope (see regionTypeForMapScope). */
const MAP_SCOPE_KEY = "@soundkit/explore_map_scope",
  REGION_NAME_KEY = "@soundkit/explore_region_name";

export interface PersistedRegionSelection {
  mapScope: MapScope;
  regionName: null | string;
}

const normalizeRegionName = (value: null | string): null | string => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const loadRegionSelection =
    async (): Promise<PersistedRegionSelection | null> => {
      try {
        const [rawScope, rawRegion] = await Promise.all([
            AsyncStorage.getItem(MAP_SCOPE_KEY),
            AsyncStorage.getItem(REGION_NAME_KEY),
          ]),
          mapScope = mapScopeFromValue(rawScope);
        if (!mapScope) {
          return null;
        }
        return {
          mapScope,
          regionName: normalizeRegionName(rawRegion),
        };
      } catch {
        return null;
      }
    },
  saveRegionSelection = async (
    selection: PersistedRegionSelection
  ): Promise<void> => {
    try {
      await Promise.all([
        AsyncStorage.setItem(MAP_SCOPE_KEY, selection.mapScope),
        selection.regionName
          ? AsyncStorage.setItem(REGION_NAME_KEY, selection.regionName)
          : AsyncStorage.removeItem(REGION_NAME_KEY),
      ]);
    } catch {
      /* Persistence is best effort; the in-memory selection still applies. */
    }
  };
