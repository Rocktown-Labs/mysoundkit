/* eslint-disable one-var, sort-vars */
import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

const BOTTOM_THRESHOLD_PX = 48;

interface MessageScrollerProps {
  children: ReactNode;
  className?: string;
  messageCount: number;
}

export function MessageScroller({
  children,
  className,
  messageCount,
}: MessageScrollerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null),
    previousMessageCountRef = useRef(messageCount),
    [isAtBottom, setIsAtBottom] = useState(true),
    [hasNewMessages, setHasNewMessages] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const messageCountIncreased =
      messageCount > previousMessageCountRef.current;
    previousMessageCountRef.current = messageCount;

    if (!messageCountIncreased || isAtBottom) {
      viewport.scrollTo({
        behavior: "auto",
        top: viewport.scrollHeight,
      });
      setHasNewMessages(false);
      setIsAtBottom(true);
      return;
    }

    setHasNewMessages(true);
  }, [isAtBottom, messageCount]);

  const handleScroll = () => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const nextIsAtBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
        BOTTOM_THRESHOLD_PX;
      setIsAtBottom(nextIsAtBottom);
      if (nextIsAtBottom) {
        setHasNewMessages(false);
      }
    },
    scrollToLatest = () => {
      viewportRef.current?.scrollTo({
        behavior: "smooth",
        top: viewportRef.current.scrollHeight,
      });
      setHasNewMessages(false);
      setIsAtBottom(true);
    };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        className={cn("h-full overflow-y-auto", className)}
        onScroll={handleScroll}
        ref={viewportRef}
      >
        {children}
      </div>
      {hasNewMessages && !isAtBottom ? (
        <Button
          aria-label="Jump to latest messages"
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 gap-1.5 rounded-full shadow-lg"
          onClick={scrollToLatest}
          size="sm"
          type="button"
          variant="secondary"
        >
          <ArrowDown data-icon="inline-start" />
          Latest messages
        </Button>
      ) : null}
    </div>
  );
}
