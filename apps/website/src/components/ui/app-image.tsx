import { Image } from "@unpic/react";
import type { ImageProps } from "@unpic/react";

type AppImageProps = Omit<ImageProps, "src" | "alt"> & {
  alt: string;
  src: string;
};

export function AppImage({ alt, src, ...props }: AppImageProps) {
  return <Image alt={alt} src={src || "/placeholder.svg"} {...props} />;
}
