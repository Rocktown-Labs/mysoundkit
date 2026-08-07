"use client";

import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

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

// File/Blob values cannot be serialized into a draft; drop them.
const draftReplacer = (_key: string, value: unknown) =>
  value instanceof File || value instanceof Blob ? undefined : value;

const DIALOG_TITLE = "Leave without finishing?";
const DIALOG_DESCRIPTION =
  "You have unsaved changes. Your progress is saved as a draft on this device and will be restored when you come back.";
const DIALOG_CANCEL_LABEL = "Keep editing";
const DIALOG_CONFIRM_LABEL = "Leave";

interface UseFormDraftGuardOptions<TFieldValues extends FieldValues> {
  /** Extra dirty state not tracked by react-hook-form (e.g. selected files). */
  additionalDirtyState?: boolean;
  form: UseFormReturn<TFieldValues>;
  storageKey: string;
}

/**
 * Persists form values to localStorage as a draft (restored on mount) and
 * blocks navigation while the form has unsaved changes, confirming with a
 * dialog. Call `allowNavigation()` + `clearDraft()` after a successful submit.
 */
export function useFormDraftGuard<TFieldValues extends FieldValues>({
  additionalDirtyState,
  defaultValues,
  form,
  storageKey,
}: UseFormDraftGuardOptions<TFieldValues> & {
  defaultValues?: TFieldValues;
}) {
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const formIsDirty = form.formState.isDirty;
  const hasUnsavedChanges = Boolean(formIsDirty || additionalDirtyState);
  const skipNextPersistenceRef = useRef(false);

  // Keep latest dirty state readable from blocker callbacks.
  const dirtyRef = useRef(hasUnsavedChanges);
  dirtyRef.current = hasUnsavedChanges;
  const bypassRef = useRef(false);

  // Restore a saved draft once on mount (client only).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        form.reset(JSON.parse(stored) as TFieldValues);
        setHasSavedDraft(true);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [form, storageKey]);

  // Persist values whenever they change.
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (skipNextPersistenceRef.current) {
        skipNextPersistenceRef.current = false;
        return;
      }

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(values, draftReplacer)
        );
      } catch {
        // Persistence is best-effort (storage may be full or unavailable).
      }
    });
    return () => subscription.unsubscribe();
  }, [form, storageKey]);

  const { proceed, reset, status } = useBlocker({
    enableBeforeUnload: () => dirtyRef.current && !bypassRef.current,
    shouldBlockFn: () => dirtyRef.current && !bypassRef.current,
    withResolver: true,
  });

  const allowNavigation = () => {
    bypassRef.current = true;
  };

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(storageKey);
      setHasSavedDraft(false);
    } catch {
      // Persistence is best-effort.
    }
  };

  const resetDraft = () => {
    skipNextPersistenceRef.current = true;
    clearDraft();
    if (defaultValues) {
      form.reset(defaultValues);
    } else {
      form.reset();
    }
    queueMicrotask(() => {
      skipNextPersistenceRef.current = false;
    });
  };

  const blockerDialog = (
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
          <AlertDialogTitle>{DIALOG_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{DIALOG_DESCRIPTION}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={reset}>
            {DIALOG_CANCEL_LABEL}
          </AlertDialogCancel>
          <AlertDialogAction onClick={proceed}>
            {DIALOG_CONFIRM_LABEL}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    allowNavigation,
    blockerDialog,
    clearDraft,
    hasSavedDraft,
    resetDraft,
  };
}
