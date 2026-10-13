import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ComponentRef, ForwardedRef, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface MenuSheetItem {
  description?: string;
  href?: string;
  icon?: string;
  label: string;
  onPress?: () => void;
}

export interface BottomMenuSheetHandle {
  present: () => void;
}

interface BottomMenuSheetProps {
  description?: ReactNode;
  items: readonly MenuSheetItem[];
  title: string;
}

function BottomMenuSheetBase(
  { description, items, title }: BottomMenuSheetProps,
  ref: ForwardedRef<BottomMenuSheetHandle>
) {
  const { colorScheme } = useColorScheme(),
    sheetRef = useRef<BottomSheetModalHandle>(null),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        sheetRef.current?.present();
      },
    }),
    []
  );

  return (
    <BottomSheetModal
      backdropComponent={renderSheetBackdrop}
      backgroundStyle={{ backgroundColor: theme.card }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text selectable style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={[styles.description, { color: theme.mutedText }]}
          >
            {description}
          </Text>
        ) : null}
        <View style={styles.list}>
          {items.map((item, index) => {
            const key = `${item.label}-${index}`,
              row = (
                <Pressable
                  accessibilityHint={`Opens ${item.label}`}
                  accessibilityRole="button"
                  onPress={() => {
                    item.onPress?.();
                    sheetRef.current?.dismiss();
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: pressed ? theme.muted : theme.background,
                      borderColor: theme.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {item.icon ? (
                    <View
                      style={[
                        styles.icon,
                        { backgroundColor: `${theme.primary}18` },
                      ]}
                    >
                      <Ionicons
                        color={theme.primary}
                        name={item.icon as keyof typeof Ionicons.glyphMap}
                        size={18}
                      />
                    </View>
                  ) : null}
                  <View style={styles.copy}>
                    <Text
                      selectable
                      style={[styles.itemLabel, { color: theme.text }]}
                    >
                      {item.label}
                    </Text>
                    {item.description ? (
                      <Text
                        numberOfLines={2}
                        style={[styles.itemCopy, { color: theme.mutedText }]}
                      >
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    color={theme.mutedText}
                    name="chevron-forward"
                    size={16}
                  />
                </Pressable>
              );

            return item.href ? (
              <Link href={item.href as Href} asChild key={key}>
                {row}
              </Link>
            ) : (
              <View key={key}>{row}</View>
            );
          })}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const BottomMenuSheet = forwardRef(BottomMenuSheetBase),
  SNAP_POINTS = ["55%"],
  renderSheetBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={0}
      opacity={0.4}
    />
  ),
  styles = StyleSheet.create({
    content: { padding: 20 },
    copy: { flex: 1, gap: 2 },
    description: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
    icon: {
      alignItems: "center",
      borderRadius: 10,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    item: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 56,
      padding: 12,
    },
    itemCopy: { fontSize: 12, lineHeight: 16 },
    itemLabel: { fontSize: 14, fontWeight: "700" },
    list: { gap: 8 },
    title: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  });

export { BottomMenuSheet };

type BottomSheetModalHandle = ComponentRef<typeof BottomSheetModal>;
