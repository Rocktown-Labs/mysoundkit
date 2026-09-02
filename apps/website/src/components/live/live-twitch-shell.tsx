"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp */

import { MessageSquare, PanelRightOpen } from "lucide-react";
import React, { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface LiveTwitchShellProps {
  chatPanel?: React.ReactNode;
  children: React.ReactNode;
  defaultChatOpen?: boolean;
  isChatOpen?: boolean;
  onChatOpenChange?: (open: boolean) => void;
  videoNode: React.ReactNode;
}

export function LiveTwitchShell({
  chatPanel,
  children,
  defaultChatOpen = true,
  isChatOpen: controlledChatOpen,
  onChatOpenChange,
  videoNode,
}: LiveTwitchShellProps) {
  const [internalChatOpen, setInternalChatOpen] = useState(defaultChatOpen),
    isChatOpen =
      controlledChatOpen === undefined ? internalChatOpen : controlledChatOpen,
    videoContainerRef = useRef<HTMLDivElement | null>(null),
    handleSetChatOpen = (open: boolean) => {
      if (onChatOpenChange) {
        onChatOpenChange(open);
      }
      setInternalChatOpen(open);
    };

  return (
    <div className="relative flex h-full min-h-0 max-h-full w-full overflow-hidden">
      {/* 2-Column Responsive Layout: Left content (video + creator details) / Right sticky chat */}
      <div
        className={`grid h-full min-h-0 min-w-0 w-full transition-[grid-template-columns] duration-300 ease-in-out ${
          isChatOpen && chatPanel
            ? "lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]"
            : "grid-cols-1"
        }`}
      >
        {/* Left Column: Player & Creator Panels (independently scrolling) */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 pb-24 md:p-6 md:pb-6">
          {/* Video Container */}
          <div
            className="relative w-full shrink-0 overflow-hidden rounded-xl bg-black shadow-2xl"
            ref={videoContainerRef}
          >
            {videoNode}
          </div>

          {/* Additional details below video (Artist profile, tabs, etc.) */}
          <div className="min-w-0 flex-1">{children}</div>

          {/* Mobile / Inline Reopen Chat Button when collapsed */}
          {!isChatOpen && chatPanel && (
            <div className="mt-4 lg:hidden">
              <Button
                className="w-full flex items-center justify-center gap-2 shadow-sm"
                onClick={() => handleSetChatOpen(true)}
                size="default"
                variant="outline"
              >
                <MessageSquare className="size-4 text-primary" />
                <span>Open Live Chat</span>
              </Button>
            </div>
          )}
        </main>

        {/* Right Chat Sidebar (flush full-height chrome on desktop / bottom on mobile) */}
        {isChatOpen && chatPanel ? (
          <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border/40 bg-card/60 backdrop-blur-md max-lg:mb-16 max-lg:min-h-[420px] max-lg:border-t">
            {chatPanel}
          </aside>
        ) : null}
      </div>

      {/* Floating Reopen Chat Button when collapsed on Desktop */}
      {!isChatOpen && chatPanel && (
        <div className="absolute top-4 right-4 z-40 hidden lg:block">
          <Button
            className="shadow-xl bg-background/95 backdrop-blur-md border border-border/80 hover:bg-accent"
            onClick={() => handleSetChatOpen(true)}
            size="sm"
            variant="outline"
          >
            <PanelRightOpen className="mr-1.5 size-4 text-primary" />
            Expand Chat
          </Button>
        </div>
      )}
    </div>
  );
}
