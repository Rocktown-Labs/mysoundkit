import { useColorScheme as useRNColorScheme } from "react-native";

export function useColorScheme() {
  return {
    colorScheme: "dark" as const,
    isDarkColorScheme: true,
    setColorScheme: () => {
      // Color scheme is managed by the system in bare mode
      console.warn(
        "setColorScheme is not available in bare mode. Color scheme is managed by the system."
      );
    },
    toggleColorScheme: () => {
      // Color scheme is managed by the system in bare mode
      console.warn(
        "toggleColorScheme is not available in bare mode. Color scheme is managed by the system."
      );
    },
  };
}
