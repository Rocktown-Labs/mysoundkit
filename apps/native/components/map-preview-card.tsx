/* oxlint-disable one-var */
import { Pressable, StyleSheet } from "react-native";

import { NativeMap } from "@/components/native-map";
import { mapScopeLabel } from "@/lib/map-scopes";
import type { MapScope } from "@/lib/map-scopes";

/* Preview mode never reacts to map taps; the card itself is the tap target. */
const NOOP = (): undefined => undefined;

/**
 * Non-interactive map preview shown on the Discover page so the map — one of
 * the app's selling points — is visible without opening the region sheet.
 * Tapping anywhere on it opens the full region picker.
 */
export function MapPreviewCard({
  onPress,
  regionName,
  scope,
}: {
  onPress: () => void;
  regionName?: null | string;
  scope: MapScope;
}) {
  const previewLabel = regionName ?? mapScopeLabel(scope);

  return (
    <Pressable
      accessibilityHint="Opens the map to change your region"
      accessibilityLabel={`Map showing region ${previewLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.wrapperPressed,
      ]}
    >
      <NativeMap
        onRegionSelect={NOOP}
        onScopeChange={NOOP}
        preview
        scope={scope}
        selectedRegion={regionName ?? null}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  wrapperPressed: {
    opacity: 0.85,
  },
});
