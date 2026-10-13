/* eslint-disable sort-vars, react/no-unstable-nested-components */
import { TabBarIcon } from "@/components/tabbar-icon";
import { Tabs } from "expo-router";
import { useState } from "react";
import type { DimensionValue } from "react-native";

import { AppTabBarContext } from "@/lib/app-tab-bar-context";
import { NATIVE_TAB_ROUTES } from "@/lib/route-manifest";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function TabLayout() {
  const [isAppTabBarHidden, setIsAppTabBarHidden] = useState(false),
    { isDarkColorScheme } = useColorScheme(),
    theme = isDarkColorScheme ? NAV_THEME.dark : NAV_THEME.light,
    tabBarHeight: DimensionValue = isAppTabBarHidden ? 0 : 68;

  return (
    <AppTabBarContext value={{ setIsAppTabBarHidden }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.primary,
          tabBarHideOnKeyboard: true,
          tabBarInactiveTintColor: theme.mutedText,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            display: isAppTabBarHidden ? "none" : "flex",
            height: tabBarHeight,
            paddingBottom: 8,
            paddingTop: 7,
          },
        }}
      >
        {NATIVE_TAB_ROUTES.map((route) => (
          <Tabs.Screen
            key={route.id}
            name={route.screen}
            options={{
              tabBarIcon: ({ color }) => (
                <TabBarIcon color={color} name={route.icon} />
              ),
              title: route.title,
            }}
          />
        ))}
      </Tabs>
    </AppTabBarContext>
  );
}
