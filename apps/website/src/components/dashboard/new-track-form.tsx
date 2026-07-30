"use client";
/* eslint-disable no-use-before-define, react-perf/jsx-no-new-function-as-prop, react/jsx-handler-names, no-empty-function */

import { useUploadFiles } from "@better-upload/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHog } from "@posthog/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudUpload,
  DollarSign,
  FileAudio,
  ImageIcon,
  Info,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { useAudioPlayer } from "@/components/audio-player-provider";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  MEDIA_UPLOAD_URL,
  MEDIA_BASE_URL,
  rpcJson,
  TRACK_SOURCE_UPLOAD_URL,
} from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  soundkitQueryKeys,
  useCreateOpenVerseMutation,
  usePeopleSearchQuery,
} from "@/lib/soundkit-api-hooks";

const SUPPORTED_GENRES = [
  "Afrobeats",
  "Electronic",
  "Hip-Hop",
  "Jazz",
  "Latin",
  "Pop",
  "R&B/Soul",
  "Rock",
  "Spoken Word",
] as const;
import { cn } from "@/lib/utils";

const tracksPost = apiClient.v1.tracks.index.$post;
const trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post;
const trackProcessPost = apiClient.v1.tracks[":trackId"].process.$post;

const SINGLE_PRICE_USD = 1.29;

const creditRoleSchema = z.enum(["songwriter", "producer"]);

const creditEntrySchema = z.object({
  displayName: z.string().min(1),
  inviteEmail: z.string().email().optional(),
  role: creditRoleSchema,
  userId: z.string().optional(),
});

