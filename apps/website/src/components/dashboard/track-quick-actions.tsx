"use client";
/* eslint-disable no-alert, no-void, one-var, react/no-array-index-key, react/todo, sort-vars */

import { useUploadFiles } from "@better-upload/client";
import {
  DollarSign,
  FileAudio,
  ImagePlus,
  LoaderCircle,
  Repeat,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { CreditsEditor } from "@/components/dashboard/credits-editor";
import type { CreditEntry } from "@/components/dashboard/credits-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import {
  apiClient,
  MEDIA_BASE_URL,
  MEDIA_UPLOAD_URL,
  TRACK_SOURCE_UPLOAD_URL,
  rpcJson,
} from "@/lib/api";
import { optimizeCoverImageFile } from "@/lib/image-processing";
import {
  useSellerStatusQuery,
  useTrackQuery,
  useUpdateTrackMutation,
} from "@/lib/soundkit-api-hooks";

const trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post;

/** Structural subset of the dashboard track collaborator row. */
export interface TrackCollaboratorRow {
  avatarUrl?: null | string;
  email?: null | string;
  id: string;
  name?: null | string;
  role: string;
  splitBps?: null | number;
  status?: string;
  userId?: null | string;
}

const SUPPORTED_CREDIT_ROLES = ["artist", "producer", "songwriter"] as const,
  isSupportedCreditRole = (
    role: string
  ): role is (typeof SUPPORTED_CREDIT_ROLES)[number] =>
    (SUPPORTED_CREDIT_ROLES as readonly string[]).includes(role),
  // Roles accepted by the PATCH collaborators contract.
  COLLABORATOR_ROLE_VALUES = [
    "artist",
    "producer",
    "vocalist",
    "engineer",
    "songwriter",
    "manager",
    "social_media_manager",
    "marketing",
    "family_member",
  ] as const;

type CollaboratorRole = (typeof COLLABORATOR_ROLE_VALUES)[number];

const toCollaboratorRole = (role: string): CollaboratorRole =>
    (COLLABORATOR_ROLE_VALUES as readonly string[]).includes(role)
      ? (role as CollaboratorRole)
      : "songwriter",
  /**
   * Splits collaborators into rows the credits editor can represent and
   * pass-through rows with other roles (vocalist, engineer, ...) which must be
   * preserved verbatim when the replacement payload is PATCHed.
   */
  partitionCollaborators = (collaborators: TrackCollaboratorRow[]) => {
    const editable: CreditEntry[] = [],
      preserved: TrackCollaboratorRow[] = [];

    for (const collaborator of collaborators) {
      if (isSupportedCreditRole(collaborator.role)) {
        editable.push({
          displayName:
            collaborator.name ?? collaborator.email ?? "Collaborator",
          inviteEmail: collaborator.email ?? undefined,
          role: collaborator.role,
          splitBps: collaborator.splitBps ?? undefined,
          userId: collaborator.userId ?? undefined,
        });
      } else {
        preserved.push(collaborator);
      }
    }

    return { editable, preserved };
  },
  buildCollaboratorsPayload = (
    editable: CreditEntry[],
    preserved: TrackCollaboratorRow[]
  ) => [
    ...editable.map((credit) => ({
      alsoCreditAsWriter: credit.alsoCreditAsWriter,
      inviteEmail: credit.inviteEmail,
      name: credit.displayName,
      role: credit.role,
      splitBps: credit.splitBps,
      userId: credit.userId,
    })),
    ...preserved.map((collaborator) => ({
      inviteEmail: collaborator.email ?? undefined,
      name: collaborator.name ?? undefined,
      role: toCollaboratorRole(collaborator.role),
      splitBps: collaborator.splitBps ?? undefined,
      userId: collaborator.userId ?? undefined,
    })),
  ];

interface QuickActionDialogProps {
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the page can refetch track data. */
  onSaved: () => unknown;
  open: boolean;
  trackId: string;
}

type QuickActionDialogName = "cover" | "credits" | "swap";

/** Renders the quick-action dialogs for a track detail view. */
export function TrackQuickActionDialogs({
  activeDialog,
  collaborators,
  onClose,
  onSaved,
  trackId,
}: {
  activeDialog: null | QuickActionDialogName;
  collaborators: TrackCollaboratorRow[];
  onClose: () => void;
  onSaved: () => unknown;
  trackId: string;
}) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <>
      <ChangeCoverArtDialog
        onOpenChange={handleOpenChange}
        onSaved={onSaved}
        open={activeDialog === "cover"}
        trackId={trackId}
      />
      <SwapMainFileDialog
        onOpenChange={handleOpenChange}
        onSaved={onSaved}
        open={activeDialog === "swap"}
        trackId={trackId}
      />
      <EditCreditsDialog
        collaborators={collaborators}
        onOpenChange={handleOpenChange}
        onSaved={onSaved}
        open={activeDialog === "credits"}
        trackId={trackId}
      />
    </>
  );
}

