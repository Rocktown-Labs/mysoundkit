/* eslint-disable react/no-unstable-nested-components */
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Drawer } from "expo-router/drawer";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export const unstable_settings = { initialRouteName: "(tabs)" };

function DrawerLayout() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <BottomSheetModalProvider>
      <Drawer
        screenOptions={{
          drawerActiveTintColor: theme.primary,
          drawerInactiveTintColor: theme.mutedText,
          drawerLabelStyle: { color: theme.text, fontWeight: "700" },
          drawerStyle: { backgroundColor: theme.background },
          headerShown: false,
        }}
      >
        <Drawer.Screen
          name="(tabs)"
          options={{
            drawerIcon: ({ color, size }) => (
              <Ionicons color={color} name="compass-outline" size={size} />
            ),
            drawerLabel: "SoundKit",
          }}
        />
        <Drawer.Screen
          name="dashboard"
          options={{
            drawerIcon: ({ color, size }) => (
              <Ionicons color={color} name="speedometer-outline" size={size} />
            ),
            drawerLabel: "Dashboard",
          }}
        />
      </Drawer>
    </BottomSheetModalProvider>
  );
}

export default DrawerLayout;
