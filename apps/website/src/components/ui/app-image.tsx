import { Image } from "@unpic/react";
import type { ImageProps } from "@unpic/react";
import type { ComponentProps } from "react";

type AppImageProps = Omit<ImageProps, "src" | "alt"> & {
  alt: string;
  src: string;
};

export function AppImage({
  alt,
  layout = "constrained",
  src,
  ...props
}: AppImageProps) {
  const imageProps = {
    ...props,
    alt,
    layout,
    src: src || "/placeholder.svg",
  } as ComponentProps<typeof Image>;

  return <Image {...imageProps} />;
}