export function ChangeCoverArtDialog({
  onOpenChange,
  onSaved,
  open,
  trackId,
}: QuickActionDialogProps) {
  const { isPending: isUploading, uploadAsync } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      route: "media",
    }),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [isSaving, setIsSaving] = useState(false),
    hasUnsavedChanges = Boolean(selectedFile) || isSaving || isUploading,
    requestClose = (nextOpen: boolean) => {
      if (
        !nextOpen &&
        hasUnsavedChanges &&
        !window.confirm(
          "You have an unsaved cover image. Close without saving?"
        )
      ) {
        return;
      }
      setSelectedFile(null);
      onOpenChange(nextOpen);
    },
    handleSave = async () => {
      if (!selectedFile || isSaving) {
        return;
      }

      setIsSaving(true);
      try {
        const optimizedCover = await optimizeCoverImageFile(selectedFile).catch(
            () => selectedFile
          ),
          coverResult = await uploadAsync([optimizedCover]),
          // Array destructuring here widens to a union without objectInfo.
          // eslint-disable-next-line prefer-destructuring
          uploadedCover = coverResult.files[0];
        if (!uploadedCover) {
          throw new Error("The cover image could not be uploaded.");
        }

        const coverKey = uploadedCover.objectInfo.key;
        await rpcJson(
          await trackAssetPost({
            json: {
              assetKind: "cover_art",
              metadata: {
                originalFileName: selectedFile.name,
                url: `${MEDIA_BASE_URL}/${coverKey}`,
              },
              mimeType: "image/*",
              objectKey: coverKey,
              status: "ready",
              storageProvider: "r2",
            },
            param: { trackId },
          })
        );

        await onSaved();
        toast({
          description: "The new cover art was saved.",
          title: "Cover updated",
        });
        setSelectedFile(null);
        onOpenChange(false);
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not update the cover art.",
          title: "Cover update failed",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    };

  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change cover art</DialogTitle>
          <DialogDescription>
            Upload new artwork (PNG or JPG). The change applies immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {selectedFile ? (
            <img
              alt="Selected cover preview"
              className="mx-auto max-h-48 rounded-lg border border-border/40 object-contain"
              src={URL.createObjectURL(selectedFile)}
            />
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-muted/20 p-8 text-center text-sm text-muted-foreground hover:border-primary/50">
              <ImagePlus className="size-6 text-primary" />
              Click to choose an image
              <input
                accept=".png,.jpg,.jpeg"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && !file.type.startsWith("image/")) {
                    toast({
                      description: "Select a JPG or PNG cover image.",
                      title: "Invalid cover image",
                      variant: "destructive",
                    });
                    return;
                  }
                  setSelectedFile(file ?? null);
                }}
                type="file"
              />
            </label>
          )}
          {selectedFile ? (
            <Button
              onClick={() => setSelectedFile(null)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Choose a different image
            </Button>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={isSaving}
            onClick={() => requestClose(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedFile || isSaving || isUploading}
            onClick={() => void handleSave()}
            type="button"
          >
            {isSaving || isUploading ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save cover"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SwapMainFileDialog({
  onOpenChange,
  onSaved,
  open,
  trackId,
}: QuickActionDialogProps) {
  const { isPending: isUploading, uploadAsync } = useUploadFiles({
      api: TRACK_SOURCE_UPLOAD_URL,
      credentials: "include",
      route: "track-source",
    }),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [isSaving, setIsSaving] = useState(false),
    hasUnsavedChanges = Boolean(selectedFile) || isSaving || isUploading,
    requestClose = (nextOpen: boolean) => {
      if (
        !nextOpen &&
        hasUnsavedChanges &&
        !window.confirm(
          "You have an unsaved master file. Close without swapping?"
        )
      ) {
        return;
      }
      setSelectedFile(null);
      onOpenChange(nextOpen);
    },
    handleSave = async () => {
      if (!selectedFile || isSaving) {
        return;
      }

      setIsSaving(true);
      try {
        const masterResult = await uploadAsync([selectedFile]),
          uploadedMaster = masterResult.files.find(
            (entry) =>
              (entry.raw && entry.raw === selectedFile) ||
              entry.name === selectedFile.name
          );
        if (!uploadedMaster) {
          throw new Error(
            masterResult.failedFiles[0]?.error?.message ??
              "The master audio file could not be uploaded."
          );
        }

        await rpcJson(
          await trackAssetPost({
            json: {
              assetKind: "master",
              metadata: {
                originalFileName: selectedFile.name,
              },
              mimeType: selectedFile.type || "audio/mpeg",
              objectKey: uploadedMaster.objectInfo.key,
              sizeBytes: selectedFile.size,
              status: "ready",
              storageProvider: "r2",
            },
            param: { trackId },
          })
        );

        await onSaved();
        toast({
          description:
            "The main file was swapped. Media processing will regenerate streams and derivatives.",
          title: "Main file swapped",
        });
        setSelectedFile(null);
        onOpenChange(false);
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not swap the main file.",
          title: "Swap failed",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    };

  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Swap main file</DialogTitle>
          <DialogDescription>
            Replace the master audio. Streaming derivatives are regenerated from
            the new file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {selectedFile ? (
            <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <FileAudio className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-muted/20 p-8 text-center text-sm text-muted-foreground hover:border-primary/50">
              <FileAudio className="size-6 text-primary" />
              Click to choose a WAV, MP3 or AIFF file
              <input
                accept=".wav,.mp3,.aiff,.flac,.m4a"
                className="sr-only"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
            </label>
          )}
          {selectedFile ? (
            <Button
              onClick={() => setSelectedFile(null)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Choose a different file
            </Button>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={isSaving}
            onClick={() => requestClose(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedFile || isSaving || isUploading}
            onClick={() => void handleSave()}
            type="button"
          >
            {isSaving || isUploading ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Swap main file"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TrackCreditsEditorProps {
  collaborators: TrackCollaboratorRow[];
  /** Optional callback so parents can warn about unsaved changes. */
  onDirtyChange?: (dirty: boolean) => void;
  onSaved: () => unknown;
  trackId: string;
}

/**
 * Inline credits editor bound to the PATCH collaborators endpoint. Used in the
 * Collaborators tab and inside the header "Edit credits" quick-action dialog.
 */
export function TrackCreditsEditor({
  collaborators,
  onDirtyChange,
  onSaved,
  trackId,
}: TrackCreditsEditorProps) {
  const initialEditableCredits = partitionCollaborators(collaborators).editable,
    [editableCredits, setEditableCredits] = useState<CreditEntry[]>(
      initialEditableCredits
    ),
    [isSaving, setIsSaving] = useState(false),
    updateTrackMutation = useUpdateTrackMutation(trackId),
    preservedRows = partitionCollaborators(collaborators).preserved,
    // Only editor-managed rows participate in dirty tracking; other-role
    // collaborators are passed through untouched.
    isDirty =
      JSON.stringify(editableCredits) !==
      JSON.stringify(initialEditableCredits);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateTrackMutation.mutateAsync({
        collaborators: buildCollaboratorsPayload(
          editableCredits,
          preservedRows
        ),
      });
      await onSaved();
      toast({
        description: "Track credits were saved.",
        title: "Credits saved",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Could not save credits.",
        title: "Save failed",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <CreditsEditor onChange={setEditableCredits} value={editableCredits} />
      {preservedRows.length > 0 ? (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
          Other credited roles are preserved:{" "}
          {preservedRows
            .map(
              (collaborator) =>
                `${collaborator.name ?? collaborator.email ?? "Collaborator"} (${collaborator.role})`
            )
            .join(", ")}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          disabled={!isDirty || isSaving || updateTrackMutation.isPending}
          onClick={() => void handleSave()}
          type="button"
        >
          {isSaving ? (
            <>
              <LoaderCircle className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save credits"
          )}
        </Button>
      </div>
    </div>
  );
}

export function EditCreditsDialog({
  collaborators,
  onOpenChange,
  onSaved,
  open,
  trackId,
}: QuickActionDialogProps & { collaborators: TrackCollaboratorRow[] }) {
  const [isDirty, setIsDirty] = useState(false),
    requestClose = (nextOpen: boolean) => {
      if (
        !nextOpen &&
        isDirty &&
        !window.confirm("You have unsaved credit changes. Close anyway?")
      ) {
        return;
      }
      setIsDirty(false);
      onOpenChange(nextOpen);
    };

  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Edit credits
          </DialogTitle>
          <DialogDescription>
            Update writers, artists, producers, and splits. Changes apply once
            saved.
          </DialogDescription>
        </DialogHeader>
        <TrackCreditsEditor
          collaborators={collaborators}
          onDirtyChange={setIsDirty}
          onSaved={onSaved}
          trackId={trackId}
        />
      </DialogContent>
    </Dialog>
  );
}

interface MonetizeToggleSwitchProps {
  isPending?: boolean;
  isForSale: boolean;
  onToggle: (checked: boolean) => void | Promise<void>;
  payoutsReady: boolean;
}

interface TrackMonetizeToggleProps {
  /** Called after a successful PATCH so the page can refetch track data. */
  onToggled: () => unknown;
  isForSale: boolean;
  trackId: string;
}

/**
 * Self-contained monetization switch: reads seller Stripe status, PATCHes
 * `isForSale`, and disables itself (with an explanatory tooltip) until Stripe
 * payouts are connected.
 */
export function TrackMonetizeToggle({
  isForSale,
  onToggled,
  trackId,
}: TrackMonetizeToggleProps) {
  const sellerStatusQuery = useSellerStatusQuery(),
    payoutsReady = (sellerStatusQuery.data?.chargesEnabled ?? false) === true,
    updateTrackMutation = useUpdateTrackMutation(trackId),
    handleToggle = async (checked: boolean) => {
      try {
        await updateTrackMutation.mutateAsync({ isForSale: checked });
        await onToggled();
        toast({
          description: checked
            ? "This track is now listed for sale."
            : "This track is no longer for sale.",
          title: checked ? "Track monetized" : "Monetization disabled",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not update monetization.",
          title: "Update failed",
          variant: "destructive",
        });
      }
    };

  return (
    <MonetizeToggleSwitch
      isForSale={isForSale}
      isPending={updateTrackMutation.isPending}
      onToggle={handleToggle}
      payoutsReady={payoutsReady}
    />
  );
}

export function MonetizeToggleSwitch({
  isPending = false,
  isForSale,
  onToggle,
  payoutsReady,
}: MonetizeToggleSwitchProps) {
  const toggleControl = (
    <span className={payoutsReady ? undefined : "cursor-not-allowed"}>
      <Switch
        aria-label="Monetize this track"
        checked={isForSale}
        disabled={!payoutsReady || isPending}
        onCheckedChange={(checked) => void onToggle(checked)}
      />
    </span>
  );

  if (payoutsReady) {
    return (
      <div className="flex items-center gap-2">
        {toggleControl}
        <Label className="text-sm">Monetize</Label>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{toggleControl}</TooltipTrigger>
      <TooltipContent>
        Connect Stripe payouts before selling this track.
      </TooltipContent>
    </Tooltip>
  );
}

interface TrackCardQuickMenuItemsProps {
  onOpenAction: (action: "cover" | "credits" | "swap") => void;
  track: {
    id: string;
    isForSale?: boolean | null;
  };
}

/**
 * Quick-action entries for the track card dropdown menu. Menu items only
 * report the requested action — dialogs render OUTSIDE the dropdown (Radix
 * unmounts menu content on close, which would kill any dialog mounted here).
 */
export function TrackCardQuickMenuItems({
  onOpenAction,
  track,
}: TrackCardQuickMenuItemsProps) {
  const sellerStatusQuery = useSellerStatusQuery(),
    payoutsReady = (sellerStatusQuery.data?.chargesEnabled ?? false) === true,
    updateTrackMutation = useUpdateTrackMutation(track.id),
    handleMonetizeToggle = async () => {
      try {
        await updateTrackMutation.mutateAsync({
          isForSale: !track.isForSale,
        });
        toast({
          description: track.isForSale
            ? "This track is no longer for sale."
            : "This track is now listed for sale.",
          title: track.isForSale ? "Monetization disabled" : "Track monetized",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not update monetization.",
          title: "Update failed",
          variant: "destructive",
        });
      }
    };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onOpenAction("cover")}>
        <ImagePlus className="mr-2 size-4" />
        Change cover art
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onOpenAction("swap")}>
        <Repeat className="mr-2 size-4" />
        Swap main file
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onOpenAction("credits")}>
        <Users className="mr-2 size-4" />
        Edit credits
      </DropdownMenuItem>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          {/* Wrapper keeps the tooltip hoverable while the item is disabled. */}
          <div className="w-full">
            <DropdownMenuItem
              disabled={!payoutsReady || updateTrackMutation.isPending}
              onSelect={() => void handleMonetizeToggle()}
            >
              <DollarSign className="mr-2 size-4" />
              {track.isForSale ? "Disable monetization" : "Monetize"}
            </DropdownMenuItem>
          </div>
        </TooltipTrigger>
        {payoutsReady ? null : (
          <TooltipContent>
            Connect Stripe payouts before selling this track.
          </TooltipContent>
        )}
      </Tooltip>
    </>
  );
}

/**
 * Card-level quick action dialogs. Mounts only while an action is active so
 * the per-track detail query runs just for the open dialog.
 */
export function TrackCardQuickActionDialogs({
  action,
  onClose,
  trackId,
}: {
  action: "cover" | "credits" | "swap";
  onClose: () => void;
  trackId: string;
}) {
  const trackQuery = useTrackQuery(trackId),
    dialogCollaborators =
      trackQuery.data && "collaborators" in trackQuery.data
        ? (trackQuery.data.collaborators as TrackCollaboratorRow[])
        : [];

  return (
    <TrackQuickActionDialogs
      activeDialog={action}
      collaborators={dialogCollaborators}
      onClose={onClose}
      onSaved={() => void trackQuery.refetch()}
      trackId={trackId}
    />
  );
}
