import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
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

const DISCOVER_ROUTE_NAME = "(discover)",
  DOUBLE_TAP_DELAY_MS = 400;

function onTabPress({
  event,
  lastDiscoverPressRef,
  navigation,
  openDiscoverMenu,
}: {
  event: { target?: string };
  lastDiscoverPressRef: { current: number };
  navigation: {
    getState: () =>
      | {
          index?: number;
          routes: { key: string; name: string }[];
        }
      | undefined;
  };
  openDiscoverMenu: () => void;
}) {
  const now = Date.now(),
    state = navigation.getState(),
    targetRouteKey = state?.routes[state?.index ?? 0]?.key,
    targetRouteName = state?.routes[state?.index ?? 0]?.name;
  if (
    !targetRouteName ||
    targetRouteName !== DISCOVER_ROUTE_NAME ||
    event.target !== targetRouteKey
  ) {
    return;
  }
  if (now - lastDiscoverPressRef.current <= DOUBLE_TAP_DELAY_MS) {
    lastDiscoverPressRef.current = 0;
    openDiscoverMenu();
    return;
  }
  lastDiscoverPressRef.current = now;
}

function TabBarBody() {
  const { colorScheme } = useColorScheme(),
    lastDiscoverPressRef = useRef(0),
    navigation = useNavigation(),
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
      screenListeners={{
        tabPress: (event: { target?: string }) => {
          onTabPress({
            event,
            lastDiscoverPressRef,
            navigation,
            openDiscoverMenu,
          });
        },
      }}
      tintColor={theme.primary}
    >
      <NativeTabs.BottomAccessory>
        <GlobalMiniPlayer />
      </NativeTabs.BottomAccessory>
      {NATIVE_TAB_ROUTES.map((route) => (
        <NativeTabs.Trigger key={route.id} name={route.screen}>
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
