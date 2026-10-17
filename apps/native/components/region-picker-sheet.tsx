/* oxlint-disable one-var */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type {
  BottomSheetBackdropProps,
  BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ForwardedRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LiquidGlassView } from "@/components/liquid-glass";
import { NativeMap } from "@/components/native-map";
import { NAV_THEME } from "@/lib/constants";
import type { MapScope } from "@/lib/explore-region";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface RegionPickerSheetHandle {
  dismiss: () => void;
  present: () => void;
}

interface RegionPickerSheetProps {
  onRegionChange: (scope: MapScope, regionName: string | null) => void;
  scope: MapScope;
  selectedRegion: string | null;
}

const SNAP_POINTS = ["80%"];

function renderSheetBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.65}
    />
  );
}

function renderSheetBackground({ style }: BottomSheetBackgroundProps) {
  return (
    <LiquidGlassView
      borderRadius={26}
      intensity={85}
      style={[
        style,
        {
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        },
      ]}
      variant="sheet"
    />
  );
}

function RegionPickerSheetBase(
  { onRegionChange, scope, selectedRegion }: RegionPickerSheetProps,
  ref: ForwardedRef<RegionPickerSheetHandle>
) {
  const { colorScheme } = useColorScheme(),
    sheetRef = useRef<BottomSheetModal>(null),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  useImperativeHandle(
    ref,
    () => ({
      dismiss: () => {
        sheetRef.current?.dismiss();
      },
      present: () => {
        sheetRef.current?.present();
      },
    }),
    []
  );

  return (
    <BottomSheetModal
      backdropComponent={renderSheetBackdrop}
      backgroundComponent={renderSheetBackground}
      handleIndicatorStyle={{ backgroundColor: "rgba(255, 255, 255, 0.28)" }}
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Choose a region
          </Text>
          <Text style={[styles.description, { color: theme.mutedText }]}>
            Charts, drops, and live moments from the region you pick.
          </Text>
        </View>

        <NativeMap
          onRegionSelect={(regionName) => {
            onRegionChange(scope, regionName);
          }}
          onResetGlobal={() => {
            onRegionChange("global", null);
          }}
          onScopeChange={(newScope, regionName) => {
            onRegionChange(newScope, regionName ?? null);
          }}
          scope={scope}
          selectedRegion={selectedRegion}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export const RegionPickerSheet = forwardRef(RegionPickerSheetBase);

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  header: {
    gap: 4,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
