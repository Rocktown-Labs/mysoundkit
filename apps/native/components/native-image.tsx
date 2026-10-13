import { Image } from "expo-image";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { resolveApiUrl } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

type ImageProps = ComponentProps<typeof Image>;

const styles = StyleSheet.create({
  image: {
    backgroundColor: "transparent",
    height: "100%",
    width: "100%",
  },
});

/**
 * Remote image that resolves relative API asset paths and falls back to the
 * themed muted surface when no source is available.
 */
export function NativeImage({
  source,
  style,
  ...props
}: Omit<ImageProps, "source"> & { source?: null | string | number }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    uri =
      typeof source === "string"
        ? (resolveApiUrl(source) ?? undefined)
        : undefined;

  return (
    <Image
      {...props}
      recyclingKey={uri}
      source={uri ? { uri } : undefined}
      style={[
        styles.image,
        style as never,
        uri ? null : { backgroundColor: theme.muted },
      ]}
    />
  );
}
