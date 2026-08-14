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
  "You have unsaved changes. If you leave, this attempt and any temporary uploads will be discarded.";
const DIALOG_CANCEL_LABEL = "Keep editing";
const DIALOG_CONFIRM_LABEL = "Leave";

interface UseFormDraftGuardOptions<TFieldValues extends FieldValues> {
  /** Extra dirty state not tracked by react-hook-form (e.g. selected files). */
  additionalDirtyState?: boolean;
  form: UseFormReturn<TFieldValues>;
  /** Delete temporary records or uploads before leaving the form. */
  onDiscard?: () => Promise<void> | void;
  /** Disable restoring an existing draft on mount (use when editing existing records). */
  restoreOnMount?: boolean;
  storageKey: string;
  /** Disable writing the draft back to localStorage (use when editing existing records). */
  persist?: boolean;
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
  onDiscard,
  persist = true,
  restoreOnMount = true,
  storageKey,
}: UseFormDraftGuardOptions<TFieldValues> & {
  defaultValues?: TFieldValues;
}) {
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const formIsDirty = form.formState.isDirty;
  const hasUnsavedChanges = Boolean(formIsDirty || additionalDirtyState);
  const skipNextPersistenceRef = useRef(false);
  const defaultValuesRef = useRef(defaultValues);

  // Keep latest dirty state readable from blocker callbacks.
  const dirtyRef = useRef(hasUnsavedChanges);
  dirtyRef.current = hasUnsavedChanges;
  const bypassRef = useRef(false);

  // Restore a saved draft once on mount (client only).
  useEffect(() => {
    if (!restoreOnMount) {
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsedDraft = JSON.parse(stored) as Partial<TFieldValues>;
        form.reset(
          defaultValuesRef.current
            ? ({ ...defaultValuesRef.current, ...parsedDraft } as TFieldValues)
            : (parsedDraft as TFieldValues)
        );
        setHasSavedDraft(true);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [form, restoreOnMount, storageKey]);

  // Persist values whenever they change.
  useEffect(() => {
    if (!persist) {
      return;
    }
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
  }, [form, persist, storageKey]);

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

  const discardAndProceed = async () => {
    try {
      await onDiscard?.();
    } finally {
      clearDraft();
      proceed?.();
    }
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
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void discardAndProceed();
            }}
          >
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