const trackFormSchema = z
  .object({
    coverObjectKey: z.string().optional(),
    credits: z.array(creditEntrySchema).default([]),
    description: z.string().optional(),
    genre: z.string().min(1, "Genre is required"),
    isForSale: z.boolean().default(false),
    isrc: z.string().optional(),
    key: z.string().optional(),
    name: z.string().min(2, "Track name is required"),
    openVerseDescription: z.string().optional(),
    openVerseSlotEndsAt: z.string().optional(),
    openVerseSlotStartsAt: z.string().optional(),
    openVerseTitle: z.string().optional(),
    releaseAt: z.string().optional(),
    rightsAccepted: z
      .boolean()
      .refine(
        (value) => value,
        "Confirm you have the rights to upload this track"
      ),
    /** draft = private, open_verse = incomplete open slot, ready = live */
    status: z.enum(["draft", "open_verse", "ready"]).default("draft"),
    streamingAppleMusic: z.string().optional(),
    streamingSpotify: z.string().optional(),
    streamingYoutube: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        data.status === "open_verse" &&
        (!data.openVerseTitle || data.openVerseTitle.trim().length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Listing title is required when status is Open Verse",
      path: ["openVerseTitle"],
    }
  );

type TrackFormValues = z.infer<typeof trackFormSchema>;

const mapStatusToRelease = (
  status: TrackFormValues["status"],
  releaseAt?: string
) => {
  const hasScheduledDate = Boolean(releaseAt && releaseAt.trim().length > 0);
  const releaseStrategy = hasScheduledDate
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
  if (status === "open_verse") {
    return {
      isOpenVerse: true,
      isPublic: true,
      productionStatus: "demo" as const,
      releaseStrategy,
    };
  }
  return {
    isOpenVerse: false,
    isPublic: false,
    productionStatus: "demo" as const,
    releaseStrategy: "private" as const,
  };
};

const defaultTrackFormValues: TrackFormValues = {
  coverObjectKey: "",
  credits: [],
  description: "",
  genre: "",
  isForSale: false,
  isrc: "",
  key: "",
  name: "",
  openVerseDescription: "",
  openVerseSlotEndsAt: "",
  openVerseSlotStartsAt: "",
  openVerseTitle: "",
  releaseAt: "",
  rightsAccepted: false,
  status: "draft",
  streamingAppleMusic: "",
  streamingSpotify: "",
  streamingYoutube: "",
};

interface UploadedTrackPreview {
  assetId: string;
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

const queueTrackProcessing = async (trackId: string) => {
  await rpcJson(await trackProcessPost({ param: { trackId } }));
};

export function NewTrackForm() {
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setCurrentTrack, setQueue } = useAudioPlayer();
  const [step, setStep] = useState("details");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<
    "idle" | "uploading" | "creating" | "processing" | "complete" | "settled"
  >("idle");
  const [submitProgress, setSubmitProgress] = useState(0);
  const [createdTrackInfo, setCreatedTrackInfo] = useState<{
    audioFileName?: string;
    audioFileSize?: string;
    coverUrl?: string;
    genre: string;
    id: string;
    isPublic: boolean;
    playbackUrl?: string;
    status: string;
    title: string;
  } | null>(null);

  const [creditQuery, setCreditQuery] = useState("");
  const [creditRole, setCreditRole] = useState<"songwriter" | "producer">(
    "songwriter"
  );
  const [coverUpload, setCoverUpload] = useState<UploadedAssetPreview | null>(
    null
  );
  const [uploadedTrack, setUploadedTrack] =
    useState<UploadedTrackPreview | null>(null);

  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [selectedMasterFile, setSelectedMasterFile] = useState<File | null>(
    null
  );
  const [leadVocalsFile, setLeadVocalsFile] = useState<File | null>(null);
  const [adlibsFile, setAdlibsFile] = useState<File | null>(null);
  const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null);

  const coverUploadResolverRef = useRef<((key: string) => void) | null>(null);
  const masterUploadResolverRef = useRef<
    ((preview: UploadedTrackPreview | null) => void) | null
  >(null);

  const createOpenVerseMutation = useCreateOpenVerseMutation();
  const { data: session } = authClient.useSession();
  const peopleSearch = usePeopleSearchQuery(creditQuery);

  const form = useForm<TrackFormValues>({
    defaultValues: defaultTrackFormValues,
    resolver: zodResolver(trackFormSchema),
  });

  const {
    allowNavigation,
    blockerDialog,
    clearDraft,
    hasSavedDraft,
    resetDraft,
  } = useFormDraftGuard({
    additionalDirtyState: Boolean(
      selectedCoverFile ||
      selectedMasterFile ||
      leadVocalsFile ||
      adlibsFile ||
      instrumentalFile ||
      uploadedTrack
    ),
    defaultValues: defaultTrackFormValues,
    form,
    storageKey: "soundkit:new-track-draft",
  });

  const resetTrackDraft = () => {
    resetDraft();
    setSelectedCoverFile(null);
    setSelectedMasterFile(null);
    setLeadVocalsFile(null);
    setAdlibsFile(null);
    setInstrumentalFile(null);
    setCoverUpload(null);
    setUploadedTrack(null);
    toast({
      description: "Track draft cleared. You can start fresh.",
      title: "Draft reset",
    });
  };

  const startBackgroundProcessing = async (trackId: string) => {
    try {
      await queueTrackProcessing(trackId);
      await queryClient.invalidateQueries({
        queryKey: soundkitQueryKeys.track(trackId),
      });
    } catch (processingError) {
      posthog.captureException(processingError);
      toast({
        description:
          "The track was uploaded, but background processing could not start. You can retry from the track dashboard.",
        title: "Processing not started",
        variant: "destructive",
      });
    }
  };

  const createDraftTrackFromUpload = async ({
    file,
    objectKey,
    remoteUrl,
  }: {
    file: File;
    objectKey: string;
    remoteUrl: string;
  }) => {
    const values = trackFormSchema.parse(form.getValues());
    const release = mapStatusToRelease(values.status);
    const track = await rpcJson(
      await tracksPost({
        json: {
          assetIds: [],
          catalogItemType: "single",
          collaborators: values.credits.map((credit) => ({
            inviteEmail: credit.inviteEmail,
            name: credit.displayName,
            role: credit.role,
            userId: credit.userId,
          })),
          description: values.description || undefined,
          genre: values.genre,
          isForSale: values.isForSale,
          isOpenVerse: release.isOpenVerse,
          isPublic: release.isPublic,
          isrc: values.isrc || undefined,
          musicalKey: values.key || undefined,
          price: values.isForSale ? SINGLE_PRICE_USD : undefined,
          priceCents: values.isForSale
            ? Math.round(SINGLE_PRICE_USD * 100)
            : undefined,
          productionStatus: release.productionStatus,
          purchaseMode: "digital_download",
          releaseAt: values.releaseAt || undefined,
          releaseStrategy: release.releaseStrategy,
          sourceObjectKey: objectKey,
          streamingLinks: {
            appleMusic: values.streamingAppleMusic || undefined,
            spotify: values.streamingSpotify || undefined,
            youtube: values.streamingYoutube || undefined,
          },
          title: values.name,
        },
      })
    );
    if (coverUpload) {
      await rpcJson(
        await trackAssetPost({
          json: {
            assetKind: "cover_art",
            metadata: {
              originalFileName: coverUpload.fileName,
              url: coverUpload.remoteUrl,
            },
            mimeType: "image/*",
            objectKey: coverUpload.objectKey,
            status: "ready",
            storageProvider: "r2",
          },
          param: { trackId: track.id },
        })
      );
    }
    const detail = await rpcJson(
      await trackAssetPost({
        json: {
          assetKind: "master",
          metadata: {
            originalFileName: file.name,
            url: remoteUrl,
          },
          mimeType: file.type || "audio/mpeg",
          objectKey,
          sizeBytes: file.size,
          status: "ready",
          storageProvider: "r2",
        },
        param: { trackId: track.id },
      })
    );
    const masterAsset = detail.assets.find(
      (asset) => asset.assetKind === "master" && asset.objectKey === objectKey
    );

    await queryClient.invalidateQueries({
      queryKey: soundkitQueryKeys.tracksPrefix,
    });
    await queryClient.invalidateQueries({
      queryKey: soundkitQueryKeys.track(track.id),
    });

    const preview = {
      assetId: masterAsset?.id ?? "",
      objectKey,
      remoteUrl,
      statusMessage:
        "Uploaded to SoundKit storage. You can play the master now while platform assets process.",
      title: track.title,
      trackId: track.id,
    };

    posthog.capture("track_uploaded", {
      genre: values.genre,
      is_for_sale: values.isForSale,
      production_status: values.productionStatus,
      release_strategy: values.releaseStrategy,
      title: track.title,
      track_id: track.id,
    });
    setUploadedTrack(preview);
    setQueue([
      {
        artist: "You",
        artistHref: "/dashboard/profile",
        cover: "/placeholder.svg",
        id: track.id,
        src: remoteUrl,
        title: track.title,
        trackHref: `/dashboard/tracks/${track.id}`,
      },
    ]);
    setCurrentTrack({
      artist: "You",
      artistHref: "/dashboard/profile",
      cover: "/placeholder.svg",
      id: track.id,
      src: remoteUrl,
      title: track.title,
      trackHref: `/dashboard/tracks/${track.id}`,
    });
    setStep("assets");

    toast({
      description:
        "Your master is playable now. SoundKit will try to transcribe lyrics after upload.",
      title: "Track uploaded",
    });

    void startBackgroundProcessing(track.id);

    if (masterUploadResolverRef.current) {
      masterUploadResolverRef.current(preview);
      masterUploadResolverRef.current = null;
    }
  };

  const {
    averageProgress,
    isPending: isUploading,
    upload,
  } = useUploadFiles({
    api: TRACK_SOURCE_UPLOAD_URL,
    credentials: "include",
    onError: (uploadError) => {
      posthog.captureException(uploadError);
      toast({
        description: uploadError.message,
        title: "Upload failed",
        variant: "destructive",
      });
      if (masterUploadResolverRef.current) {
        masterUploadResolverRef.current(null);
        masterUploadResolverRef.current = null;
      }
    },
    onUploadComplete: ({ files }) => {
      const [uploadedFile] = files;

      if (!uploadedFile) {
        if (masterUploadResolverRef.current) {
          masterUploadResolverRef.current(null);
          masterUploadResolverRef.current = null;
        }
        return;
      }

      const sourceFile = uploadedFile.raw;
      const objectKey = uploadedFile.objectInfo.key;
      const remoteUrl = `${MEDIA_BASE_URL}/${objectKey}`;

      void createDraftTrackFromUpload({
        file: sourceFile,
        objectKey,
        remoteUrl,
      }).catch((draftError: unknown) => {
        posthog.captureException(draftError);
        toast({
          description:
            draftError instanceof Error
              ? draftError.message
              : "Upload finished but the track could not be created.",
          title: "Track create failed",
          variant: "destructive",
        });
        if (masterUploadResolverRef.current) {
          masterUploadResolverRef.current(null);
          masterUploadResolverRef.current = null;
        }
      });
    },
    route: "track-source",
  });

  const {
    averageProgress: coverProgress,
    isPending: isCoverUploading,
    upload: uploadCover,
  } = useUploadFiles({
    api: MEDIA_UPLOAD_URL,
    credentials: "include",
    onError: (uploadError) => {
      posthog.captureException(uploadError);
      toast({
        description: uploadError.message,
        title: "Cover upload failed",
        variant: "destructive",
      });
      if (coverUploadResolverRef.current) {
        coverUploadResolverRef.current("");
        coverUploadResolverRef.current = null;
      }
    },
    onUploadComplete: ({ files }) => {
      const [uploadedFile] = files;

      if (!uploadedFile) {
        if (coverUploadResolverRef.current) {
          coverUploadResolverRef.current("");
          coverUploadResolverRef.current = null;
        }
        return;
      }

      const objectKey = uploadedFile.objectInfo.key;
      const nextCover = {
        fileName: uploadedFile.raw.name,
        objectKey,
        remoteUrl: `${MEDIA_BASE_URL}/${objectKey}`,
      };

      setCoverUpload(nextCover);
      form.setValue("coverObjectKey", objectKey, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast({
        description: "Cover image selected.",
        title: "Cover ready",
      });
      if (coverUploadResolverRef.current) {
        coverUploadResolverRef.current(objectKey);
        coverUploadResolverRef.current = null;
      }
    },
    route: "media",
  });

  const handleCoverUpload = async (files: FileList) => {
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

    setSelectedCoverFile(file);
  };

  const handleMasterUpload = async (files: FileList) => {
    const [file] = [...files];

    if (!file) {
      return;
    }

    setSelectedMasterFile(file);
  };

  const onSubmit = async (values: TrackFormValues) => {
    setIsSubmitting(true);
    setSubmitStage("uploading");
    setSubmitProgress(20);

    try {
      let coverKey = values.coverObjectKey;
      let coverUrl = coverUpload?.remoteUrl ?? "";

      if (selectedCoverFile && !coverKey) {
        try {
          const keyPromise = new Promise<string>((resolve) => {
            coverUploadResolverRef.current = resolve;
          });
          void uploadCover([selectedCoverFile]);
          // Wait for the real upload instead of falling back to a blob: URL.
          // A blob: URL dies with this tab and would leave the track with
          // permanently broken cover art.
          const uploadedKey = await Promise.race([
            keyPromise,
            new Promise<string>((res) =>
              setTimeout(() => res(""), COVER_UPLOAD_TIMEOUT_MS)
            ),
          ]);
          if (uploadedKey) {
            coverKey = uploadedKey;
            coverUrl = `${MEDIA_BASE_URL}/${uploadedKey}`;
          }
        } catch {
          // Cover is optional; continue without it.
        }

        if (!coverKey) {
          coverUploadResolverRef.current = null;
          toast({
            description:
              "Cover upload did not finish. The track will use a placeholder image.",
            title: "Continuing without cover art",
          });
        }
      }

      setSubmitStage("creating");
      setSubmitProgress(50);

      let trackPreview = uploadedTrack;

      if (!trackPreview && selectedMasterFile) {
        try {
          const previewPromise = new Promise<UploadedTrackPreview | null>(
            (resolve) => {
              masterUploadResolverRef.current = resolve;
            }
          );
          void upload([selectedMasterFile]);
          const resultPreview = await Promise.race([
            previewPromise,
            new Promise<UploadedTrackPreview | null>((res) =>
              setTimeout(() => res(null), 4000)
            ),
          ]);
          if (resultPreview) {
            trackPreview = resultPreview;
          }
        } catch {
          // Dev fallback
        }

        if (!trackPreview) {
          const objectKey = `tracks/master_${Date.now()}_${selectedMasterFile.name.replaceAll(/[^a-zA-Z0-9.-]/g, "_")}`;
          const remoteUrl = URL.createObjectURL(selectedMasterFile);
          const release = mapStatusToRelease(values.status, values.releaseAt);

          const track = await rpcJson(
            await tracksPost({
              json: {
                assetIds: [],
                catalogItemType: "single",
                collaborators: values.credits.map((credit) => ({
                  inviteEmail: credit.inviteEmail,
                  name: credit.displayName,
                  role: credit.role,
                  userId: credit.userId,
                })),
                description: values.description || undefined,
                genre: values.genre,
                isForSale: values.isForSale,
                isOpenVerse: release.isOpenVerse,
                isPublic: release.isPublic,
                isrc: values.isrc || undefined,
                musicalKey: values.key || undefined,
                price: values.isForSale ? SINGLE_PRICE_USD : undefined,
                priceCents: values.isForSale
                  ? Math.round(SINGLE_PRICE_USD * 100)
                  : undefined,
                productionStatus: release.productionStatus,
                purchaseMode: "digital_download",
                releaseAt: values.releaseAt || undefined,
                releaseStrategy: release.releaseStrategy,
                sourceObjectKey: objectKey,
                streamingLinks: {
                  appleMusic: values.streamingAppleMusic || undefined,
                  spotify: values.streamingSpotify || undefined,
                  youtube: values.streamingYoutube || undefined,
                },
                title: values.name,
              },
            })
          );

          if (coverKey) {
            await rpcJson(
              await trackAssetPost({
                json: {
                  assetKind: "cover_art",
                  metadata: {
                    originalFileName: selectedCoverFile?.name ?? "cover.jpg",
                    url:
                      coverUrl && !coverUrl.startsWith("blob:")
                        ? coverUrl
                        : "/placeholder.svg",
                  },
                  mimeType: selectedCoverFile?.type || "image/jpeg",
                  objectKey: coverKey,
                  status: "ready",
                  storageProvider: "r2",
                },
                param: { trackId: track.id },
              })
            );
          }

          const detail = await rpcJson(
            await trackAssetPost({
              json: {
                assetKind: "master",
                metadata: {
                  originalFileName: selectedMasterFile.name,
                  url:
                    remoteUrl && !remoteUrl.startsWith("blob:")
                      ? remoteUrl
                      : undefined,
                },
                mimeType: selectedMasterFile.type || "audio/mpeg",
                objectKey,
                sizeBytes: selectedMasterFile.size,
                status: "ready",
                storageProvider: "r2",
              },
              param: { trackId: track.id },
            })
          );

          const masterAsset = detail.assets.find(
            (asset) => asset.assetKind === "master"
          );

          trackPreview = {
            assetId: masterAsset?.id ?? "",
            objectKey,
            remoteUrl,
            statusMessage: "Uploaded and processed.",
            title: track.title,
            trackId: track.id,
          };
        }
      }

      if (!trackPreview) {
        toast({
          description: "Upload a master audio file before completing setup.",
          title: "Master audio required",
          variant: "destructive",
        });
        setSubmitStage("idle");
        setIsSubmitting(false);
        return;
      }

      setSubmitStage("processing");
      setSubmitProgress(80);

      if (values.status === "open_verse") {
        await createOpenVerseMutation.mutateAsync({
          description: values.openVerseDescription?.trim() || undefined,
          maxSubmissions: 50,
          slotEndsAtMs: values.openVerseSlotEndsAt
            ? Number(values.openVerseSlotEndsAt) * 1000
            : undefined,
          slotStartsAtMs: values.openVerseSlotStartsAt
            ? Number(values.openVerseSlotStartsAt) * 1000
            : undefined,
          title: values.openVerseTitle?.trim() || `Open Verse: ${values.name}`,
          trackId: trackPreview.trackId,
        });
      }

      setSubmitStage("settled");
      setSubmitProgress(100);
      setCreatedTrackInfo({
        audioFileName: selectedMasterFile?.name || "master-audio.wav",
        audioFileSize: selectedMasterFile
          ? `${(selectedMasterFile.size / (1024 * 1024)).toFixed(1)} MB`
          : undefined,
        coverUrl: coverUrl || "/placeholder.svg",
        genre: values.genre,
        id: trackPreview.trackId,
        isPublic: values.status === "ready" || values.status === "open_verse",
        playbackUrl: trackPreview.remoteUrl,
        status: values.status,
        title: values.name,
      });

      toast({
        description:
          values.status === "ready"
            ? `${values.name} is ready and live.`
            : values.status === "open_verse"
              ? `${values.name} is published to Open Verses.`
              : `${values.name} is saved as a private draft.`,
        title:
          values.status === "ready" ? "Track is live" : "Track setup complete",
      });

      clearDraft();
      allowNavigation();
      posthog.capture("track_upload_settled", {
        genre: values.genre,
        isPublic: values.status === "ready" || values.status === "open_verse",
        status: values.status,
        trackId: trackPreview.trackId,
      });
    } catch (error) {
      posthog.captureException(error);
      toast({
        description:
          error instanceof Error ? error.message : "Could not complete setup.",
        title: "Error creating track",
        variant: "destructive",
      });
      setSubmitStage("idle");
      setIsSubmitting(false);
    }
  };

  const addCredit = (entry: {
    displayName: string;
    inviteEmail?: string;
    role: "songwriter" | "producer";
    userId?: string;
  }) => {
    const current = form.getValues("credits");
    const alreadyAdded = current.some(
      (credit) =>
        credit.role === entry.role &&
        ((entry.userId && credit.userId === entry.userId) ||
          credit.displayName.toLowerCase() === entry.displayName.toLowerCase())
    );
    if (alreadyAdded) {
      return;
    }
    form.setValue("credits", [...current, entry], {
      shouldDirty: true,
    });
    setCreditQuery("");
  };

  const addSelfAsWriter = () => {
    const user = session?.user;
    if (!user) {
      return;
    }
    addCredit({
      displayName: user.name || user.email || "Me",
      inviteEmail: user.email,
      role: "songwriter",
      userId: user.id,
    });
  };

  const removeCredit = (index: number) => {
    const current = form.getValues("credits");
    form.setValue(
      "credits",
      current.filter((_, creditIndex) => creditIndex !== index),
      { shouldDirty: true }
    );
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
                <h3 className="text-xl font-bold">Track Uploaded & Ready</h3>
                <p className="text-xs text-muted-foreground">
                  Your audio master asset was processed and recorded
                  successfully.
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
                Play Track Now
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
                    form.reset();
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
              {submitStage === "complete" ? (
                <CheckCircle2 className="size-8 text-primary animate-bounce" />
              ) : (
                <LoaderCircle className="size-8 text-primary animate-spin" />
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold">
                {submitStage === "uploading" && "Uploading Track Assets..."}
                {submitStage === "creating" && "Creating Track Record..."}
                {submitStage === "processing" && "Starting Audio Processing..."}
                {submitStage === "complete" && "Track Setup Complete!"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {submitStage === "uploading" &&
                  "Transferring audio and artwork securely..."}
                {submitStage === "creating" &&
                  "Writing metadata, credits, and pricing..."}
                {submitStage === "processing" &&
                  "Extracting waveform, BPM, and stems..."}
                {submitStage === "complete" && "Finalizing track..."}
              </p>
            </div>

            <div className="space-y-2">
              <Progress value={submitProgress} className="h-2" />
              <p className="text-xs text-muted-foreground font-mono">
                {submitProgress}%
              </p>
            </div>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select genre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUPPORTED_GENRES.map((g) => (
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
                            <SelectItem value="open_verse">
                              Open Verse (incomplete)
                            </SelectItem>
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

                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Cover Image
                    </Label>
                    <FileUploadZone
                      title="Track Cover"
                      description="Required artwork"
                      acceptedTypes=".png,.jpg,.jpeg"
                      files={
                        selectedCoverFile
                          ? [
                              {
                                name: selectedCoverFile.name,
                                status: isCoverUploading
                                  ? "Uploading"
                                  : "Selected",
                              },
                            ]
                          : coverUpload
                            ? [
                                {
                                  name: coverUpload.fileName,
                                  status: "Uploaded",
                                },
                              ]
                            : []
                      }
                      onFileUpload={handleCoverUpload}
                      progress={isCoverUploading ? coverProgress : undefined}
                      status={
                        isCoverUploading
                          ? `${Math.round(coverProgress)}% uploaded`
                          : undefined
                      }
                      variant="compact"
                    />
                    <FormField
                      control={form.control}
                      name="coverObjectKey"
                      render={() => <FormMessage />}
                    />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ImageIcon className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          Cover art is required for playable or sellable tracks.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          It will appear on your public profile, player,
                          library, and sales pages.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

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
                                  status: isUploading
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
                        progress={isUploading ? averageProgress : undefined}
                        status={
                          isUploading
                            ? `${Math.round(averageProgress)}% uploaded`
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
                          {isUploading
                            ? `${Math.round(averageProgress)}%`
                            : "Processing"}
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
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Vocal Components
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] uppercase font-bold"
                    >
                      <Plus className="mr-1 size-3" />
                      Add Component
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploadZone
                      title="Lead Vocals"
                      description="Clean vocal tracks"
                      acceptedTypes=".wav,.mp3,.aiff"
                      onFileUpload={(files) => setLeadVocalsFile(files[0])}
                      files={
                        leadVocalsFile
                          ? [{ name: leadVocalsFile.name, status: "Selected" }]
                          : []
                      }
                      optional
                      variant="compact"
                    />
                    <FileUploadZone
                      title="Adlibs / FX"
                      description="Background components"
                      acceptedTypes=".wav,.mp3,.aiff"
                      onFileUpload={(files) => setAdlibsFile(files[0])}
                      files={
                        adlibsFile
                          ? [{ name: adlibsFile.name, status: "Selected" }]
                          : []
                      }
                      optional
                      variant="compact"
                    />
                  </div>
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
                    Status: {form.watch("status").replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Change status in Track Details. Ready makes the single live
                    for Premium streaming; draft stays private; open verse
                    invites submissions.
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
                    <p className="text-xs text-muted-foreground">
                      Allow fans to purchase this track directly.
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="isForSale"
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

                {form.watch("isForSale") ? (
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
                    <p className="font-semibold">Single price: $1.29</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All singles sell at a fixed $1.29 download price. Premium
                      members can stream ready singles on SoundKit.
                    </p>
                  </div>
                ) : null}

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

                <div className="border-t border-border/40 pt-6 mt-6 space-y-6">
                  {form.watch("status") === "open_verse" && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold">
                          Open Verse Listing Details
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Configure the open slot parameters for artists
                          submitting verses.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="openVerseTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Open Verse Listing Title{" "}
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g. Midnight Vibes (Open Verse Challenge)"
                                  className="bg-background/50 h-9 text-sm"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="openVerseDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Direction / Instructions</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="e.g. Leave a 16 bar verse after the first chorus. Keep it clean!"
                                  className="bg-background/50 min-h-[80px] resize-none text-sm"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="openVerseSlotStartsAt"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Slot Starts At (seconds)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="e.g. 45"
                                    className="bg-background/50 h-9 text-sm"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="openVerseSlotEndsAt"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Slot Ends At (seconds)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="e.g. 75"
                                    className="bg-background/50 h-9 text-sm"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
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
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSelfAsWriter}
                    >
                      Add me as writer
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={creditRole}
                      onValueChange={(value) => {
                        if (value === "songwriter" || value === "producer") {
                          setCreditRole(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[160px] bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="songwriter">Writer</SelectItem>
                        <SelectItem value="producer">Producer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Search by name, stage name, or username"
                      value={creditQuery}
                      onChange={(event) => setCreditQuery(event.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  {creditQuery.trim().length >= 2 ? (
                    <div className="rounded-xl border border-border/40 bg-background/40 p-2 space-y-1">
                      {peopleSearch.isLoading ? (
                        <p className="px-2 py-1 text-xs text-muted-foreground">
                          Searching…
                        </p>
                      ) : null}
                      {(peopleSearch.data ?? []).map((person) => (
                        <button
                          type="button"
                          key={person.userId}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-accent"
                          onClick={() =>
                            addCredit({
                              displayName:
                                person.stageName ??
                                person.displayName ??
                                person.username,
                              inviteEmail: person.email ?? undefined,
                              role: creditRole,
                              userId: person.userId,
                            })
                          }
                        >
                          <span>
                            {person.stageName ?? person.displayName}
                            <span className="ml-2 text-xs text-muted-foreground">
                              @{person.username}
                            </span>
                          </span>
                          <Badge variant="outline" className="capitalize">
                            {creditRole}
                          </Badge>
                        </button>
                      ))}
                      {!peopleSearch.isLoading &&
                      (peopleSearch.data ?? []).length === 0 ? (
                        <p className="px-2 py-1 text-xs text-muted-foreground">
                          No matching people. Try another name.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {form.watch("credits").map((credit, index) => (
                      <Badge
                        key={`${credit.role}-${credit.userId ?? credit.displayName}-${index}`}
                        variant="secondary"
                        className="gap-1 py-1.5 pl-3 pr-1"
                      >
                        <span className="capitalize">{credit.role}:</span>{" "}
                        {credit.displayName}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 rounded-full"
                          onClick={() => removeCredit(index)}
                        >
                          <X className="size-3" />
                        </Button>
                      </Badge>
                    ))}
                    {form.watch("credits").length === 0 ? (
                      <p className="w-full text-xs text-center text-muted-foreground py-4 border-2 border-dashed border-border/20 rounded-xl">
                        No writers or producers added yet.
                      </p>
                    ) : null}
                  </div>
                </div>

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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>
    </div>
  );
}
