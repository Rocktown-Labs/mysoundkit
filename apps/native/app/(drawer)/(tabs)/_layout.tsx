import { Ionicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useRef } from "react";

import { GlobalMiniPlayer } from "@/components/global-mini-player";
import {
  TabMenuSheetsProvider,
  useTabMenu,
} from "@/components/tab-menu-sheets";
import { NAV_THEME } from "@/lib/constants";
import { NATIVE_TAB_ROUTES } from "@/lib/route-manifest";
import { useColorScheme } from "@/lib/use-color-scheme";

const DOUBLE_TAP_DELAY_MS = 400;

function TabBarBody() {
  const { colorScheme } = useColorScheme(),
    lastDiscoverPressRef = useRef(0),
    { openDiscoverMenu } = useTabMenu(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeTabs
      backgroundColor={theme.background}
      iconColor={{ default: theme.mutedText, selected: theme.primary }}
      labelStyle={{
        default: { color: theme.mutedText, fontSize: 10, fontWeight: "700" },
        selected: { color: theme.text },
      }}
      tintColor={theme.primary}
    >
      <NativeTabs.BottomAccessory>
        <GlobalMiniPlayer />
      </NativeTabs.BottomAccessory>
      {NATIVE_TAB_ROUTES.map((route) => (
        <NativeTabs.Trigger
          key={route.id}
          listeners={
            route.id === "discover"
              ? {
                  tabPress: () => {
                    const now = Date.now();
                    if (
                      now - lastDiscoverPressRef.current <=
                      DOUBLE_TAP_DELAY_MS
                    ) {
                      lastDiscoverPressRef.current = 0;
                      openDiscoverMenu();
                      return;
                    }
                    lastDiscoverPressRef.current = now;
                  },
                }
              : undefined
          }
          name={route.screen}
        >
          <NativeTabs.Trigger.Icon
            src={
              <NativeTabs.Trigger.VectorIcon
                family={Ionicons}
                name={route.icon}
              />
            }
          />
          <NativeTabs.Trigger.Label>{route.title}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

export default function TabLayout() {
  return (
    <TabMenuSheetsProvider>
      <TabBarBody />
    </TabMenuSheetsProvider>
  );
}
