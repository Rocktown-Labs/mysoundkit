"use client";
/* oxlint-disable complexity, no-alert, no-nested-ternary, no-void, one-var, react-hooks/exhaustive-deps, react/set-state-in-effect, react/todo, sort-vars */

import { useUploadFiles } from "@better-upload/client";
import { Calendar, FileAudio, LoaderCircle, Save, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiClient, rpcJson, TRACK_SOURCE_UPLOAD_URL } from "@/lib/api";
import {
  useGenresQuery,
  useProcessTrackMutation,
  useRetryTrackMediaProcessingMutation,
  useSellerStatusQuery,
  useUpdateTrackMutation,
} from "@/lib/soundkit-api-hooks";
import type { UpdateTrackBody } from "@/lib/soundkit-api-hooks";

const trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post,
  optionalAudioAssets = [
    {
      description: "Clean vocal tracks",
      kind: "vocal_stem",
      label: "Lead Vocals",
    },
    {
      description: "Background components",
      kind: "adlib",
      label: "Adlibs / FX",
    },
    {
      description: "Grouped production stems",
      kind: "stems",
      label: "Stems",
    },
    {
      description: "Alternate finished mix",
      kind: "alternate_mix",
      label: "Alternate Mix",
    },
    {
      description: "Clean/radio version",
      kind: "clean",
      label: "Clean Version",
    },
    {
      description: "Vocal-only export",
      kind: "verse_vocal",
      label: "Acapella",
    },
    {
      description: "DAW session archive",
      kind: "session_file",
      label: "Session File",
    },
    {
      description: "MIDI performance",
      kind: "midi",
      label: "MIDI",
    },
    {
      description: "Reference or demo audio",
      kind: "reference_audio",
      label: "Reference Audio",
    },
    {
      description: "Instrumental export",
      kind: "instrumental",
      label: "Instrumental",
    },
  ] as const;

type OptionalAudioAssetKind = (typeof optionalAudioAssets)[number]["kind"];
type AudioAssetKind = "master" | OptionalAudioAssetKind;
type TrackReleaseStatus = "draft" | "published" | "scheduled";
type TrackProductionStatus = "complete" | "demo" | "mastered" | "mixed";
type TrackListeningAccess = "premium_or_purchased" | "public";
type TrackPurchaseMode = "digital_download" | "license";

export interface TrackEditableRecord {
  description?: null | string;
  downloadsAllowed?: boolean;
  downloadsRequireFirstPlay?: boolean;
  downloadsRequirePurchase?: boolean;
  exclusiveUntil?: null | string;
  genre: string;
  isForSale: boolean;
  isPublic?: boolean;
  isrc?: null | string;
  listeningAccess?: TrackListeningAccess;
  musicalKey?: null | string;
  price?: null | number;
  productionStatus?: TrackProductionStatus;
  purchaseMode?: TrackPurchaseMode;
  releaseAt?: null | string;
  releaseStrategy: "private" | "publish_when_ready" | "scheduled";
  streamingLinks?: {
    appleMusic?: string;
    spotify?: string;
    youtube?: string;
  };
  title: string;
}

interface TrackDialogProps {
  onOpenChange: (open: boolean) => void;
  onSaved: () => unknown;
  open: boolean;
  trackId: string;
}

interface EditTrackDetailsDialogProps extends TrackDialogProps {
  mediaReady?: boolean;
  track: TrackEditableRecord | null;
}

export interface TrackAssetRecord {
  assetKind: string;
  isCurrent?: boolean;
  metadata?: unknown;
  objectKey?: null | string;
  status: string;
}

interface ManageTrackAudioDialogProps extends TrackDialogProps {
  assets: TrackAssetRecord[];
}

