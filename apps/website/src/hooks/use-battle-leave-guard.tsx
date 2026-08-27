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
  isArtist,
  isLeaving,
  onForfeit,
  onLeave,
  onQuit,
  shouldBlock,
}: {
  isArtist: boolean;
  isLeaving: boolean;
  onForfeit?: () => void | Promise<void>;
  onLeave: () => void | Promise<void>;
  onQuit?: () => void | Promise<void>;
  shouldBlock: boolean;
}) {
  const shouldBlockRef = useRef(shouldBlock);
  shouldBlockRef.current = shouldBlock;

  const { proceed, reset, status } = useBlocker({
      enableBeforeUnload: () => shouldBlockRef.current && !isLeaving,
      shouldBlockFn: () => shouldBlockRef.current && !isLeaving,
      withResolver: true,
    }),
    leaveAndProceed = async (
      action: "forfeit" | "leave" | "quit" = "leave"
    ) => {
      try {
        if (action === "forfeit" && onForfeit) {
          await onForfeit();
        } else if (action === "quit" && onQuit) {
          await onQuit();
        } else {
          await onLeave();
        }
        proceed?.();
      } catch {
        reset?.();
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
            <AlertDialogTitle>
              {isArtist ? "Leave this battle?" : "Leave the live room?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArtist
                ? "You are an active battle artist. Choose whether leaving records a quit or a forfeit."
                : "You will leave the admitted viewer group. To watch again, you will need to rejoin the battle queue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={reset}>
              Stay in Battle
            </AlertDialogCancel>
            {isArtist ? (
              <>
                {onQuit && (
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      void leaveAndProceed("quit");
                    }}
                  >
                    Quit and Leave
                  </AlertDialogAction>
                )}
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void leaveAndProceed("forfeit");
                  }}
                >
                  Leave and Forfeit
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void leaveAndProceed();
                }}
              >
                Leave Room
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

  return { dialog };
}
