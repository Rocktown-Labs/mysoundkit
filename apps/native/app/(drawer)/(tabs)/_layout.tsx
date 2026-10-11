import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useState } from "react";

import { AppTabBarContext } from "@/lib/app-tab-bar-context";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function TabLayout() {
  const { isDarkColorScheme } = useColorScheme(),
    theme = isDarkColorScheme ? NAV_THEME.dark : NAV_THEME.light,
    [isAppTabBarHidden, setIsAppTabBarHidden] = useState(false);

  return (
    <AppTabBarContext value={{ setIsAppTabBarHidden }}>
      <NativeTabs
        backgroundColor={theme.background}
        hidden={isAppTabBarHidden}
        iconColor={theme.mutedText}
        labelStyle={{ color: theme.mutedText }}
        tintColor={theme.primary}
      >
        <NativeTabs.Trigger name="(explore)">
          <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            md="explore"
            sf={{ default: "safari", selected: "safari.fill" }}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="library">
          <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md="library_music" sf="music.note.list" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="live">
          <NativeTabs.Trigger.Label>Live</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            md="mic"
            sf="dot.radiowaves.left.and.right"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="dashboard">
          <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            md="dashboard"
            sf={{
              default: "square.grid.2x2",
              selected: "square.grid.2x2.fill",
            }}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </AppTabBarContext>
  );
}
