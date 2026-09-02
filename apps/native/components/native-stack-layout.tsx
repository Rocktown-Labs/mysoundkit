import { Stack } from "expo-router/stack";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export function NativeStackLayout() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.background },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerShown: false,
      }}
    />
  );
}
