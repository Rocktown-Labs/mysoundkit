// Hex values mirror the web app's OKLCH tokens while remaining compatible
// with React Native's color parser.
export const NAV_THEME = {
  dark: {
    accent: "#DDA34A",
    accentForeground: "#171717",
    background: "#141414",
    border: "#403F3E",
    card: "#1F1F1F",
    destructive: "#E05D4D",
    muted: "#292929",
    mutedText: "#A6A4A2",
    notification: "#E05D4D",
    primary: "#B993FF",
    primaryForeground: "#171717",
    text: "#F7F7F5",
  },
  light: {
    accent: "#E5DFC9",
    accentForeground: "#27252F",
    background: "#F7F5F0",
    border: "#E4E1D8",
    card: "#FEFEFD",
    destructive: "#C2412D",
    muted: "#EFEDE7",
    mutedText: "#78737E",
    notification: "#C2412D",
    primary: "#6531B5",
    primaryForeground: "#FFFFFF",
    text: "#27252F",
  },
} as const;

export type NavTheme = (typeof NAV_THEME)["dark"];