const toDateTimeInput = (value: null | string | undefined): string => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
  },
  toIsoDateOrEmpty = (value: string): string => {
    if (!value) {
      return "";
    }
    return new Date(value).toISOString();
  },
  cleanOptionalUrl = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  metadataFileName = (asset: TrackAssetRecord | undefined): string | null => {
    if (
      asset?.metadata &&
      typeof asset.metadata === "object" &&
      "originalFileName" in asset.metadata &&
      typeof asset.metadata.originalFileName === "string"
    ) {
      return asset.metadata.originalFileName;
    }
    return asset?.objectKey?.split("/").pop() ?? null;
  },
  releaseStatusFromTrack = (track: TrackEditableRecord): TrackReleaseStatus => {
    if (track.isPublic) {
      return "published";
    }
    return track.releaseStrategy === "scheduled" ? "scheduled" : "draft";
  };

const initialEditValues = (track: TrackEditableRecord) => ({
  appleMusic: track.streamingLinks?.appleMusic ?? "",
  description: track.description ?? "",
  downloadsAllowed: track.downloadsAllowed ?? true,
  downloadsRequireFirstPlay: track.downloadsRequireFirstPlay ?? false,
  downloadsRequirePurchase: track.downloadsRequirePurchase ?? false,
  exclusiveUntil: toDateTimeInput(track.exclusiveUntil),
  genre: track.genre,
  isForSale: track.isForSale,
  isrc: track.isrc ?? "",
  listeningAccess: track.listeningAccess ?? "public",
  musicalKey: track.musicalKey ?? "",
  price:
    track.price === null || track.price === undefined
      ? ""
      : String(track.price),
  productionStatus: track.productionStatus ?? "demo",
  purchaseMode: track.purchaseMode ?? "digital_download",
  releaseAt: toDateTimeInput(track.releaseAt),
  releaseStatus: releaseStatusFromTrack(track),
  spotify: track.streamingLinks?.spotify ?? "",
  title: track.title,
  youtube: track.streamingLinks?.youtube ?? "",
});

type EditTrackValues = ReturnType<typeof initialEditValues>;

