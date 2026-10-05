"use client";
/* eslint-disable one-var, sort-vars */
import { Image } from "@unpic/react";
import type { ImageProps } from "@unpic/react";
import type { ComponentProps } from "react";
import { useState } from "react";

import { mediaImageSrcProps } from "@/lib/image-derivatives";

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
      hasFailed,
    // SoundKit media URLs serve `.{width}w.webp` derivatives: let the browser
    // pick a sized candidate instead of downloading multi-MB originals.
    mediaSrcProps = mediaImageSrcProps(effectiveSrc);

  // Blob/data/local placeholder sources and responsive SoundKit media share a
  // single direct <img> sink. Its URL is either a local placeholder, a
  // same-origin blob/data URL the browser created, or a SoundKit API media
  // URL validated by mediaImageSrcProps — and an img src cannot execute
  // javascript: URLs — so the open js/xss-through-dom alert on this sink is
  // an accepted false positive.
  if (isBlobOrDataOrFallback || mediaSrcProps) {
    return (
      <img
        alt={alt}
        className={className}
        onError={handleError}
        src={effectiveSrc}
        {...(mediaSrcProps
          ? {
              decoding: "async",
              loading: props.loading ?? "lazy",
              sizes: mediaSrcProps.sizes,
              srcSet: mediaSrcProps.srcSet,
            }
          : {})}
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
