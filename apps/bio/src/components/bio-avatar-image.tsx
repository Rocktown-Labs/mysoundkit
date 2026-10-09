"use client";

import { mediaImageSrcProps } from "@/lib/image-derivatives";

export interface BioAvatarImageProps {
  alt: string;
  className?: string;
  height: number;
  src: string;
  width: number;
}

/**
 * Avatar <img> for SoundKit media URLs: renders WebP derivative candidates
 * (`.{width}w.webp`, generated server-side) instead of multi-megabyte profile
 * originals at thumbnail display sizes. Non-media sources render unchanged.
 */
export function BioAvatarImage({
  alt,
  className,
  height,
  src,
  width,
}: BioAvatarImageProps) {
  const mediaSrcProps = mediaImageSrcProps(src);

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={height}
      loading="lazy"
      src={src}
      {...(mediaSrcProps
        ? { sizes: mediaSrcProps.sizes, srcSet: mediaSrcProps.srcSet }
        : {})}
      width={width}
    />
  );
}
