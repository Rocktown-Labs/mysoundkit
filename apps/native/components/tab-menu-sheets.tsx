import { createContext, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { BottomMenuSheet } from "@/components/bottom-menu-sheet";
import type { BottomMenuSheetHandle } from "@/components/bottom-menu-sheet";
import { LibraryBottomSheet } from "@/components/library-bottom-sheet";
import type { LibraryBottomSheetHandle } from "@/components/library-bottom-sheet";
import { EXPLORE_MENU_ITEMS } from "@/lib/native-navigation";

interface TabMenuContextValue {
  openDiscoverMenu: () => void;
  openLibraryMenu: () => void;
}

const TabMenuContext = createContext<TabMenuContextValue | null>(null);

export function useTabMenu(): TabMenuContextValue {
  const value = useContext(TabMenuContext);
  if (!value) {
    throw new Error(
      "useTabMenu must be used inside a TabMenuSheetsProvider (tab layout)."
    );
  }
  return value;
}

/**
 * Hosts the sheet menus shared across the five public tabs: the library menu
 * opened from the header avatar and the extra Discover menu opened by
 * double-tapping the Discover tab.
 */
export function TabMenuSheetsProvider({ children }: { children: ReactNode }) {
  const discoverSheetRef = useRef<BottomMenuSheetHandle>(null),
    librarySheetRef = useRef<LibraryBottomSheetHandle>(null),
    value = useMemo<TabMenuContextValue>(
      () => ({
        openDiscoverMenu: () => {
          discoverSheetRef.current?.present();
        },
        openLibraryMenu: () => {
          librarySheetRef.current?.present();
        },
      }),
      []
    );

  return (
    <TabMenuContext.Provider value={value}>
      {children}
      <BottomMenuSheet
        description="Songs, projects, videos, scenes, and more from across SoundKit."
        items={EXPLORE_MENU_ITEMS}
        ref={discoverSheetRef}
        title="More to discover"
      />
      <LibraryBottomSheet ref={librarySheetRef} />
    </TabMenuContext.Provider>
  );
}
