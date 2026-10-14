import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ForwardedRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LibraryGrid } from "@/components/library-grid";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface LibraryBottomSheetHandle {
  dismiss: () => void;
  present: () => void;
}

const SNAP_POINTS = ["75%"];

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

export interface LibraryBottomSheetProps {
  children?: React.ReactNode;
}

function LibraryBottomSheetBase(
  _props: LibraryBottomSheetProps,
  ref: ForwardedRef<LibraryBottomSheetHandle>
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
      backgroundStyle={{ backgroundColor: "#121215" }}
      handleIndicatorStyle={{ backgroundColor: "#3f3f46" }}
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons color="#c084fc" name="musical-notes" size={24} />
            <Text style={[styles.title, { color: theme.text }]}>
              My SoundKit
            </Text>
          </View>
          <Text style={[styles.description, { color: theme.mutedText }]}>
            Access your music collection, playlists, and listening history
          </Text>
        </View>

        <LibraryGrid
          onItemPress={() => {
            sheetRef.current?.dismiss();
          }}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export const LibraryBottomSheet = forwardRef(LibraryBottomSheetBase);

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
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
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});