export function EditTrackDetailsDialog({
  mediaReady = false,
  onOpenChange,
  onSaved,
  open,
  track,
  trackId,
}: EditTrackDetailsDialogProps) {
  const genresQuery = useGenresQuery(),
    sellerStatusQuery = useSellerStatusQuery(),
    updateTrackMutation = useUpdateTrackMutation(trackId),
    payoutsReady = sellerStatusQuery.data?.chargesEnabled === true,
    [values, setValues] = useState<EditTrackValues | null>(
      track ? initialEditValues(track) : null
    );

  useEffect(() => {
    if (open && track) {
      setValues(initialEditValues(track));
    }
  }, [open, track]);

  const updateValue = <K extends keyof EditTrackValues>(
      key: K,
      value: EditTrackValues[K]
    ) => {
      setValues((current) =>
        current ? { ...current, [key]: value } : current
      );
    },
    handleOpenChange = (nextOpen: boolean) => {
      if (!nextOpen) {
        onOpenChange(false);
      }
    },
    handleSave = async () => {
      if (!values || updateTrackMutation.isPending) {
        return;
      }
      if (values.title.trim().length < 1) {
        toast({
          description: "Add a title before saving.",
          title: "Title required",
          variant: "destructive",
        });
        return;
      }
      if (!values.genre) {
        toast({
          description: "Select a genre before saving.",
          title: "Genre required",
          variant: "destructive",
        });
        return;
      }
      if (values.releaseStatus === "scheduled" && !values.releaseAt) {
        toast({
          description: "Choose a release date for a scheduled track.",
          title: "Release date required",
          variant: "destructive",
        });
        return;
      }
      const isPublishing =
        values.releaseStatus === "published" && track?.isPublic !== true;
      if (isPublishing && !mediaReady) {
        toast({
          description: "Finish media processing before publishing this track.",
          title: "Playback media is not ready",
          variant: "destructive",
        });
        return;
      }

      const releasePayload =
          values.releaseStatus === "published"
            ? {
                isPublic: true,
                productionStatus: values.productionStatus,
                releaseAt: "",
                releaseStrategy: "publish_when_ready" as const,
              }
            : values.releaseStatus === "scheduled"
              ? {
                  isPublic: false,
                  productionStatus: values.productionStatus,
                  releaseAt: toIsoDateOrEmpty(values.releaseAt),
                  releaseStrategy: "scheduled" as const,
                }
              : {
                  isPublic: false,
                  productionStatus: values.productionStatus,
                  releaseAt: "",
                  releaseStrategy: "private" as const,
                },
        price = Number(values.price),
        payload: UpdateTrackBody = {
          description: values.description.trim(),
          downloadsAllowed: values.downloadsAllowed,
          downloadsRequireFirstPlay: values.downloadsRequirePurchase
            ? false
            : values.downloadsRequireFirstPlay,
          downloadsRequirePurchase: values.downloadsAllowed
            ? values.downloadsRequirePurchase
            : false,
          exclusiveUntil: values.exclusiveUntil
            ? toIsoDateOrEmpty(values.exclusiveUntil)
            : "",
          genre: values.genre,
          isForSale: values.isForSale,
          isrc: values.isrc.trim(),
          listeningAccess: values.listeningAccess,
          musicalKey: values.musicalKey.trim(),
          price: values.isForSale && Number.isFinite(price) ? price : undefined,
          priceCents:
            values.isForSale && Number.isFinite(price)
              ? Math.round(price * 100)
              : undefined,
          purchaseMode: values.purchaseMode,
          streamingLinks: {
            appleMusic: cleanOptionalUrl(values.appleMusic),
            spotify: cleanOptionalUrl(values.spotify),
            youtube: cleanOptionalUrl(values.youtube),
          },
          title: values.title.trim(),
          ...releasePayload,
        };

      try {
        await updateTrackMutation.mutateAsync(payload);
        await onSaved();
        toast({
          description: `“${values.title.trim()}” changes were saved.`,
          title: "Track updated",
        });
        onOpenChange(false);
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Could not update track.",
          title: "Track update failed",
          variant: "destructive",
        });
      }
    };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit track details</DialogTitle>
          <DialogDescription>
            Update the same metadata, release, access, sales, and platform-link
            settings available during track creation.
          </DialogDescription>
        </DialogHeader>
        {values ? (
          <div className="space-y-6">
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Track details</h3>
                <p className="text-xs text-muted-foreground">
                  Change the identity and catalog placement of this track.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="track-edit-title">Track name</Label>
                  <Input
                    id="track-edit-title"
                    onChange={(event) =>
                      updateValue("title", event.target.value)
                    }
                    value={values.title}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-edit-genre">Genre</Label>
                  <Select
                    onValueChange={(value) => updateValue("genre", value)}
                    value={values.genre}
                  >
                    <SelectTrigger id="track-edit-genre">
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {(genresQuery.data ?? []).map((genre) => (
                        <SelectItem key={genre.slug} value={genre.slug}>
                          {genre.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-edit-key">Musical key</Label>
                  <Input
                    id="track-edit-key"
                    onChange={(event) =>
                      updateValue("musicalKey", event.target.value)
                    }
                    placeholder="e.g. C minor"
                    value={values.musicalKey}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="track-edit-description">Description</Label>
                  <Textarea
                    id="track-edit-description"
                    onChange={(event) =>
                      updateValue("description", event.target.value)
                    }
                    placeholder="Tell the story behind this track..."
                    value={values.description}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-border/40 pt-5">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Calendar className="size-4 text-primary" />
                  Release settings
                </h3>
                <p className="text-xs text-muted-foreground">
                  Publish immediately, schedule a release, or return the track
                  to a private draft.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="track-edit-release-status">Visibility</Label>
                  <Select
                    onValueChange={(value: TrackReleaseStatus) =>
                      updateValue("releaseStatus", value)
                    }
                    value={values.releaseStatus}
                  >
                    <SelectTrigger id="track-edit-release-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft / unpublished</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="published">
                        Published / live
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-edit-production-status">
                    Production status
                  </Label>
                  <Select
                    onValueChange={(value: TrackProductionStatus) =>
                      updateValue("productionStatus", value)
                    }
                    value={values.productionStatus}
                  >
                    <SelectTrigger id="track-edit-production-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                      <SelectItem value="mastered">Mastered</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {values.releaseStatus === "scheduled" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="track-edit-release-date">
                      Release date and time
                    </Label>
                    <Input
                      id="track-edit-release-date"
                      onChange={(event) =>
                        updateValue("releaseAt", event.target.value)
                      }
                      type="datetime-local"
                      value={values.releaseAt}
                    />
                  </div>
                ) : null}
              </div>
            </section>

            <section className="space-y-4 border-t border-border/40 pt-5">
              <div>
                <h3 className="font-semibold">Access and downloads</h3>
                <p className="text-xs text-muted-foreground">
                  Control who can stream and download this track.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="track-edit-listening-access">
                    Streaming access
                  </Label>
                  <Select
                    onValueChange={(value: TrackListeningAccess) =>
                      updateValue("listeningAccess", value)
                    }
                    value={values.listeningAccess}
                  >
                    <SelectTrigger id="track-edit-listening-access">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public listening</SelectItem>
                      <SelectItem value="premium_or_purchased">
                        Premium members or purchasers
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-edit-exclusive-until">
                    Exclusive until
                  </Label>
                  <Input
                    id="track-edit-exclusive-until"
                    onChange={(event) =>
                      updateValue("exclusiveUntil", event.target.value)
                    }
                    type="datetime-local"
                    value={values.exclusiveUntil}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <SettingSwitch
                  checked={values.downloadsAllowed}
                  description="Include downloadable files when a listener has access."
                  label="Allow downloads"
                  onCheckedChange={(checked) => {
                    updateValue("downloadsAllowed", checked);
                    if (!checked) {
                      updateValue("downloadsRequireFirstPlay", false);
                      updateValue("downloadsRequirePurchase", false);
                    }
                  }}
                />
                <SettingSwitch
                  checked={values.downloadsRequirePurchase}
                  description="Only buyers can download included files."
                  disabled={!values.downloadsAllowed}
                  label="Require purchase"
                  onCheckedChange={(checked) => {
                    updateValue("downloadsRequirePurchase", checked);
                    if (checked) {
                      updateValue("isForSale", true);
                      updateValue("downloadsRequireFirstPlay", false);
                    }
                  }}
                />
                <SettingSwitch
                  checked={values.downloadsRequireFirstPlay}
                  description="Require one play before a free download unlocks."
                  disabled={
                    !values.downloadsAllowed || values.downloadsRequirePurchase
                  }
                  label="Require one play first"
                  onCheckedChange={(checked) =>
                    updateValue("downloadsRequireFirstPlay", checked)
                  }
                />
              </div>
            </section>

            <section className="space-y-4 border-t border-border/40 pt-5">
              <div>
                <h3 className="font-semibold">Sales</h3>
                <p className="text-xs text-muted-foreground">
                  Set the purchase behavior used by this single.
                </p>
              </div>
              <SettingSwitch
                checked={values.isForSale}
                description={
                  payoutsReady
                    ? "Allow fans to purchase this track."
                    : "Connect Stripe payouts before enabling sales."
                }
                disabled={!payoutsReady && !values.isForSale}
                label="List this track for sale"
                onCheckedChange={(checked) => {
                  updateValue("isForSale", checked);
                  if (!checked) {
                    updateValue("downloadsRequirePurchase", false);
                  }
                }}
              />
              {values.isForSale ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="track-edit-price">Price (USD)</Label>
                    <Input
                      id="track-edit-price"
                      min="0"
                      onChange={(event) =>
                        updateValue("price", event.target.value)
                      }
                      step="0.01"
                      type="number"
                      value={values.price}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="track-edit-purchase-mode">
                      Purchase mode
                    </Label>
                    <Select
                      onValueChange={(value: TrackPurchaseMode) =>
                        updateValue("purchaseMode", value)
                      }
                      value={values.purchaseMode}
                    >
                      <SelectTrigger id="track-edit-purchase-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="digital_download">
                          Digital download
                        </SelectItem>
                        <SelectItem value="license">License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-4 border-t border-border/40 pt-5">
              <div>
                <h3 className="font-semibold">Release identifiers and links</h3>
                <p className="text-xs text-muted-foreground">
                  Keep catalog identifiers and external streaming pages current.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="track-edit-isrc">ISRC</Label>
                  <Input
                    id="track-edit-isrc"
                    onChange={(event) =>
                      updateValue("isrc", event.target.value)
                    }
                    placeholder="US-XXX-26-00001"
                    value={values.isrc}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-edit-spotify">Spotify URL</Label>
                  <Input
                    id="track-edit-spotify"
                    onChange={(event) =>
                      updateValue("spotify", event.target.value)
                    }
                    placeholder="https://open.spotify.com/track/..."
                    value={values.spotify}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-edit-apple">Apple Music URL</Label>
                  <Input
                    id="track-edit-apple"
                    onChange={(event) =>
                      updateValue("appleMusic", event.target.value)
                    }
                    placeholder="https://music.apple.com/..."
                    value={values.appleMusic}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-edit-youtube">YouTube URL</Label>
                  <Input
                    id="track-edit-youtube"
                    onChange={(event) =>
                      updateValue("youtube", event.target.value)
                    }
                    placeholder="https://youtube.com/watch?v=..."
                    value={values.youtube}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!values || updateTrackMutation.isPending}
            onClick={() => void handleSave()}
          >
            {updateTrackMutation.isPending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {updateTrackMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingSwitch({
  checked,
  description,
  disabled = false,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 p-3">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function ManageTrackAudioDialog({
  assets,
  onOpenChange,
  onSaved,
  open,
  trackId,
}: ManageTrackAudioDialogProps) {
  const { isPending: isUploading, uploadAsync } = useUploadFiles({
      api: TRACK_SOURCE_UPLOAD_URL,
      credentials: "include",
      route: "track-source",
    }),
    [selectedKind, setSelectedKind] = useState<AudioAssetKind>("master"),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [isSaving, setIsSaving] = useState(false),
    currentAsset = assets.find(
      (asset) =>
        asset.assetKind === selectedKind &&
        asset.isCurrent !== false &&
        asset.status !== "deleted"
    ),
    selectedLabel =
      selectedKind === "master"
        ? "Main master"
        : (optionalAudioAssets.find((asset) => asset.kind === selectedKind)
            ?.label ?? "Audio file"),
    selectedDescription =
      selectedKind === "master"
        ? "The source used to regenerate playback, battle, downloads, and enrichment."
        : (optionalAudioAssets.find((asset) => asset.kind === selectedKind)
            ?.description ?? "Optional track component."),
    requestClose = (nextOpen: boolean) => {
      if (
        !nextOpen &&
        (selectedFile || isSaving || isUploading) &&
        !window.confirm("You have an unsaved audio file. Close without saving?")
      ) {
        return;
      }
      if (!nextOpen) {
        setSelectedFile(null);
      }
      onOpenChange(nextOpen);
    },
    handleSave = async () => {
      if (!selectedFile || isSaving) {
        return;
      }
      setIsSaving(true);
      try {
        const uploadResult = await uploadAsync([selectedFile], {
            metadata: { trackId },
          }),
          uploaded = uploadResult.files.find(
            (entry) =>
              (entry.raw && entry.raw === selectedFile) ||
              entry.name === selectedFile.name
          );
        if (!uploaded) {
          throw new Error(
            uploadResult.failedFiles[0]?.error?.message ??
              "The audio file could not be uploaded."
          );
        }

        await rpcJson(
          await trackAssetPost({
            json: {
              assetKind: selectedKind,
              metadata: { originalFileName: selectedFile.name },
              mimeType: selectedFile.type || "application/octet-stream",
              objectKey: uploaded.objectInfo.key,
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
            selectedKind === "master"
              ? "The master was replaced and media processing restarted."
              : `${selectedLabel} was added to this track.`,
          title:
            selectedKind === "master" ? "Master replaced" : "Audio file saved",
        });
        setSelectedFile(null);
        onOpenChange(false);
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not save audio file.",
          title: "Audio update failed",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    };

  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage audio files</DialogTitle>
          <DialogDescription>
            Replace the master or add/replace any optional component from the
            track creation workflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="track-audio-kind">Audio file type</Label>
            <Select
              onValueChange={(value: AudioAssetKind) => {
                setSelectedKind(value);
                setSelectedFile(null);
              }}
              value={selectedKind}
            >
              <SelectTrigger id="track-audio-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="master">Main master</SelectItem>
                {optionalAudioAssets.map((asset) => (
                  <SelectItem key={asset.kind} value={asset.kind}>
                    {asset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-sm">
            <p className="font-medium">{selectedLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentAsset
                ? `Current: ${metadataFileName(currentAsset) ?? "stored file"}`
                : "No current file saved for this type."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedDescription}
            </p>
          </div>
          {selectedFile ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <FileAudio className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <Button
                onClick={() => setSelectedFile(null)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Change
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-muted/20 p-8 text-center text-sm text-muted-foreground hover:border-primary/50">
              <Upload className="size-6 text-primary" />
              Choose a WAV, MP3, AIFF, FLAC, ZIP, or MIDI file
              <input
                accept=".wav,.mp3,.aiff,.flac,.m4a,.zip,.rar,.tar,.mid,.midi"
                className="sr-only"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                type="file"
              />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => requestClose(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!selectedFile || isSaving || isUploading}
            onClick={() => void handleSave()}
          >
            {isSaving || isUploading ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {isSaving || isUploading ? "Uploading..." : "Save audio file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RetryTrackMediaDialog({
  onOpenChange,
  onSaved,
  open,
  trackId,
}: TrackDialogProps) {
  const retryMutation = useRetryTrackMediaProcessingMutation(trackId),
    handleRetry = async () => {
      try {
        await retryMutation.mutateAsync();
        await onSaved();
        toast({
          description: "The current master will be processed again.",
          title: "Processing restarted",
        });
        onOpenChange(false);
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not restart processing.",
          title: "Retry failed",
          variant: "destructive",
        });
      }
    };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retry media processing</DialogTitle>
          <DialogDescription>
            Rebuild the streaming derivative from the current master. If the
            source master is missing, replace it from Manage audio files first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={retryMutation.isPending}
            onClick={() => void handleRetry()}
          >
            {retryMutation.isPending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : null}
            {retryMutation.isPending ? "Restarting..." : "Retry processing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProcessTrackEnrichmentDialog({
  onOpenChange,
  onSaved,
  open,
  trackId,
}: TrackDialogProps) {
  const processMutation = useProcessTrackMutation(trackId),
    handleProcess = async () => {
      try {
        const result = await processMutation.mutateAsync();
        await onSaved();
        toast({
          description: result.message,
          title:
            result.status === "failed"
              ? "Processing unavailable"
              : "Lyrics and stems queued",
          variant: result.status === "failed" ? "destructive" : "default",
        });
        if (result.status !== "failed") {
          onOpenChange(false);
        }
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not start lyrics and stem processing.",
          title: "Processing failed",
          variant: "destructive",
        });
      }
    };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate lyrics and stems</DialogTitle>
          <DialogDescription>
            Start the Premium enrichment workflow for this track. This uses the
            current master to generate stems and timed lyrics.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={processMutation.isPending}
            onClick={() => void handleProcess()}
          >
            {processMutation.isPending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : null}
            {processMutation.isPending ? "Starting..." : "Start processing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
