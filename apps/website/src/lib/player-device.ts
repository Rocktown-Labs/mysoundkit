export type DeviceType =
  | "bluetooth"
  | "computer"
  | "headphones"
  | "phone"
  | "speaker";

export const classifyAudioDevice = (label: string): DeviceType => {
  const lower = label.toLowerCase();
  if (
    lower.includes("bluetooth") ||
    lower.includes("bt ") ||
    lower.includes("airpods") ||
    lower.includes("wireless")
  ) {
    return "bluetooth";
  }

  if (
    lower.includes("headphone") ||
    lower.includes("headset") ||
    lower.includes("earphone")
  ) {
    return "headphones";
  }

  if (
    lower.includes("phone") ||
    lower.includes("mobile") ||
    lower.includes("iphone") ||
    lower.includes("android")
  ) {
    return "phone";
  }

  if (
    lower.includes("built-in") ||
    lower.includes("internal") ||
    lower.includes("macbook") ||
    lower.includes("laptop") ||
    lower.includes("computer")
  ) {
    return "computer";
  }

  return "speaker";
};

export type PlayerPresentation = "expanded" | "mini";

export const getDefaultPlayerPresentation = (
    isMobile: boolean
  ): PlayerPresentation => (isMobile ? "mini" : "expanded"),
  getRepeatTooltipLabel = (mode: "off" | "all" | "one"): string => {
  if (mode === "one") {
    return "Repeat: One";
  }
  if (mode === "all") {
    return "Repeat: All";
  }
  return "Repeat: Off";
  },
  formatPlaybackTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60),
    secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
