// Hex values mirror the web app's OKLCH tokens while remaining compatible
// with React Native's color parser. Source of truth:
// apps/website/src/app/globals.css (`.dark` + `.public-pages` overrides).
export const NAV_THEME = {
  dark: {
    accent: "#111111",
    accentForeground: "#F8F8F8",
    background: "#020202",
    border: "#212121",
    card: "#060606",
    destructive: "#E05D4D",
    muted: "#0B0B0B",
    mutedText: "#8F8F8F",
    notification: "#E05D4D",
    primary: "#B8A3FF",
    primaryForeground: "#171717",
    secondary: "#111111",
    text: "#F8F8F8",
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
    secondary: "#EFEDE7",
    text: "#27252F",
  },
} as const;

export type NavTheme = (typeof NAV_THEME)["dark"];
