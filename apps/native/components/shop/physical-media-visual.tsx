import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { NativeImage } from "@/components/native-image";

export type NativePhysicalFormat = "cd" | "dvd" | "vinyl_12" | "vinyl_7";

interface NativePhysicalMediaVisualProps {
  artworkUrl: string | null;
  format: NativePhysicalFormat;
  size?: "lg" | "md" | "sm";
}

/**
 * On-brand React Native physical media showcase (Vinyl 12"/7" sleeve + grooved
 * disc, CD jewel case + silver disc, DVD keep case + disc) rendered from the
 * release's real album or video artwork.
 */
export function NativePhysicalMediaVisual({
  artworkUrl,
  format,
  size = "md",
}: NativePhysicalMediaVisualProps) {
  const isVinyl = format === "vinyl_12" || format === "vinyl_7",
    isSevenInch = format === "vinyl_7",
    isDvd = format === "dvd",
    containerPadding = size === "lg" ? 24 : (size === "sm" ? 6 : 12);

  return (
    <View
      style={[
        styles.stage,
        {
          padding: containerPadding,
        },
      ]}
    >
      <View
        style={[
          styles.assembly,
          isDvd ? styles.assemblyDvd : styles.assemblySquare,
        ]}
      >
        {/* Peeking Disc */}
        <View
          style={[
            styles.disc,
            isVinyl ? styles.vinylDisc : styles.opticalDisc,
            isSevenInch && styles.discSevenInch,
            isDvd && styles.discDvd,
          ]}
        >
          {/* Groove rings */}
          {isVinyl ? (
            <>
              <View style={styles.grooveOuter} />
              <View style={styles.grooveMid} />
            </>
          ) : null}

          {/* Center label / hub */}
          <View
            style={[
              styles.centerLabel,
              isVinyl ? styles.vinylLabel : styles.opticalHub,
              isSevenInch && styles.sevenInchLabel,
            ]}
          >
            {isVinyl && artworkUrl ? (
              <NativeImage
                contentFit="cover"
                source={artworkUrl}
                style={styles.fill}
              />
            ) : null}
            <View
              style={[styles.spindle, isSevenInch && styles.spindleSevenInch]}
            />
          </View>
        </View>

        {/* Front Sleeve / Jewel Case / DVD Case */}
        <View
          style={[styles.cover, isDvd ? styles.coverDvd : styles.coverSquare]}
        >
          {format === "cd" ? <View style={styles.cdSpine} /> : null}
          {isDvd ? <View style={styles.dvdSpine} /> : null}

          {artworkUrl ? (
            <NativeImage
              contentFit="cover"
              source={artworkUrl}
              style={styles.fill}
            />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons
                color="#71717A"
                name="disc-outline"
                size={size === "lg" ? 42 : 24}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assembly: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-start",
    position: "relative",
  },
  assemblyDvd: {
    height: "88%",
    width: "80%",
  },
  assemblySquare: {
    aspectRatio: 1.22,
    width: "94%",
  },
  cdSpine: {
    backgroundColor: "rgba(24, 24, 27, 0.72)",
    borderRightColor: "rgba(255, 255, 255, 0.28)",
    borderRightWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: "10%",
    zIndex: 4,
  },
  centerLabel: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    overflow: "hidden",
  },
  cover: {
    backgroundColor: "#141417",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderCurve: "continuous",
    borderRadius: 4,
    borderWidth: 1,
    boxShadow: "4px 6px 16px rgba(0, 0, 0, 0.65)",
    overflow: "hidden",
    position: "relative",
    zIndex: 2,
  },
  coverDvd: {
    aspectRatio: 0.75,
    height: "100%",
  },
  coverSquare: {
    aspectRatio: 1,
    height: "100%",
  },
  disc: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 999,
    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    position: "absolute",
    right: "2%",
    top: "5%",
    width: "74%",
    zIndex: 1,
  },
  discDvd: {
    right: "2%",
    top: "12%",
    width: "66%",
  },
  discSevenInch: {
    right: "4%",
    top: "12%",
    width: "62%",
  },
  dvdSpine: {
    backgroundColor: "#09090B",
    borderRightColor: "rgba(255, 255, 255, 0.16)",
    borderRightWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: "11%",
    zIndex: 4,
  },
  fill: {
    height: "100%",
    width: "100%",
  },
  grooveMid: {
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 999,
    borderWidth: 1,
    height: "68%",
    position: "absolute",
    width: "68%",
  },
  grooveOuter: {
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    borderWidth: 1,
    height: "86%",
    position: "absolute",
    width: "86%",
  },
  opticalDisc: {
    backgroundColor: "#C8CCD8",
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
  },
  opticalHub: {
    backgroundColor: "#E4E4E7",
    borderColor: "rgba(0, 0, 0, 0.2)",
    borderWidth: 1,
    height: "34%",
    width: "34%",
  },
  placeholder: {
    alignItems: "center",
    backgroundColor: "#18181B",
    flex: 1,
    justifyContent: "center",
  },
  sevenInchLabel: {
    height: "42%",
    width: "42%",
  },
  spindle: {
    backgroundColor: "#09090B",
    borderRadius: 999,
    height: "24%",
    position: "absolute",
    width: "24%",
  },
  spindleSevenInch: {
    height: "38%",
    width: "38%",
  },
  stage: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "#111114",
    justifyContent: "center",
    overflow: "hidden",
    width: "100%",
  },
  vinylDisc: {
    backgroundColor: "#141418",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
  },
  vinylLabel: {
    backgroundColor: "#27272A",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    height: "35%",
    width: "35%",
  },
});
