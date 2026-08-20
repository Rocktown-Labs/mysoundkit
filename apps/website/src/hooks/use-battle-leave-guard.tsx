"use client";

import { useBlocker } from "@tanstack/react-router";
import { useRef } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Blocks navigation away from a battle only while the viewer is admitted to an
 * active round, offering a chance to leave the battle cleanly. Queued/waiting
 * viewers are not blocked so they can browse while a scheduled battle is open.
 */
export function useBattleLeaveGuard({
  isLeaving,
  onLeave,
  shouldBlock,
}: {
  isLeaving: boolean;
  onLeave: () => void | Promise<void>;
  shouldBlock: boolean;
}) {
  const shouldBlockRef = useRef(shouldBlock);
  shouldBlockRef.current = shouldBlock;

  const { proceed, reset, status } = useBlocker({
    enableBeforeUnload: () => shouldBlockRef.current && !isLeaving,
    shouldBlockFn: () => shouldBlockRef.current && !isLeaving,
    withResolver: true,
  }),

   leaveAndProceed = async () => {
    try {
      await onLeave();
    } finally {
      proceed?.();
    }
  },

   dialog = (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          reset?.();
        }
      }}
      open={status === "blocked"}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this battle?</AlertDialogTitle>
          <AlertDialogDescription>
            You are an active participant in this round. Leaving removes you
            from the battle and forfeits your vote this round. You can rejoin
            the queue at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={reset}>Stay in Battle</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void leaveAndProceed();
            }}
          >
            Leave Battle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog };
}
