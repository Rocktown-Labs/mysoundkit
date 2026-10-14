/**
 * SoundKit Mobile enforces strict dark mode across all surfaces.
 * Color scheme is fixed to 'dark' by default.
 */
export function useColorScheme() {
  return {
    colorScheme: "dark" as const,
    isDarkColorScheme: true,
    setColorScheme: () => {
      // SoundKit mobile is strictly dark mode
    },
    toggleColorScheme: () => {
      // SoundKit mobile is strictly dark mode
    },
  };
}
