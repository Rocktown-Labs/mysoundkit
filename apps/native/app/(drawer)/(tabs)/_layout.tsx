/* eslint-disable react/no-unstable-nested-components */
import { Tabs } from "expo-router";

import { TabBarIcon } from "@/components/tabbar-icon";
import { NAV_THEME } from "@/lib/constants";
import { NATIVE_TAB_ROUTES } from "@/lib/route-manifest";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function TabLayout() {
  const { isDarkColorScheme } = useColorScheme(),
    theme = isDarkColorScheme ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.text,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
      }}
    >
      {NATIVE_TAB_ROUTES.map((route) => (
        <Tabs.Screen
          key={route.id}
          name={route.id === "explore" ? "index" : route.id}
          options={{
            tabBarIcon: ({ color }) => (
              <TabBarIcon color={color} name={route.icon} />
            ),
            title: route.title,
          }}
        />
      ))}
    </Tabs>
  );
}
