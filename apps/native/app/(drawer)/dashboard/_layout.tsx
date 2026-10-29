import { useFocusEffect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useCallback } from "react";

import { useAppTabBar } from "@/lib/app-tab-bar-context";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

/**
 * Dashboard shell: Home / Music / Career / Live / Messages native tabs.
 * While any dashboard screen is focused, the app-level tab bar is hidden so
 * this is the only tab bar visible — matching the mobile web dashboard.
 */
export default function DashboardLayout() {
  const { isDarkColorScheme } = useColorScheme(),
    theme = isDarkColorScheme ? NAV_THEME.dark : NAV_THEME.light,
    { setIsAppTabBarHidden } = useAppTabBar();

  useFocusEffect(
    useCallback(() => {
      setIsAppTabBarHidden(true);
      return () => {
        setIsAppTabBarHidden(false);
      };
    }, [setIsAppTabBarHidden])
  );

  return (
    <NativeTabs
      backgroundColor={theme.background}
      iconColor={theme.mutedText}
      labelStyle={{ color: theme.mutedText }}
      tintColor={theme.primary}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="home"
          sf={{ default: "house", selected: "house.fill" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="music">
        <NativeTabs.Trigger.Label>Music</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="music_note" sf="music.quarternote.3" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="career">
        <NativeTabs.Trigger.Label>Career</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="bar_chart"
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="live">
        <NativeTabs.Trigger.Label>Live</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="podcasts"
          sf="dot.radiowaves.left.and.right"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="chat"
          sf={{ default: "paperplane", selected: "paperplane.fill" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
