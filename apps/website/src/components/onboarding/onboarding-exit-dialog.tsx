import { LogOut, PauseCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type OnboardingExitAction = "finish-later" | "log-out";

interface OnboardingExitDialogProps {
  onFinishLater: () => void;
  onLogOut: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingAction: OnboardingExitAction | null;
}

export function OnboardingExitDialog({
  onFinishLater,
  onLogOut,
  onOpenChange,
  open,
  pendingAction,
}: OnboardingExitDialogProps) {
  const isPending = pendingAction !== null;

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen);
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Leave setup?</DialogTitle>
          <DialogDescription>
            Choose whether to keep your progress for later or remove this
            unfinished setup and sign out.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            className="h-auto min-h-28 flex-col items-start justify-start gap-2 whitespace-normal p-4 text-left"
            disabled={isPending}
            onClick={onFinishLater}
            variant="outline"
          >
            <span className="flex items-center gap-2 font-semibold">
              <PauseCircle className="size-5 text-primary" />
              {pendingAction === "finish-later"
                ? "Saving progress…"
                : "Finish later"}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Keep your progress and explore SoundKit. Your dashboard will stay
              locked until setup is complete.
            </span>
          </Button>
          <Button
            className="h-auto min-h-28 flex-col items-start justify-start gap-2 whitespace-normal p-4 text-left"
            disabled={isPending}
            onClick={onLogOut}
            variant="destructive"
          >
            <span className="flex items-center gap-2 font-semibold">
              <LogOut className="size-5" />
              {pendingAction === "log-out" ? "Signing out…" : "Log out"}
            </span>
            <span className="text-xs font-normal text-destructive-foreground/80">
              Delete this unfinished onboarding record and return to the home
              page signed out.
            </span>
          </Button>
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            variant="ghost"
          >
            Keep setting up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
