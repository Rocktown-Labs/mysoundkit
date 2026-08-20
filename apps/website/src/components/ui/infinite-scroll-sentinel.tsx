"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useRef } from "react";

interface InfiniteScrollSentinelProps {
  fetchNextPage: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
}

export function InfiniteScrollSentinel({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current,
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        {
          rootMargin: "300px",
          threshold: 0.1,
        }
      );

    if (!sentinel || !hasNextPage || isFetchingNextPage) {
      return;
    }

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (!hasNextPage && !isFetchingNextPage) {
    return null;
  }

  return (
    <div
      ref={sentinelRef}
      className="flex w-full items-center justify-center py-6 text-muted-foreground"
    >
      {isFetchingNextPage ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Loading more...</span>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}
