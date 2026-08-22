"use client";
/* eslint-disable complexity, no-nested-ternary, no-promise-executor-return, no-unused-vars, no-use-before-define, react-hooks/exhaustive-deps, react-perf/jsx-no-new-function-as-prop, react/jsx-handler-names, react/no-array-index-key, no-empty-function, promise/avoid-new, promise/param-names, promise/prefer-await-to-then, require-await, require-unicode-regexp, sort-vars, one-var, unicorn/consistent-function-scoping, prefer-destructuring, func-names */

import { useUploadFiles } from "@better-upload/client";
import { usePostHog } from "@posthog/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  DollarSign,
  FileAudio,
  Info,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import * as z from "zod";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { CreditsEditor } from "@/components/dashboard/credits-editor";
import { FileUploadZone } from "@/components/dashboard/file-upload-zone";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormDraftGuard } from "@/hooks/use-form-draft-guard";
import { toast } from "@/hooks/use-toast";
import {
  apiClient,
  API_V1_URL,
  MEDIA_UPLOAD_URL,
  MEDIA_BASE_URL,
  rpcJson,
  TRACK_SOURCE_UPLOAD_URL,
} from "@/lib/api";
import { createAudioPreviewFile } from "@/lib/audio-preview";
import { optimizeCoverImageFile } from "@/lib/image-processing";
import { readAudioDurationMs } from "@/lib/media-duration";
import {
  soundkitQueryKeys,
  useCreateTrackMutation,
  useGenresQuery,
  useMeEntitlementsQuery,
  useSellerStatusQuery,
  useSettleTrackMutation,
  useUpdateTrackMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  MediaProcessingStatus,
  UpdateTrackBody,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";
import { zodResolver } from "@/lib/zod-resolver";

const OPTIONAL_COMPONENTS = [
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
    { description: "Grouped production stems", kind: "stems", label: "Stems" },
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
    { description: "MIDI performance", kind: "midi", label: "MIDI" },
    {
      description: "Reference or demo audio",
      kind: "reference_audio",
      label: "Reference Audio",
    },
  ] as const,
  SUPPORTED_GENRES = [
    "Afrobeats",
    "Electronic",
    "Hip-Hop/Rap",
    "Jazz",
    "Latin",
    "Pop",
    "R&B/Soul",
    "Rock",
    "Spoken Word",
  ] as const,
  trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post,
  trackMediaProcessingGet = apiClient.v1.tracks[":trackId"].processing.$get,
  trackGet = apiClient.v1.tracks[":trackId"].$get,
  SINGLE_PRICE_USD = 1.29,
  PROCESSING_POLL_INTERVAL_MS = 2000,
  PROCESSING_BLOCKING_TIMEOUT_MS = 15 * 60 * 1000,
  PROCESSING_STAGE_LABELS: Record<string, string> = {
    analyzing_loudness: "Analyzing audio",
    generating_battle: "Preparing battle audio",
    generating_download: "Preparing download",
    generating_lossless: "Preparing lossless audio",
    generating_open_verse_snippet: "Preparing Open Verse audio",
    generating_streaming: "Preparing SoundKit stream",
    media_ready: "SoundKit stream ready",
    queued: "Waiting for media processor",
    registering_battle: "Finalizing battle audio",
    registering_download: "Finalizing download",
    registering_lossless: "Finalizing lossless audio",
    registering_streaming: "Finalizing SoundKit stream",
    verifying_master: "Verifying original master",
  };

type OptionalComponentKind = (typeof OPTIONAL_COMPONENTS)[number]["kind"];

const exclusiveUntilForApi = (
    value: string | undefined,
    preserveEmpty = false
  ) => {
    if (!value) {
      return preserveEmpty ? "" : undefined;
    }

    return new Date(value).toISOString();
  },
  exclusiveUntilForInput = (value: unknown) => {
    if (typeof value !== "string" || !value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const pad = (part: number) => part.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
  creditRoleSchema = z.enum(["artist", "songwriter", "producer"]),
  creditEntrySchema = z.object({
    alsoCreditAsWriter: z.boolean().optional(),
    displayName: z.string().min(1),
    inviteEmail: z.string().email().optional(),
    role: creditRoleSchema,
    splitBps: z.number().int().min(0).max(10_000).optional(),
    userId: z.string().optional(),
  }),
  trackFormSchema = z.object({
    coverObjectKey: z.string().optional(),
    credits: z.array(creditEntrySchema).default([]),
    description: z.string().optional(),
    downloadsAllowed: z.boolean().default(true),
    downloadsRequireFirstPlay: z.boolean().default(false),
    downloadsRequirePurchase: z.boolean().default(true),
    enrichLyrics: z.boolean().default(false),
    exclusiveUntil: z.string().optional(),
    genre: z.string().min(1, "Genre is required"),
    isForSale: z.boolean().default(false),
    isrc: z.string().optional(),
    key: z.string().optional(),
    listeningAccess: z
      .enum(["public", "premium_or_purchased"])
      .default("public"),
    name: z.string().min(2, "Track name is required"),
    releaseAt: z.string().optional(),
    rightsAccepted: z
      .boolean()
      .refine(
        (value) => value,
        "Confirm you have the rights to upload this track"
      ),
    /** draft = private, ready = live */
    status: z.enum(["draft", "ready"]).default("draft"),
    streamingAppleMusic: z.string().optional(),
    streamingSpotify: z.string().optional(),
    streamingYoutube: z.string().optional(),
  });

type TrackFormValues = z.infer<typeof trackFormSchema>;

// Released tracks lock genre/status in the UI, so their edit-time validation
// must not require those fields to pass before other changes can be saved.
const releasedTrackFormSchema = trackFormSchema.extend({
  genre: z.string(),
});
interface GenreOption {
  name: string;
}

const isGenreOption = (value: unknown): value is GenreOption =>
    Boolean(
      value &&
      typeof value === "object" &&
      "name" in value &&
      typeof value.name === "string"
    ),
  mapStatusToRelease = (
    status: TrackFormValues["status"],
    releaseAt?: string
  ) => {
    const hasScheduledDate = Boolean(releaseAt && releaseAt.trim().length > 0),
      releaseStrategy = hasScheduledDate
        ? ("scheduled" as const)
        : ("publish_when_ready" as const);

    if (status === "ready") {
      return {
        isOpenVerse: false,
        isPublic: true,
        productionStatus: "complete" as const,
        releaseStrategy,
      };
    }
    return {
      isOpenVerse: false,
      isPublic: false,
      productionStatus: "demo" as const,
      releaseStrategy: "private" as const,
    };
  },
  defaultTrackFormValues: TrackFormValues = {
    coverObjectKey: "",
    credits: [],
    description: "",
    downloadsAllowed: true,
    downloadsRequireFirstPlay: true,
    downloadsRequirePurchase: false,
    enrichLyrics: false,
    exclusiveUntil: "",
    genre: "Hip-Hop/Rap",
    isForSale: false,
    isrc: "",
    key: "",
    listeningAccess: "public",
    name: "",
    releaseAt: "",
    rightsAccepted: false,
    status: "draft",
    streamingAppleMusic: "",
    streamingSpotify: "",
    streamingYoutube: "",
  };

interface UploadedTrackPreview {
  assetId: string;
  durationMs?: number | null;
  objectKey: string;
  remoteUrl: string;
  statusMessage: string;
  title: string;
  trackId: string;
}

interface UploadedAssetPreview {
  fileName: string;
  objectKey: string;
  remoteUrl: string;
}

interface NewTrackFormProps {
  initialTrack?: Record<string, unknown> | null;
  trackId?: string;
}

const waitForTrackMedia = async ({
  onStatus,
  trackId,
}: {
  onStatus: (status: MediaProcessingStatus) => void;
  trackId: string;
}): Promise<{ status: MediaProcessingStatus; timedOut: boolean }> => {
  const startedAt = Date.now();
  while (true) {
    const status = await rpcJson(
      await trackMediaProcessingGet({ param: { trackId } })
    );
    onStatus(status);
    if (status.mediaReady || status.status === "failed") {
      return { status, timedOut: false };
    }
    if (Date.now() - startedAt >= PROCESSING_BLOCKING_TIMEOUT_MS) {
      return { status, timedOut: true };
    }
    await new Promise((resolve) =>
      setTimeout(resolve, PROCESSING_POLL_INTERVAL_MS)
    );
  }
};

export function NewTrackForm({
  initialTrack,
  trackId,
}: NewTrackFormProps = {}) {
  const posthog = usePostHog(),
    queryClient = useQueryClient(),
    router = useRouter(),
    genresQuery = useGenresQuery(),
    genreRows = Array.isArray(genresQuery.data)
      ? genresQuery.data.filter(isGenreOption)
      : [],
    availableGenres =
      genreRows.length > 0
        ? genreRows.map((genre) => genre.name)
        : SUPPORTED_GENRES,
    { currentTrack, isPlaying, togglePlay, setCurrentTrack, setQueue } =
      useAudioPlayer(),
    isReleasedTrack = Boolean(
      initialTrack &&
      (initialTrack.isPublic === true ||
        Number(initialTrack.playCount ?? initialTrack.plays ?? 0) > 0)
    ),
    [step, setStep] = useState("details"),
    [isSubmitting, setIsSubmitting] = useState(false),
    isSubmittingRef = useRef(false),
    [submitStage, setSubmitStage] = useState<
      | "idle"
      | "preparing"
      | "uploading"
      | "finalizing_upload"
      | "settling"
      | "processing"
      | "settled"
      | "error"
    >("idle"),
    [submitProgress, setSubmitProgress] = useState(0),
    [processingStatus, setProcessingStatus] =
      useState<MediaProcessingStatus | null>(null),
    [createdTrackInfo, setCreatedTrackInfo] = useState<{
      audioFileName?: string;
      audioFileSize?: string;
      coverUrl?: string;
      genre: string;
      id: string;
      isPublic: boolean;
      playbackUrl?: string;
      status: string;
      title: string;
    } | null>(null),
    [isSavingChanges, setIsSavingChanges] = useState(false),
    initialValuesRef = useRef<TrackFormValues | null>(null),
    [coverUpload, setCoverUpload] = useState<UploadedAssetPreview | null>(null),
    coverUploadRef = useRef<UploadedAssetPreview | null>(null),
    [uploadedTrack, setUploadedTrack] = useState<UploadedTrackPreview | null>(
      null
    ),
    [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null),
    [selectedMasterFile, setSelectedMasterFile] = useState<File | null>(null),
    [selectedMasterDurationMs, setSelectedMasterDurationMs] = useState<
      number | null
    >(null),
    [instrumentalFile, setInstrumentalFile] = useState<File | null>(null),
    [enabledComponents, setEnabledComponents] = useState<
      OptionalComponentKind[]
    >([]),
    [componentFiles, setComponentFiles] = useState<
      Partial<Record<OptionalComponentKind, File>>
    >({}),
    [restoredComponents, setRestoredComponents] = useState<
      Partial<Record<OptionalComponentKind, { name: string }>>
    >({}),
    pendingMasterTrackRef = useRef<{
      id: string;
      title: string;
    } | null>(null),
    createTrackMutation = useCreateTrackMutation(),
    settleTrackMutation = useSettleTrackMutation(),
    updateTrackMutation = useUpdateTrackMutation(trackId ?? ""),
    entitlementsQuery = useMeEntitlementsQuery(),
    isPremiumArtist = entitlementsQuery.data?.isPremium === true,
    sellerStatusQuery = useSellerStatusQuery(),
    payoutsReady = (sellerStatusQuery.data?.chargesEnabled ?? false) === true,
    form = useForm<TrackFormValues>({
      defaultValues: defaultTrackFormValues,
      resolver: zodResolver(
        isReleasedTrack ? releasedTrackFormSchema : trackFormSchema
      ),
    });

  // Prefill when editing an existing track
  useEffect(() => {
    if (!initialTrack) {
      return;
    }
    const isPublic = Boolean(initialTrack.isPublic),
      isForSale = Boolean(initialTrack.isForSale),
      rawCollaborators = Array.isArray(initialTrack.collaborators)
        ? (initialTrack.collaborators as Record<string, unknown>[])
        : [],
      assets = Array.isArray(initialTrack.assets)
        ? (initialTrack.assets as Record<string, unknown>[])
        : [],
      coverAsset = assets.find((asset) => asset.assetKind === "cover_art"),
      coverObjectKey =
        (coverAsset?.objectKey as string) ||
        (initialTrack.coverArtUrl as string);

    form.reset({
      coverObjectKey: coverObjectKey ?? "",
      credits: rawCollaborators.map((c) => ({
        displayName:
          (c.name as string) || (c.displayName as string) || "Collaborator",
        inviteEmail:
          (c.email as string) || (c.inviteEmail as string) || undefined,
        role: (c.role as "songwriter" | "producer") || "songwriter",
        userId: (c.userId as string) || undefined,
      })),
      description: (initialTrack.description as string) ?? "",
      downloadsAllowed: initialTrack.downloadsAllowed !== false,
      downloadsRequireFirstPlay:
        initialTrack.downloadsRequireFirstPlay !== false,
      downloadsRequirePurchase: Boolean(initialTrack.downloadsRequirePurchase),
      exclusiveUntil: exclusiveUntilForInput(initialTrack.exclusiveUntil),
      genre: (initialTrack.genre as string) ?? "",
      isForSale,
      isrc: (initialTrack.isrc as string) ?? "",
      key: (initialTrack.musicalKey as string) ?? "",
      listeningAccess:
        initialTrack.listeningAccess === "premium_or_purchased"
          ? "premium_or_purchased"
          : "public",
      name: (initialTrack.title as string) ?? "",
      releaseAt: (initialTrack.releaseAt as string) ?? "",
      rightsAccepted: true,
      status: isPublic ? "ready" : "draft",
      streamingAppleMusic:
        ((initialTrack.streamingLinks as Record<string, string>)
          ?.appleMusic as string) ?? "",
      streamingSpotify:
        ((initialTrack.streamingLinks as Record<string, string>)
          ?.spotify as string) ?? "",
      streamingYoutube:
        ((initialTrack.streamingLinks as Record<string, string>)
          ?.youtube as string) ?? "",
    });
    // Snapshot for dirty-only "Save changes" payloads in edit mode.
    initialValuesRef.current = form.getValues();

    if (initialTrack.coverArtUrl) {
      const restoredCover = {
        fileName: `${(initialTrack.title as string) || "track"}-cover.jpg`,
        objectKey: coverObjectKey ?? "",
        remoteUrl: initialTrack.coverArtUrl as string,
      };
      coverUploadRef.current = restoredCover;
      setCoverUpload(restoredCover);
    }

    const restoredAssetRows = assets.filter((asset) =>
      OPTIONAL_COMPONENTS.some(
        (component) => component.kind === asset.assetKind
      )
    );
    setEnabledComponents(
      restoredAssetRows.map((asset) => asset.assetKind as OptionalComponentKind)
    );
    setRestoredComponents(
      Object.fromEntries(
        restoredAssetRows.map((asset) => [
          asset.assetKind,
          {
            name:
              ((asset.metadata as Record<string, unknown> | null)
                ?.originalFileName as string) ||
              (asset.objectKey as string) ||
              asset.assetKind,
          },
        ])
      ) as Partial<Record<OptionalComponentKind, { name: string }>>
    );

    if (initialTrack.playbackUrl) {
      setUploadedTrack({
        assetId: (initialTrack.id as string) ?? "",
        objectKey: initialTrack.playbackUrl as string,
        remoteUrl: initialTrack.playbackUrl as string,
        statusMessage: "Loaded existing track audio master.",
        title: (initialTrack.title as string) ?? "",
        trackId: (initialTrack.id as string) ?? "",
      });
    }
  }, [initialTrack, form]);

  const handleBatchFileUpload = (files: FileList | File[]) => {
      const fileList = [...files];
      let coverFound = false,
        masterFound = false,
        stemsFound = false;

      for (const file of fileList) {
        if (file.type.startsWith("image/") && !coverFound) {
          setSelectedCoverFile(file);
          coverFound = true;
        } else if (
          (file.type.startsWith("audio/") ||
            file.name.endsWith(".wav") ||
            file.name.endsWith(".mp3") ||
            file.name.endsWith(".aiff") ||
            file.name.endsWith(".flac")) &&
          !masterFound
        ) {
          setSelectedMasterFile(file);
          void readAudioDurationMs(file).then(setSelectedMasterDurationMs);
          masterFound = true;
          if (!form.getValues("name")) {
            const cleanName = file.name
              .replace(/\.[^/.]+$/, "")
              .replaceAll(/[-_]/g, " ");
            form.setValue("name", cleanName, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        } else if (
          file.name.endsWith(".zip") ||
          file.name.toLowerCase().includes("stem")
        ) {
          setInstrumentalFile(file);
          stemsFound = true;
        }
      }

      if (masterFound || coverFound || stemsFound) {
        const attached = [
          masterFound && "Master Audio",
          coverFound && "Cover Artwork",
          stemsFound && "Stems Archive",
        ]
          .filter(Boolean)
          .join(", ");
        toast({
          description: `Attached ${attached} to your track setup.`,
          title: "Files Auto-Assigned",
        });
      }
    },
    { allowNavigation, blockerDialog, clearDraft, hasSavedDraft, resetDraft } =
      useFormDraftGuard({
        additionalDirtyState: Boolean(
          selectedCoverFile ||
          selectedMasterFile ||
          instrumentalFile ||
          Object.keys(componentFiles).length > 0 ||
          uploadedTrack
        ),
        defaultValues: defaultTrackFormValues,
        form,
        onDiscard: async () => {
          if (!(uploadedTrack?.trackId && !initialTrack)) {
            return;
          }
          await fetch(
            `${API_V1_URL}/tracks/${encodeURIComponent(uploadedTrack.trackId)}`,
            { credentials: "include", method: "DELETE" }
          );
        },
        persist: false,
        restoreOnMount: false,
        storageKey: "soundkit:new-track-draft",
      }),
    clearTrackMediaState = () => {
      setSelectedCoverFile(null);
      setSelectedMasterFile(null);
      setSelectedMasterDurationMs(null);
      setInstrumentalFile(null);
      setEnabledComponents([]);
      setComponentFiles({});
      setRestoredComponents({});
      setCoverUpload(null);
      coverUploadRef.current = null;
      pendingMasterTrackRef.current = null;
      setUploadedTrack(null);
      try {
        window.localStorage.removeItem("soundkit:new-track-draft:meta");
      } catch {
        // Ignore
      }
    },
    resetTrackDraft = () => {
      resetDraft();
      clearTrackMediaState();
      toast({
        description: "Track draft cleared. You can start fresh.",
        title: "Draft reset",
      });
    },
    {
      averageProgress: masterAverageProgress,
      isPending: isMasterUploading,
      progresses: masterProgresses,
      uploadAsync: uploadMasterAsync,
    } = useUploadFiles({
      api: TRACK_SOURCE_UPLOAD_URL,
      credentials: "include",
      onError: (uploadError) => {
        posthog.captureException(uploadError);
      },
      route: "track-source",
    }),
    {
      averageProgress: componentsProgress,
      isPending: isComponentsUploading,
      progresses: componentsProgresses,
      uploadAsync: uploadComponentsAsync,
    } = useUploadFiles({
      api: TRACK_SOURCE_UPLOAD_URL,
      credentials: "include",
      onError: (uploadError) => {
        posthog.captureException(uploadError);
      },
      route: "track-source",
    }),
    {
      averageProgress: coverProgress,
      isPending: isCoverUploading,
      progresses: coverProgresses,
      uploadAsync: uploadCoverAsync,
    } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      onError: (uploadError) => {
        posthog.captureException(uploadError);
      },
      route: "media",
    }),
    masterProgressEntry = masterProgresses.find(
      (entry) =>
        (entry.raw && entry.raw === selectedMasterFile) ||
        (!entry.name.endsWith(".preview.wav") &&
          entry.name === selectedMasterFile?.name) ||
        !entry.name.endsWith(".preview.wav")
    ),
    masterUploadPercent = masterProgressEntry
      ? Math.round(masterProgressEntry.progress * 100)
      : Math.round(masterAverageProgress * 100),
    handleCoverUpload = async (files: FileList) => {
      const [file] = [...files];

      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast({
          description: "Select a JPG or PNG cover image.",
          title: "Invalid cover image",
          variant: "destructive",
        });
        return;
      }

      setSelectedCoverFile(await optimizeCoverImageFile(file));
    },
    handleMasterUpload = async (files: FileList) => {
      const [file] = [...files];

      if (!file) {
        return;
      }

      setSelectedMasterFile(file);
      setSelectedMasterDurationMs(await readAudioDurationMs(file));
    },
    handleSaveTrackDraft = async () => {
      const values = form.getValues();

      if (values.name.trim().length < 2) {
        toast({
          description: "Add a track title before saving a draft.",
          title: "Track title required",
          variant: "destructive",
        });
        return;
      }

      if (!values.genre) {
        toast({
          description: "Select a genre before saving a draft.",
          title: "Genre required",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);
      setSubmitStage("preparing");
      setSubmitProgress(30);

      try {
        await createTrackMutation.mutateAsync({
          assetIds: [],
          catalogItemType: "single",
          collaborators: values.credits.map((credit) => ({
            alsoCreditAsWriter: credit.alsoCreditAsWriter,
            inviteEmail: credit.inviteEmail,
            name: credit.displayName,
            role: credit.role,
            splitBps: credit.splitBps,
            userId: credit.userId,
          })),
          description: values.description || undefined,
          downloadsAllowed: values.downloadsAllowed,
          downloadsRequireFirstPlay: values.downloadsRequireFirstPlay,
          downloadsRequirePurchase: values.downloadsRequirePurchase,
          exclusiveUntil: exclusiveUntilForApi(values.exclusiveUntil),
          genre: values.genre,
          isForSale: false,
          isOpenVerse: false,
          isPublic: false,
          isrc: values.isrc || undefined,
          listeningAccess: values.listeningAccess,
          musicalKey: values.key || undefined,
          productionStatus: "demo",
          purchaseMode: "digital_download",
          releaseStrategy: "private",
          streamingLinks: {
            appleMusic: values.streamingAppleMusic || undefined,
            spotify: values.streamingSpotify || undefined,
            youtube: values.streamingYoutube || undefined,
          },
          title: values.name,
        });
        clearDraft();
        allowNavigation();
        toast({
          description:
            selectedMasterFile || selectedCoverFile
              ? "Metadata saved. Staged files will upload when you complete the track."
              : "Track draft saved.",
          title: "Draft saved",
        });
        router.navigate({ to: "/dashboard/tracks" });
      } catch (error) {
        posthog.captureException(error);
        toast({
          description:
            error instanceof Error ? error.message : "Failed to save draft.",
          title: "Draft save failed",
          variant: "destructive",
        });
        setSubmitStage("idle");
        setIsSubmitting(false);
      }
    },
    handleInvalidSubmit = (errors: FieldErrors<TrackFormValues>) => {
      const firstError = Object.keys(errors)[0];
      if (
        firstError === "genre" ||
        firstError === "name" ||
        firstError === "status"
      ) {
        setStep("details");
      }
      toast({
        description: "Review the highlighted fields before continuing.",
        title: "Track setup incomplete",
        variant: "destructive",
      });
    },
    onSubmit = async (values: TrackFormValues) => {
      if (isSubmittingRef.current) {
        return;
      }
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      // Edit Mode submission
      if (trackId && initialTrack) {
        try {
          setSubmitStage("uploading");
          let coverKey = values.coverObjectKey;
          if (selectedCoverFile) {
            const optimizedCover = await optimizeCoverImageFile(
              selectedCoverFile
            ).catch(() => selectedCoverFile);
            const coverResult = await uploadCoverAsync([optimizedCover]);
            const uploadedCover = coverResult.files[0];
            if (uploadedCover) {
              coverKey = uploadedCover.objectInfo.key;
              await rpcJson(
                await trackAssetPost({
                  json: {
                    assetKind: "cover_art",
                    metadata: {
                      originalFileName: selectedCoverFile.name,
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
            }
          }

          setSubmitStage("settling");
          const release = mapStatusToRelease(values.status, values.releaseAt);
          await updateTrackMutation.mutateAsync({
            description: values.description || undefined,
            downloadsAllowed: values.downloadsAllowed,
            downloadsRequireFirstPlay: values.downloadsRequireFirstPlay,
            downloadsRequirePurchase: values.downloadsRequirePurchase,
            exclusiveUntil: exclusiveUntilForApi(values.exclusiveUntil, true),
            // Genre and status-derived release metadata are locked once a
            // track is released; omit them so the PATCH never touches them.
            ...(isReleasedTrack
              ? {}
              : {
                  genre: values.genre,
                  isPublic: release.isPublic,
                  productionStatus: release.productionStatus,
                  releaseAt: values.releaseAt || undefined,
                  releaseStrategy: release.releaseStrategy,
                }),
            isForSale: values.isForSale,
            isrc: values.isrc || undefined,
            listeningAccess: values.listeningAccess,
            musicalKey: values.key || undefined,
            price: values.isForSale ? SINGLE_PRICE_USD : undefined,
            priceCents: values.isForSale
              ? Math.round(SINGLE_PRICE_USD * 100)
              : undefined,
            streamingLinks: {
              appleMusic: values.streamingAppleMusic || undefined,
              spotify: values.streamingSpotify || undefined,
              youtube: values.streamingYoutube || undefined,
            },
            title: values.name,
          });

          setSubmitStage("settled");
          toast({
            description: `"${values.name}" details updated successfully.`,
            title: "Track Updated",
          });
          clearDraft();
          allowNavigation();
          router.navigate({
            params: { id: trackId },
            to: "/dashboard/tracks/$id",
          });
        } catch (error) {
          posthog.captureException(error);
          toast({
            description:
              error instanceof Error
                ? error.message
                : "Failed to update track.",
            title: "Update Failed",
            variant: "destructive",
          });
          setIsSubmitting(false);
          setSubmitStage("idle");
        } finally {
          isSubmittingRef.current = false;
        }
        return;
      }

      if (!selectedMasterFile && !uploadedTrack) {
        toast({
          description: "Upload a master audio file before completing setup.",
          title: "Master audio required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        setSubmitStage("idle");
        return;
      }

      try {
        setSubmitStage("preparing");

        // 1. Create or reuse draft track
        let trackIdToUse = pendingMasterTrackRef.current?.id;
        let trackTitleToUse = values.name;

        if (!trackIdToUse) {
          const createdTrack = await createTrackMutation.mutateAsync({
            assetIds: [],
            catalogItemType: "single",
            collaborators: values.credits.map((credit) => ({
              alsoCreditAsWriter: credit.alsoCreditAsWriter,
              inviteEmail: credit.inviteEmail,
              name: credit.displayName,
              role: credit.role,
              splitBps: credit.splitBps,
              userId: credit.userId,
            })),
            description: values.description || undefined,
            downloadsAllowed: values.downloadsAllowed,
            downloadsRequireFirstPlay: values.downloadsRequireFirstPlay,
            downloadsRequirePurchase: values.downloadsRequirePurchase,
            exclusiveUntil: exclusiveUntilForApi(values.exclusiveUntil),
            genre: values.genre,
            isForSale: values.isForSale,
            isOpenVerse: false,
            isPublic: false,
            isrc: values.isrc || undefined,
            listeningAccess: values.listeningAccess,
            musicalKey: values.key || undefined,
            price: values.isForSale ? SINGLE_PRICE_USD : undefined,
            priceCents: values.isForSale
              ? Math.round(SINGLE_PRICE_USD * 100)
              : undefined,
            productionStatus: "demo",
            purchaseMode: "digital_download",
            releaseStrategy: "private",
            streamingLinks: {
              appleMusic: values.streamingAppleMusic || undefined,
              spotify: values.streamingSpotify || undefined,
              youtube: values.streamingYoutube || undefined,
            },
            title: values.name,
          });
          trackIdToUse = createdTrack.id;
          trackTitleToUse = createdTrack.title;
          pendingMasterTrackRef.current = {
            id: createdTrack.id,
            title: createdTrack.title,
          };
        }

        // 2. Prepare audio preview and duration
        const previewFile = selectedMasterFile
          ? await createAudioPreviewFile(selectedMasterFile).catch(() => null)
          : null;
        const masterDurationMs =
          selectedMasterDurationMs ??
          (selectedMasterFile
            ? await readAudioDurationMs(selectedMasterFile).catch(() => null)
            : null);

        // 3. Upload Master & Preview (if not already uploaded)
        let masterKey = uploadedTrack?.objectKey ?? "";
        let masterUrl = uploadedTrack?.remoteUrl ?? "";
        let previewKey: string | undefined;
        let previewUrl: string | undefined;

        if (!masterKey && selectedMasterFile) {
          setSubmitStage("uploading");
          const filesToUpload = previewFile
            ? [selectedMasterFile, previewFile]
            : [selectedMasterFile];
          const masterResult = await uploadMasterAsync(filesToUpload);

          const masterUpload = masterResult.files.find(
            (entry) =>
              (entry.raw && entry.raw === selectedMasterFile) ||
              (!entry.name.endsWith(".preview.wav") &&
                entry.name === selectedMasterFile?.name) ||
              !entry.name.endsWith(".preview.wav")
          );
          const previewUpload = masterResult.files.find(
            (entry) =>
              (previewFile && entry.raw === previewFile) ||
              entry.name.endsWith(".preview.wav")
          );

          if (!masterUpload) {
            const masterFailed = masterResult.failedFiles.find(
              (entry) =>
                (entry.raw && entry.raw === selectedMasterFile) ||
                (!entry.name.endsWith(".preview.wav") &&
                  entry.name === selectedMasterFile?.name) ||
                !entry.name.endsWith(".preview.wav")
            );
            throw new Error(
              masterFailed?.error?.message ??
                "The master audio file could not be uploaded."
            );
          }

          masterKey = masterUpload.objectInfo.key;
          masterUrl = `${MEDIA_BASE_URL}/${masterKey}`;
          if (previewUpload) {
            previewKey = previewUpload.objectInfo.key;
            previewUrl = `${MEDIA_BASE_URL}/${previewKey}`;
          }
        }

        // 4. Upload Cover Art (if selected and not already uploaded)
        let coverKey = values.coverObjectKey || coverUpload?.objectKey || "";
        let coverUrl = coverUpload?.remoteUrl ?? "";

        if (selectedCoverFile && !coverKey) {
          setSubmitStage("uploading");
          const optimizedCover = await optimizeCoverImageFile(
            selectedCoverFile
          ).catch(() => selectedCoverFile);
          const coverResult = await uploadCoverAsync([optimizedCover]);
          const coverUploaded = coverResult.files[0];
          if (coverUploaded) {
            coverKey = coverUploaded.objectInfo.key;
            coverUrl = `${MEDIA_BASE_URL}/${coverKey}`;
            setCoverUpload({
              fileName: selectedCoverFile.name,
              objectKey: coverKey,
              remoteUrl: coverUrl,
            });
          }
        }

        // 5. Upload optional component files (instrumental, stems)
        const optionalFiles = [
          instrumentalFile
            ? { file: instrumentalFile, kind: "instrumental" as const }
            : null,
          ...enabledComponents.flatMap((kind) => {
            const file = componentFiles[kind];
            return file ? [{ file, kind }] : [];
          }),
        ].filter(
          (
            entry
          ): entry is {
            file: File;
            kind: OptionalComponentKind | "instrumental";
          } => entry !== null
        );

        const uploadedComponents: {
          file: File;
          key: string;
          kind: OptionalComponentKind | "instrumental";
        }[] = [];

        if (optionalFiles.length > 0) {
          setSubmitStage("uploading");
          const componentResult = await uploadComponentsAsync(
            optionalFiles.map((entry) => entry.file)
          );
          for (const uploaded of componentResult.files) {
            const matched = optionalFiles.find(
              (entry) =>
                (uploaded.raw && entry.file === uploaded.raw) ||
                entry.file.name === uploaded.name
            );
            if (matched) {
              uploadedComponents.push({
                file: matched.file,
                key: uploaded.objectInfo.key,
                kind: matched.kind,
              });
            }
          }
        }

        // 6. Finalize SoundKit Assets
        setSubmitStage("finalizing_upload");

        if (coverKey) {
          await rpcJson(
            await trackAssetPost({
              json: {
                assetKind: "cover_art",
                metadata: {
                  originalFileName:
                    coverUpload?.fileName ??
                    selectedCoverFile?.name ??
                    "cover.jpg",
                  url: coverUrl || `${MEDIA_BASE_URL}/${coverKey}`,
                },
                mimeType: "image/*",
                objectKey: coverKey,
                status: "ready",
                storageProvider: "r2",
              },
              param: { trackId: trackIdToUse },
            })
          );
        }

        const masterAssetDetail = await rpcJson(
          await trackAssetPost({
            json: {
              assetKind: "master",
              durationMs: masterDurationMs ?? undefined,
              metadata: {
                durationMs: masterDurationMs,
                originalFileName: selectedMasterFile?.name ?? "master.wav",
              },
              mimeType: selectedMasterFile?.type || "audio/mpeg",
              objectKey: masterKey,
              sizeBytes: selectedMasterFile?.size,
              status: "uploaded",
              storageProvider: "r2",
            },
            param: { trackId: trackIdToUse },
          })
        );

        if (previewKey && previewFile) {
          await rpcJson(
            await trackAssetPost({
              json: {
                assetKind: "variant_audio",
                durationMs: Math.min(masterDurationMs ?? 30_000, 30_000),
                metadata: {
                  durationMs: Math.min(masterDurationMs ?? 30_000, 30_000),
                  originalFileName: previewFile.name,
                  previewDurationSeconds: 30,
                  url: previewUrl,
                  variant: "preview_30s",
                },
                mimeType: previewFile.type || "audio/wav",
                objectKey: previewKey,
                sizeBytes: previewFile.size,
                status: "ready",
                storageProvider: "r2",
              },
              param: { trackId: trackIdToUse },
            })
          );
        }

        for (const comp of uploadedComponents) {
          await rpcJson(
            await trackAssetPost({
              json: {
                assetKind: comp.kind,
                metadata: {
                  originalFileName: comp.file.name,
                  url: `${MEDIA_BASE_URL}/${comp.key}`,
                },
                mimeType: comp.file.type || "application/octet-stream",
                objectKey: comp.key,
                sizeBytes: comp.file.size,
                status: "ready",
                storageProvider: "r2",
              },
              param: { trackId: trackIdToUse },
            })
          );
        }

        // Cache finalized preview so retries avoid re-uploading
        const masterAsset = masterAssetDetail.assets.find(
          (asset) =>
            asset.assetKind === "master" && asset.objectKey === masterKey
        );
        const preview: UploadedTrackPreview = {
          assetId: masterAsset?.id ?? "",
          durationMs: masterDurationMs,
          objectKey: masterKey,
          remoteUrl: masterUrl,
          statusMessage: "Uploaded to SoundKit storage.",
          title: trackTitleToUse,
          trackId: trackIdToUse,
        };
        setUploadedTrack(preview);

        // 7. Settle track with defensive recovery
        setSubmitStage("settling");
        const release = mapStatusToRelease(values.status, values.releaseAt);
        const requireCoverArt = values.status !== "draft";

        if (requireCoverArt && !coverKey) {
          toast({
            description:
              "Add cover art before making this track live. The uploaded master is saved as a private draft.",
            title: "Cover art required",
            variant: "destructive",
          });
          setSubmitStage("idle");
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }

        const settlePayload = {
          body: {
            enrichLyrics: values.enrichLyrics,
            isPublic: release.isPublic,
            productionStatus: release.productionStatus,
            releaseAt: values.releaseAt || undefined,
            releaseStrategy: release.releaseStrategy,
            requireCoverArt,
          },
          trackId: trackIdToUse,
        };

        let settledTrack;
        try {
          settledTrack = await settleTrackMutation.mutateAsync(settlePayload);
        } catch (settleError) {
          const isPendingMaster =
            settleError instanceof Error &&
            ((settleError as { code?: string }).code ===
              "MASTER_UPLOAD_PENDING" ||
              settleError.message.includes(
                "Master audio must finish uploading"
              ));

          if (isPendingMaster) {
            // Re-confirm master asset status before single retry
            await rpcJson(
              await trackAssetPost({
                json: {
                  assetKind: "master",
                  durationMs: masterDurationMs ?? undefined,
                  metadata: {
                    durationMs: masterDurationMs,
                    originalFileName: selectedMasterFile?.name ?? "master.wav",
                  },
                  mimeType: selectedMasterFile?.type || "audio/mpeg",
                  objectKey: masterKey,
                  sizeBytes: selectedMasterFile?.size,
                  status: "uploaded",
                  storageProvider: "r2",
                },
                param: { trackId: trackIdToUse },
              })
            );
            settledTrack = await settleTrackMutation.mutateAsync(settlePayload);
          } else {
            throw settleError;
          }
        }

        // 8. Hand off from browser transfer to durable media processing
        const createdInfo = {
          audioFileName: selectedMasterFile?.name || "master-audio.wav",
          audioFileSize: selectedMasterFile
            ? `${(selectedMasterFile.size / (1024 * 1024)).toFixed(1)} MB`
            : undefined,
          coverUrl: coverUrl || "/placeholder.svg",
          genre: values.genre,
          id: trackIdToUse,
          isPublic: Boolean(settledTrack.isPublic),
          status: values.status,
          title: values.name,
        };
        setCreatedTrackInfo(createdInfo);
        setSubmitStage("processing");
        const processingResult = await waitForTrackMedia({
            onStatus: setProcessingStatus,
            trackId: trackIdToUse,
          }),
          processingFailed = processingResult.status.status === "failed";
        let streamingPlaybackUrl: string | undefined;
        if (processingResult.status.mediaReady) {
          const processedTrack = await rpcJson(
            await trackGet({ param: { trackId: trackIdToUse } })
          );
          streamingPlaybackUrl = processedTrack.playbackUrl ?? undefined;
        }
        setCreatedTrackInfo({
          ...createdInfo,
          playbackUrl: streamingPlaybackUrl,
        });
        setSubmitStage("settled");

        toast({
          description: processingFailed
            ? `${values.name} is saved. Media processing needs a retry from the track dashboard.`
            : processingResult.timedOut
              ? `${values.name} is saved and continues processing in the background.`
              : values.status === "ready"
                ? `${values.name} is processed and live.`
                : `${values.name} is processed and saved as a private draft.`,
          title: processingFailed
            ? "Track saved — processing retry needed"
            : processingResult.timedOut
              ? "Track processing in background"
              : "Track media ready",
          variant: processingFailed ? "destructive" : "default",
        });

        resetDraft();
        clearTrackMediaState();
        allowNavigation();
        pendingMasterTrackRef.current = null;
        posthog.capture("track_upload_settled", {
          genre: values.genre,
          isPublic: values.status === "ready",
          status: values.status,
          trackId: trackIdToUse,
        });
      } catch (error) {
        posthog.captureException(error);
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not complete setup.",
          title: "Error creating track",
          variant: "destructive",
        });
        setSubmitStage("idle");
        setIsSubmitting(false);
      } finally {
        isSubmittingRef.current = false;
      }
    },
    handleSaveChanges = async () => {
      if (!(trackId && initialTrack) || isSubmittingRef.current) {
        return;
      }
      const values = form.getValues(),
        parsed = releasedTrackFormSchema.safeParse(values);
      if (!parsed.success) {
        toast({
          description: "Review the highlighted fields before saving.",
          title: "Track setup incomplete",
          variant: "destructive",
        });
        return;
      }
      const initial = initialValuesRef.current;
      if (!initial) {
        return;
      }
      const trackedKeys = [
          "coverObjectKey",
          "credits",
          "description",
          "downloadsAllowed",
          "downloadsRequireFirstPlay",
          "downloadsRequirePurchase",
          "exclusiveUntil",
          "genre",
          "isForSale",
          "isrc",
          "key",
          "listeningAccess",
          "name",
          "releaseAt",
          "streamingAppleMusic",
          "streamingSpotify",
          "streamingYoutube",
        ] as const,
        changedKeys = new Set(
          trackedKeys.filter(
            (key) =>
              JSON.stringify(values[key]) !== JSON.stringify(initial[key])
          )
        );

      if (!selectedCoverFile && changedKeys.size === 0) {
        toast({
          description: "Nothing has changed yet.",
          title: "No changes to save",
        });
        return;
      }

      isSubmittingRef.current = true;
      setIsSavingChanges(true);

      try {
        const payload: UpdateTrackBody = {};

        // Upload and register a replacement cover when one is staged.
        let coverKey = values.coverObjectKey;
        if (selectedCoverFile) {
          const optimizedCover = await optimizeCoverImageFile(
            selectedCoverFile
          ).catch(() => selectedCoverFile);
          const coverResult = await uploadCoverAsync([optimizedCover]);
          const uploadedCover = coverResult.files[0];
          if (uploadedCover) {
            coverKey = uploadedCover.objectInfo.key;
            await rpcJson(
              await trackAssetPost({
                json: {
                  assetKind: "cover_art",
                  metadata: {
                    originalFileName: selectedCoverFile.name,
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
            setSelectedCoverFile(null);
          }
        }

        if (changedKeys.has("name")) {
          payload.title = values.name;
        }
        if (changedKeys.has("description")) {
          payload.description = values.description || undefined;
        }
        // Locked fields are never sent for released tracks.
        if (changedKeys.has("genre") && !isReleasedTrack) {
          payload.genre = values.genre;
        }
        if (changedKeys.has("listeningAccess")) {
          payload.listeningAccess = values.listeningAccess;
        }
        if (changedKeys.has("key")) {
          payload.musicalKey = values.key || undefined;
        }
        if (changedKeys.has("isrc")) {
          payload.isrc = values.isrc || undefined;
        }
        if (changedKeys.has("downloadsAllowed")) {
          payload.downloadsAllowed = values.downloadsAllowed;
        }
        if (changedKeys.has("downloadsRequireFirstPlay")) {
          payload.downloadsRequireFirstPlay = values.downloadsRequireFirstPlay;
        }
        if (changedKeys.has("downloadsRequirePurchase")) {
          payload.downloadsRequirePurchase = values.downloadsRequirePurchase;
        }
        if (changedKeys.has("isForSale")) {
          payload.isForSale = values.isForSale;
          if (values.isForSale) {
            payload.price = SINGLE_PRICE_USD;
            payload.priceCents = Math.round(SINGLE_PRICE_USD * 100);
          }
        }
        if (changedKeys.has("exclusiveUntil")) {
          payload.exclusiveUntil = exclusiveUntilForApi(
            values.exclusiveUntil,
            true
          );
        }
        if (!isReleasedTrack && changedKeys.has("releaseAt")) {
          payload.releaseAt = values.releaseAt || undefined;
        }
        if (
          changedKeys.has("streamingAppleMusic") ||
          changedKeys.has("streamingSpotify") ||
          changedKeys.has("streamingYoutube")
        ) {
          payload.streamingLinks = {
            appleMusic: values.streamingAppleMusic || undefined,
            spotify: values.streamingSpotify || undefined,
            youtube: values.streamingYoutube || undefined,
          };
        }
        if (changedKeys.has("credits")) {
          payload.collaborators = values.credits.map((credit) => ({
            alsoCreditAsWriter: credit.alsoCreditAsWriter,
            inviteEmail: credit.inviteEmail,
            name: credit.displayName,
            role: credit.role,
            splitBps: credit.splitBps,
            userId: credit.userId,
          }));
        }

        await updateTrackMutation.mutateAsync(payload);

        toast({
          description: `"${values.name}" changes were saved.`,
          title: "Changes Saved",
        });
        form.reset(values);
        initialValuesRef.current = values;
      } catch (error) {
        posthog.captureException(error);
        toast({
          description:
            error instanceof Error ? error.message : "Failed to save changes.",
          title: "Save Failed",
          variant: "destructive",
        });
      } finally {
        isSubmittingRef.current = false;
        setIsSavingChanges(false);
      }
    };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {blockerDialog}

      {isSubmitting && submitStage === "settled" && createdTrackInfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-lg border-primary/30 shadow-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {processingStatus?.mediaReady
                    ? "Track Media Ready"
                    : "Track Safely Saved"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {processingStatus?.mediaReady
                    ? "Previewing the SoundKit streaming derivative your listeners will hear."
                    : "Your original master is registered. Processing can be retried or monitored from the track dashboard."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <img
                src={createdTrackInfo.coverUrl}
                alt={createdTrackInfo.title}
                className="size-16 rounded-lg object-cover border border-border/40 shadow-sm shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-bold truncate text-base">
                  {createdTrackInfo.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {createdTrackInfo.genre}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge
                    variant={
                      createdTrackInfo.isPublic ? "default" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {createdTrackInfo.isPublic
                      ? "Live / Public"
                      : "Private Draft"}
                  </Badge>
                  {createdTrackInfo.audioFileSize && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {createdTrackInfo.audioFileSize}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 h-11"
                disabled={!createdTrackInfo.playbackUrl}
                onClick={() => {
                  if (createdTrackInfo.playbackUrl) {
                    const playerTrack = {
                      artist: "You",
                      artistHref: "/dashboard/profile",
                      cover: createdTrackInfo.coverUrl || "/placeholder.svg",
                      id: createdTrackInfo.id,
                      src: createdTrackInfo.playbackUrl,
                      title: createdTrackInfo.title,
                      trackHref: `/dashboard/tracks/${createdTrackInfo.id}`,
                    };
                    setQueue([playerTrack]);
                    setCurrentTrack(playerTrack);
                  }
                }}
              >
                <Play className="size-4 fill-current" />
                {createdTrackInfo.playbackUrl
                  ? "Play SoundKit Stream"
                  : "Stream Not Ready"}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => {
                    void router.navigate({
                      params: { id: createdTrackInfo.id },
                      to: "/dashboard/tracks/$id",
                    });
                  }}
                >
                  <FileAudio className="size-3.5" />
                  View Details
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs gap-1.5"
                  onClick={() => {
                    setCreatedTrackInfo(null);
                    setSubmitStage("idle");
                    setIsSubmitting(false);
                    resetTrackDraft();
                    setStep("details");
                  }}
                >
                  <Plus className="size-3.5" />
                  Upload Another
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
          <Card className="w-full max-w-md border-primary/30 shadow-2xl p-6 space-y-6 text-center">
            <div className="mx-auto size-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              {submitStage === "settled" ? (
                <CheckCircle2 className="size-8 text-primary animate-bounce" />
              ) : (
                <LoaderCircle className="size-8 text-primary animate-spin" />
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold">
                {submitStage === "preparing" && "Preparing track files..."}
                {submitStage === "uploading" && "Uploading master audio..."}
                {submitStage === "finalizing_upload" &&
                  "Finalizing uploaded audio..."}
                {submitStage === "settling" && "Finishing track setup..."}
                {submitStage === "processing" &&
                  (PROCESSING_STAGE_LABELS[
                    processingStatus?.currentStage ?? "queued"
                  ] ??
                    "Processing SoundKit media")}
                {submitStage === "settled" && "Track ready"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {submitStage === "preparing" &&
                  "Generating preview and staging media..."}
                {submitStage === "uploading" &&
                  `Transferring audio directly to storage (${masterUploadPercent}%)...`}
                {submitStage === "finalizing_upload" &&
                  "Registering audio asset..."}
                {submitStage === "settling" &&
                  "Saving track record and configuration..."}
                {submitStage === "processing" &&
                  "The original master is safe. Durable processing will continue if you leave this page."}
                {submitStage === "settled" && "Track setup complete."}
              </p>
            </div>

            {submitStage === "uploading" ? (
              <div className="space-y-2">
                <Progress value={masterUploadPercent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>{masterUploadPercent}% uploaded</span>
                  {selectedMasterFile && (
                    <span>
                      {(selectedMasterFile.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <output className="block rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                {submitStage === "processing"
                  ? (PROCESSING_STAGE_LABELS[
                      processingStatus?.currentStage ?? "queued"
                    ] ?? "Processing SoundKit media")
                  : "Working on the current stage…"}
              </output>
            )}

            {submitStage === "processing" && createdTrackInfo && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  resetDraft();
                  allowNavigation();
                  pendingMasterTrackRef.current = null;
                  toast({
                    description:
                      "Your master is safe and SoundKit media processing will continue.",
                    title: "Continuing in background",
                  });
                  void router.navigate({ to: "/dashboard/tracks" });
                }}
              >
                Continue in background
              </Button>
            )}

            {submitStage === "uploading" && masterProgresses.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-left space-y-2 max-h-36 overflow-y-auto">
                {masterProgresses.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[200px] font-medium text-foreground/90">
                        {item.name}
                      </span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {Math.round(item.progress * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={Math.round(item.progress * 100)}
                      className="h-1"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {hasSavedDraft && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-amber-400 shrink-0" />
            <span>Restored draft from your previous session.</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetTrackDraft}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 h-8 text-xs gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reset Draft
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.history.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-2 size-4" />
          Back to Tracks
        </Button>
        <Badge
          variant="outline"
          className="bg-primary/5 text-primary border-primary/20"
        >
          New Track Workflow
        </Badge>
      </div>

      <div className="space-y-2">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-playfair)] tracking-tight text-center">
          Create New Track
        </h1>
        <p className="text-muted-foreground text-center max-w-lg mx-auto">
          Add a new track to your music library. Complete each section to ensure
          your release is professional and discoverable.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
          className="space-y-6"
        >
          <Accordion
            type="single"
            collapsible
            value={step}
            onValueChange={setStep}
            className="space-y-4"
          >
            {/* STEP 1: BASIC DETAILS */}
            <AccordionItem
              value="details"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "details"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <Info className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Track Details</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Basic information and categorization
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-primary">
                    Cover Artwork
                  </Label>
                  <FileUploadZone
                    title={
                      selectedCoverFile || coverUpload?.remoteUrl
                        ? "Cover Artwork Attached"
                        : "Upload Track Cover"
                    }
                    description="High resolution artwork (PNG, JPG, JPEG) • Required for public release"
                    acceptedTypes=".png,.jpg,.jpeg"
                    previewUrl={
                      selectedCoverFile
                        ? URL.createObjectURL(selectedCoverFile)
                        : coverUpload?.remoteUrl || null
                    }
                    onRemove={() => {
                      setSelectedCoverFile(null);
                      setCoverUpload(null);
                      form.setValue("coverObjectKey", "");
                    }}
                    files={
                      selectedCoverFile
                        ? [
                            {
                              name: selectedCoverFile.name,
                              status: isCoverUploading
                                ? "Uploading to R2"
                                : "Selected",
                            },
                          ]
                        : coverUpload
                          ? [
                              {
                                name: coverUpload.fileName,
                                status: "R2 Stored",
                              },
                            ]
                          : []
                    }
                    onFileUpload={handleCoverUpload}
                    progress={isCoverUploading ? coverProgress : undefined}
                    status={
                      isCoverUploading
                        ? `${Math.round(coverProgress)}% uploading to R2`
                        : undefined
                    }
                    variant="default"
                  />
                  <FormField
                    control={form.control}
                    name="coverObjectKey"
                    render={() => <FormMessage />}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Track Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Midnight Vibes"
                            {...field}
                            className="bg-background/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="genre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Genre <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          disabled={isReleasedTrack}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select genre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableGenres.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          disabled={isReleasedTrack}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="ready">
                              Ready (go live)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          BPM, duration, and key are detected automatically
                          after upload.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Focus on the music — SoundKit processes BPM, duration,
                    stems, and lyrics in the background after your master
                    uploads.
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell the story behind this track..."
                          className="bg-background/50 min-h-[100px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    onClick={() => setStep("assets")}
                    className="group"
                  >
                    Next: Upload Assets
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 2: ASSETS */}
            <AccordionItem
              value="assets"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "assets"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <CloudUpload className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Audio Assets</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Master, Instrumental and Stems
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                {/* LIVE IN-FORM AUDIO PLAYER PREVIEW */}
                {(selectedMasterFile || uploadedTrack?.remoteUrl) && (
                  <Card className="border border-primary/40 bg-primary/10 shadow-lg p-4 rounded-xl space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          size="icon"
                          className="size-10 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 transition-transform shrink-0"
                          onClick={() => {
                            const src = selectedMasterFile
                                ? URL.createObjectURL(selectedMasterFile)
                                : (uploadedTrack?.remoteUrl ?? ""),
                              trackData = {
                                artist: "You",
                                artistHref: "/dashboard/profile",
                                cover: selectedCoverFile
                                  ? URL.createObjectURL(selectedCoverFile)
                                  : coverUpload?.remoteUrl ||
                                    "/placeholder.svg",
                                id: uploadedTrack?.trackId || "in-form-preview",
                                src,
                                title:
                                  form.getValues("name") ||
                                  selectedMasterFile?.name ||
                                  "Track Master",
                                trackHref: "#",
                              };
                            if (currentTrack?.src === src) {
                              if (typeof togglePlay === "function") {
                                togglePlay();
                              } else {
                                setCurrentTrack(trackData);
                              }
                            } else {
                              setQueue([trackData]);
                              setCurrentTrack(trackData);
                            }
                          }}
                        >
                          <Play className="size-5 fill-current ml-0.5" />
                        </Button>
                        <div>
                          <p className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                            {form.getValues("name") ||
                              selectedMasterFile?.name ||
                              uploadedTrack?.title ||
                              "Master Audio"}
                            <Badge
                              variant="secondary"
                              className="text-[9px] uppercase bg-emerald-500/20 text-emerald-300 font-bold"
                            >
                              In-Form Audio Preview
                            </Badge>
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {selectedMasterFile
                              ? `${(selectedMasterFile.size / (1024 * 1024)).toFixed(1)} MB • ${selectedMasterFile.name}`
                              : "Master audio stored and ready for playback."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-background/60 border border-primary/20">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                        <div className="flex items-end gap-0.5 h-5 px-1">
                          {[
                            40, 75, 50, 90, 60, 30, 85, 95, 45, 70, 80, 55, 65,
                            90, 40, 75,
                          ].map((h, i) => (
                            <div
                              key={i}
                              style={{ height: `${h}%` }}
                              className={cn(
                                "w-1 rounded-full bg-primary/70 transition-all duration-300",
                                isPlaying &&
                                  currentTrack?.id ===
                                    (uploadedTrack?.trackId ||
                                      "in-form-preview")
                                  ? "animate-pulse bg-primary"
                                  : ""
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Master File
                      </Label>
                      <FileUploadZone
                        title="Main Master"
                        description="Highest quality (WAV preferred)"
                        acceptedTypes=".wav,.mp3,.aiff"
                        files={
                          selectedMasterFile
                            ? [
                                {
                                  name: selectedMasterFile.name,
                                  status: isMasterUploading
                                    ? "Uploading"
                                    : "Selected",
                                },
                              ]
                            : uploadedTrack
                              ? [
                                  {
                                    name: uploadedTrack.title,
                                    status: "Uploaded",
                                  },
                                ]
                              : []
                        }
                        onFileUpload={handleMasterUpload}
                        onRemove={() => {
                          setSelectedMasterFile(null);
                          setUploadedTrack(null);
                        }}
                        progress={
                          isMasterUploading ? masterUploadPercent : undefined
                        }
                        status={
                          isMasterUploading
                            ? `${masterUploadPercent}% uploaded`
                            : undefined
                        }
                        variant="compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Instrumental
                      </Label>
                      <FileUploadZone
                        title="Instrumental"
                        description="Optional but recommended"
                        acceptedTypes=".wav,.mp3,.aiff"
                        onFileUpload={(files) => setInstrumentalFile(files[0])}
                        onRemove={() => setInstrumentalFile(null)}
                        files={
                          instrumentalFile
                            ? [
                                {
                                  name: instrumentalFile.name,
                                  status: "Selected",
                                },
                              ]
                            : []
                        }
                        optional
                        variant="compact"
                      />
                    </div>
                  </div>
                </div>

                {uploadedTrack && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <FileAudio className="size-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{uploadedTrack.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {uploadedTrack.statusMessage}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {isMasterUploading
                            ? `${masterUploadPercent}%`
                            : "Ready"}
                        </Badge>
                        <Button
                          onClick={() =>
                            setCurrentTrack({
                              artist: "You",
                              artistHref: "/dashboard/profile",
                              cover: "/placeholder.svg",
                              id: uploadedTrack.trackId,
                              src: uploadedTrack.remoteUrl,
                              title: uploadedTrack.title,
                              trackHref: `/dashboard/tracks/${uploadedTrack.trackId}`,
                            })
                          }
                          size="sm"
                          type="button"
                        >
                          <Play className="mr-2 size-4" />
                          Play
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Optional Components
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add only the production files this release needs.
                      </p>
                    </div>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (
                          enabledComponents.includes(
                            value as OptionalComponentKind
                          )
                        ) {
                          return;
                        }
                        setEnabledComponents((current) => [
                          ...current,
                          value as OptionalComponentKind,
                        ]);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[190px] text-xs">
                        <Plus className="mr-1 size-3" />
                        <SelectValue placeholder="Add Component" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPTIONAL_COMPONENTS.filter(
                          (component) =>
                            !enabledComponents.includes(component.kind)
                        ).map((component) => (
                          <SelectItem
                            key={component.kind}
                            value={component.kind}
                          >
                            {component.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {enabledComponents.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {enabledComponents.map((kind) => {
                        const component = OPTIONAL_COMPONENTS.find(
                          (item) => item.kind === kind
                        );
                        if (!component) {
                          return null;
                        }
                        const file = componentFiles[kind];
                        const restored = restoredComponents[kind];
                        return (
                          <FileUploadZone
                            acceptedTypes={
                              kind === "session_file" || kind === "stems"
                                ? ".zip,.rar,.tar,.wav"
                                : ".wav,.mp3,.aiff,.flac,.m4a,.mid,.midi"
                            }
                            description={component.description}
                            files={
                              file
                                ? [{ name: file.name, status: "Selected" }]
                                : restored
                                  ? [
                                      {
                                        name: restored.name,
                                        status: "Uploaded",
                                      },
                                    ]
                                  : []
                            }
                            key={kind}
                            onFileUpload={(files) => {
                              const nextFile = files[0];
                              if (nextFile) {
                                setComponentFiles((current) => ({
                                  ...current,
                                  [kind]: nextFile,
                                }));
                              }
                            }}
                            onRemove={() => {
                              setEnabledComponents((current) =>
                                current.filter((value) => value !== kind)
                              );
                              setComponentFiles((current) =>
                                Object.fromEntries(
                                  Object.entries(current).filter(
                                    ([key]) => key !== kind
                                  )
                                )
                              );
                            }}
                            optional
                            title={component.label}
                            variant="compact"
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("details")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep("distribution")}
                    className="group"
                  >
                    Next: Distribution
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 3: DISTRIBUTION & SALES */}
            <AccordionItem
              value="distribution"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "distribution"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <DollarSign className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Distribution & Sales</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Pricing, release plan and strategy
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
                  <p className="font-semibold capitalize">
                    Status:{" "}
                    {(form.watch("status") ?? "draft").replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Change status in Track Details. Ready makes the single live
                    for Premium streaming; draft stays private.
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <Calendar className="size-4 text-primary" />
                      Release Schedule
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Choose whether your track drops immediately or on a
                      specific target release date.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="releaseAt"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button
                            type="button"
                            variant={field.value ? "outline" : "default"}
                            className="justify-start h-auto p-3 text-left flex flex-col items-start gap-1"
                            onClick={() => field.onChange("")}
                          >
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <Zap className="size-3.5 fill-current" />
                              Release ASAP (Immediate)
                            </div>
                            <span className="text-[11px] opacity-80 font-normal">
                              Publish as soon as assets finish processing
                            </span>
                          </Button>

                          <Button
                            type="button"
                            variant={field.value ? "default" : "outline"}
                            className="justify-start h-auto p-3 text-left flex flex-col items-start gap-1"
                            onClick={() => {
                              if (!field.value) {
                                const future = new Date();
                                future.setDate(future.getDate() + 7);
                                field.onChange(
                                  future.toISOString().slice(0, 16)
                                );
                              }
                            }}
                          >
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <Calendar className="size-3.5" />
                              Schedule Release Date
                            </div>
                            <span className="text-[11px] opacity-80 font-normal">
                              Pick a future date to go live like real streaming
                            </span>
                          </Button>
                        </div>

                        {Boolean(field.value) && (
                          <div className="pt-2">
                            <FormLabel className="text-xs font-semibold">
                              Expected Release Date & Time
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                value={
                                  field.value ? field.value.slice(0, 16) : ""
                                }
                                onChange={(e) => field.onChange(e.target.value)}
                                className="bg-background/50 text-sm mt-1"
                              />
                            </FormControl>
                            <FormDescription className="text-xs mt-1">
                              Your track will be scheduled and displayed with
                              this release date on the app.
                            </FormDescription>
                            <FormMessage />
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20 gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Monetize Track</Label>
                    {payoutsReady ? (
                      <p className="text-xs text-muted-foreground">
                        Allow fans to purchase this track directly.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Connect Stripe payouts in{" "}
                        <Link
                          className="text-primary underline"
                          to="/dashboard/career/payments"
                        >
                          payout settings
                        </Link>{" "}
                        before you can sell this track.
                      </p>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="isForSale"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            disabled={!payoutsReady}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                // Purchase-gated downloads can't exist
                                // without monetization.
                                form.setValue(
                                  "downloadsRequirePurchase",
                                  false,
                                  { shouldDirty: true }
                                );
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {isPremiumArtist ? (
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20 gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">
                        Generate lyrics &amp; stems
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Premium: splits vocals/instrumental and transcribes
                        timed lyrics with third-party credits. Leave off to
                        skip.
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="enrichLyrics"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}

                {form.watch("isForSale") ? (
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm space-y-4">
                    <div>
                      <p className="font-semibold">Single price: $1.29</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Purchases unlock downloads. Choose whether streaming is
                        public or limited to Premium members and purchasers.
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="listeningAccess"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Streaming access</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">
                                Public listening
                              </SelectItem>
                              <SelectItem value="premium_or_purchased">
                                Premium members or purchasers
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Protected streaming stays restricted until the
                            optional exclusivity date.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("listeningAccess") ===
                    "premium_or_purchased" ? (
                      <FormField
                        control={form.control}
                        name="exclusiveUntil"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Exclusive until (optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                value={
                                  field.value ? field.value.slice(0, 16) : ""
                                }
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              After this date, the track becomes publicly
                              streamable while remaining for sale.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-xl border border-border/40 bg-card/40 p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-sm">Download Access</h3>
                    <p className="text-muted-foreground text-xs">
                      Choose how fans can access the files included with this
                      single.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="downloadsAllowed"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Allow downloads</FormLabel>
                            <FormDescription className="text-xs">
                              Include downloadable files when a fan has access.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (!checked) {
                                  form.setValue(
                                    "downloadsRequireFirstPlay",
                                    false
                                  );
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="downloadsRequirePurchase"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Require purchase</FormLabel>
                            <FormDescription className="text-xs">
                              Only buyers can download included files.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              disabled={!form.watch("downloadsAllowed")}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (checked) {
                                  // Purchase-gated downloads require the
                                  // track to be monetized.
                                  form.setValue("isForSale", true, {
                                    shouldDirty: true,
                                  });
                                  form.setValue(
                                    "downloadsRequireFirstPlay",
                                    false
                                  );
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="downloadsRequireFirstPlay"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Require one play first</FormLabel>
                            <FormDescription className="text-xs">
                              Unlock free downloads only after the track has
                              been played.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              disabled={
                                !form.watch("downloadsAllowed") ||
                                form.watch("downloadsRequirePurchase")
                              }
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/40 bg-card/40 p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-sm">
                      Release Identifiers
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Add registry and platform links when this track is already
                      live elsewhere.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="isrc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ISRC</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-background/50"
                              placeholder="US-XXX-26-00001"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="streamingSpotify"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Spotify Track URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-background/50"
                              placeholder="https://open.spotify.com/track/..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="streamingAppleMusic"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apple Music Track URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-background/50"
                              placeholder="https://music.apple.com/..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="streamingYoutube"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>YouTube URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-background/50"
                              placeholder="https://youtube.com/watch?v=..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("assets")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep("collaboration")}
                    className="group"
                  >
                    Next: Team
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 4: COLLABORATION */}
            <AccordionItem
              value="collaboration"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "collaboration"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <Users className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Collaborators</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Invite your team to this track
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <CreditsEditor
                  onChange={(credits) =>
                    form.setValue("credits", credits, { shouldDirty: true })
                  }
                  value={form.watch("credits")}
                />

                <FormField
                  control={form.control}
                  name="rightsAccepted"
                  render={({ field }) => (
                    <FormItem className="rounded-xl border border-border/40 bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-sm">
                            I own or control the rights to upload, distribute,
                            and sell this music on SoundKit.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("distribution")}
                  >
                    Back
                  </Button>
                  <div className="flex gap-2">
                    {trackId && initialTrack ? null : (
                      <Button
                        disabled={isSubmitting}
                        onClick={handleSaveTrackDraft}
                        type="button"
                        variant="outline"
                      >
                        Save Draft
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-w-[150px] shadow-lg shadow-primary/20"
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle className="mr-2 size-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Complete Setup
                          <Check className="ml-2 size-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>

      {trackId && initialTrack ? (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            className="shadow-lg shadow-primary/30"
            disabled={isSavingChanges || isSubmitting}
            onClick={handleSaveChanges}
            size="lg"
            type="button"
          >
            {isSavingChanges ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 size-4" />
                Save changes
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
