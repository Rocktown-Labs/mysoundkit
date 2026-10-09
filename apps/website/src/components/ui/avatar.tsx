import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

import { mediaImageSrcProps } from "@/lib/image-derivatives";
import { cn } from "@/lib/utils";

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  src,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  // Avatars render at thumbnail sizes but historically downloaded
  // multi-megabyte profile originals; SoundKit media URLs get the same WebP
  // derivative candidates AppImage uses. Attribute behavior is otherwise
  // unchanged — no new defaults: lazy-loading previously-eager avatars once
  // destabilized a browser smoke test (same class of regression as #373).
  const mediaSrcProps =
    typeof src === "string" ? mediaImageSrcProps(src) : null;

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={src}
      {...(mediaSrcProps
        ? {
            sizes: "(max-width: 768px) 96px, 48px",
            srcSet: mediaSrcProps.srcSet,
          }
        : {})}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
