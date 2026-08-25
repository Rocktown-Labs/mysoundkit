/* eslint-disable one-var, sort-vars */
import { Image } from "@unpic/react";
import type { ImageProps } from "@unpic/react";
import type { ComponentProps } from "react";
import { useState } from "react";

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
  const sourceKey = src ?? "",
    [failedSourceKey, setFailedSourceKey] = useState<string | null>(null),
    hasFailed = failedSourceKey === sourceKey,
    handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setFailedSourceKey(sourceKey);
      onError?.(e);
    },
    effectiveSrc = hasFailed ? "/placeholder.svg" : src || "/placeholder.svg",
    isBlobOrDataOrFallback =
      effectiveSrc.startsWith("blob:") ||
      effectiveSrc.startsWith("data:") ||
      effectiveSrc.startsWith("/") ||
      hasFailed;

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
