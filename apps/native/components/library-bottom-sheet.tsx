/* oxlint-disable one-var */
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type {
  BottomSheetBackdropProps,
  BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ForwardedRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LibraryGrid } from "@/components/library-grid";
import { LiquidGlassView } from "@/components/liquid-glass";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface LibraryBottomSheetHandle {
  dismiss: () => void;
  present: () => void;
}

const SNAP_POINTS = ["78%"];

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

export interface LibraryBottomSheetProps {
  children?: React.ReactNode;
}

function LibraryBottomSheetBase(
  _props: LibraryBottomSheetProps,
  ref: ForwardedRef<LibraryBottomSheetHandle>
) {
  const { colorScheme } = useColorScheme(),
    router = useRouter(),
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
          <View style={styles.topRow}>
            <View style={styles.titleRow}>
              <Ionicons color="#B8A3FF" name="musical-notes" size={24} />
              <Text style={[styles.title, { color: theme.text }]}>
                My SoundKit
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Open full library page"
              accessibilityRole="button"
              onPress={() => {
                sheetRef.current?.dismiss();
                router.push("/library");
              }}
              style={({ pressed }) => [
                styles.openFullBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.openFullBtnText}>Open Library</Text>
              <Ionicons color="#B8A3FF" name="arrow-forward" size={13} />
            </Pressable>
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
  openFullBtn: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderColor: "rgba(184, 163, 255, 0.3)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  openFullBtnText: {
    color: "#B8A3FF",
    fontSize: 12,
    fontWeight: "700",
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
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
