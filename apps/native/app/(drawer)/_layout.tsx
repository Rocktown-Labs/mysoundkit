/* eslint-disable react/no-unstable-nested-components */
import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export const unstable_settings = { initialRouteName: "(tabs)" };

function DrawerLayout() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Drawer
      screenOptions={{
        drawerInactiveTintColor: theme.text,
        drawerLabelStyle: { color: theme.text },
        drawerStyle: { backgroundColor: theme.background },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons color={color} name="musical-notes-outline" size={size} />
          ),
          drawerLabel: "SoundKit",
          headerTitle: "SoundKit",
        }}
      />
      <Drawer.Screen
        name="index"
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons color={color} name="person-outline" size={size} />
          ),
          drawerLabel: "Account",
          headerTitle: "Account",
        }}
      />
    </Drawer>
  );
}

export default DrawerLayout;
