import { Image } from "@unpic/react";
import type { ImageProps } from "@unpic/react";
import type { ComponentProps } from "react";
import { useRef, useState } from "react";

type AppImageProps = Omit<ImageProps, "src" | "alt"> & {
  alt: string;
  src?: string | null;
  className?: string;
};

export function AppImage({
  alt,
  className,
  layout = "constrained",
  onError,
  src,
  ...props
}: AppImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src || "/placeholder.svg"),
    hasErroredRef = useRef(false),
    handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (!hasErroredRef.current) {
        hasErroredRef.current = true;
        setImgSrc("/placeholder.svg");
      }
      if (onError) {
        onError(e);
      }
    },
    effectiveSrc = imgSrc || "/placeholder.svg",
    isBlobOrDataOrFallback =
      effectiveSrc.startsWith("blob:") ||
      effectiveSrc.startsWith("data:") ||
      effectiveSrc.startsWith("/") ||
      hasErroredRef.current;

  if (isBlobOrDataOrFallback) {
    return (
      <img
        alt={alt}
        className={className}
        onError={handleError}
        src={effectiveSrc}
        {...(props as ComponentProps<"img">)}
      />
    );
  }

  const imageProps = {
    ...props,
    alt,
    className,
    layout,
    onError: handleError,
    src: effectiveSrc,
  } as ComponentProps<typeof Image>;

  return <Image {...imageProps} />;
}
