"use client";

import { HandCoins } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LiveTipKind } from "@/lib/soundkit-api-hooks";

export interface LiveTipRecipient {
  avatarUrl?: string | null;
  id: string;
  name: string;
}

interface LiveTipButtonProps {
  isLive: boolean;
  kind: LiveTipKind;
  liveExperienceId: string;
  recipients: LiveTipRecipient[];
}

// @stripe/stripe-js injects its 256KB script at *import* time, so the dialog
// (the only place those imports are allowed to live) is a lazy chunk: nothing
// Stripe-related downloads until the first Tip click.
const LiveTipDialog = lazy(async () => {
  const module = await import("./live-tip-dialog");
  return { default: module.LiveTipDialog };
});

export function LiveTipButton({
  isLive,
  kind,
  liveExperienceId,
  recipients,
}: LiveTipButtonProps) {
  const [hasOpened, setHasOpened] = useState(false),
    [isOpen, setIsOpen] = useState(false);

  if (!isLive || recipients.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        className="gap-1.5"
        onClick={() => {
          setHasOpened(true);
          setIsOpen(true);
        }}
        size="sm"
        type="button"
        variant="default"
      >
        <HandCoins className="size-3.5" />
        Tip
      </Button>

      {hasOpened ? (
        <Suspense fallback={null}>
          <LiveTipDialog
            isOpen={isOpen}
            kind={kind}
            liveExperienceId={liveExperienceId}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (open) {
                setHasOpened(true);
              }
            }}
            recipients={recipients}
          />
        </Suspense>
      ) : null}
    </>
  );
}
