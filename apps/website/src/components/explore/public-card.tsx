import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PublicCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  framed?: boolean;
}

export function PublicCard({
  children,
  className,
  framed = false,
  ...props
}: PublicCardProps) {
  return (
    <article
      className={cn(
        "group flex min-w-0 flex-col gap-2.5",
        framed &&
          "overflow-hidden rounded-lg border border-border/50 bg-card/60 transition-colors hover:border-primary/60",
        className
      )}
      {...props}
    >
      {children}
    </article>
  );
}

interface PublicCardThumbnailProps extends HTMLAttributes<HTMLDivElement> {
  aspect?: "square" | "video";
  children: ReactNode;
}

export function PublicCardThumbnail({
  aspect = "video",
  children,
  className,
  ...props
}: PublicCardThumbnailProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-muted",
        aspect === "square" ? "aspect-square" : "aspect-video",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PublicCardMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 px-0.5", className)}>{children}</div>;
}
