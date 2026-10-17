import { BlurView } from "expo-blur";
import type { BlurTint } from "expo-blur";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

interface LiquidGlassViewProps {
  borderRadius?: number;
  children?: ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  tint?: BlurTint;
  variant?: "card" | "chrome" | "pill" | "sheet";
}

const styles = StyleSheet.create({
  androidFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(18, 18, 24, 0.92)",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  chromeOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(20, 18, 28, 0.52)",
  },
  container: {
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  pillOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12, 12, 18, 0.62)",
  },
  specularTopEdge: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    height: StyleSheet.hairlineWidth,
    left: 12,
    position: "absolute",
    right: 12,
    top: 0,
  },
});

function resolveOverlayStyle(variant: LiquidGlassViewProps["variant"]) {
  switch (variant) {
    case "chrome": {
      return styles.chromeOverlay;
    }
    case "pill": {
      return styles.pillOverlay;
    }
    case "sheet": {
      return styles.sheetOverlay;
    }
    default: {
      return styles.cardOverlay;
    }
  }
}

function resolveDefaultTint(
  variant: LiquidGlassViewProps["variant"]
): BlurTint {
  switch (variant) {
    case "chrome": {
      return "systemChromeMaterialDark";
    }
    case "pill": {
      return "systemUltraThinMaterialDark";
    }
    case "sheet": {
      return "systemThickMaterialDark";
    }
    default: {
      return "systemMaterialDark";
    }
  }
}

export function LiquidGlassView({
  borderRadius = 20,
  children,
  intensity = 65,
  style,
  tint,
  variant = "card",
}: LiquidGlassViewProps) {
  const resolvedTint = tint ?? resolveDefaultTint(variant);

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {Platform.OS === "android" ? (
        <View pointerEvents="none" style={styles.androidFallback} />
      ) : (
        <BlurView
          intensity={intensity}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint={resolvedTint}
        />
      )}
      <View pointerEvents="none" style={resolveOverlayStyle(variant)} />
      <View pointerEvents="none" style={styles.specularTopEdge} />
      {children}
    </View>
  );
}
