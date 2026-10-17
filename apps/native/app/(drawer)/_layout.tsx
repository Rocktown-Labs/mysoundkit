/* eslint-disable react/no-unstable-nested-components */
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ActivityIndicator, View } from "react-native";

import { useGuestMode } from "@/contexts/guest-mode-context";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export const unstable_settings = { initialRouteName: "(tabs)" };

function DrawerLayout() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session, isPending } = authClient.useSession(),
    { isGuestMode } = useGuestMode();

  if (isPending && !isGuestMode) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.background,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!session?.user && !isGuestMode) {
    return <Redirect href="/(auth)/login" />;
  }

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
