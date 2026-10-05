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

  // SoundKit media URLs serve `.{width}w.webp` derivatives: let the browser
  // pick a sized candidate instead of downloading multi-MB originals.
  const mediaSrcProps = mediaImageSrcProps(effectiveSrc);
  if (mediaSrcProps) {
    return (
      <img
        alt={alt}
        className={className}
        decoding="async"
        loading={props.loading ?? "lazy"}
        onError={handleError}
        sizes={mediaSrcProps.sizes}
        src={
          // codeql[js/xss-through-dom]: false positive — this URL is a
          // SoundKit API media URL (mediaImageSrcProps validated it) or the
          // bundled /placeholder.svg, and img src cannot execute
          // javascript: URLs. Same accepted pattern as the open media player
          // and waveform alerts (#16/#17).
          effectiveSrc
        }
        srcSet={mediaSrcProps.srcSet}
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
