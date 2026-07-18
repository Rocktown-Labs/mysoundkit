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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "@/hooks/use-toast";
import {
  apiClient,
  MEDIA_UPLOAD_URL,
  MEDIA_BASE_URL,
  rpcJson,
  TRACK_SOURCE_UPLOAD_URL,
} from "@/lib/api";
import {
  soundkitQueryKeys,
  useCreateOpenVerseMutation,
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

const trackFormSchema = z
  .object({
    bpm: z.string().optional(),
    collaborators: z.array(z.string().email()).default([]),
    coverObjectKey: z.string().optional(),
    description: z.string().optional(),
    genre: z.string().min(1, "Genre is required"),
    isForSale: z.boolean().default(false),
    isOpenVerse: z.boolean().default(false),
    key: z.string().optional(),
    name: z.string().min(2, "Track name is required"),
    openVerseDescription: z.string().optional(),
    openVerseSlotEndsAt: z.string().optional(),
    openVerseSlotStartsAt: z.string().optional(),
    openVerseTitle: z.string().optional(),
    price: z.string().optional(),
    producers: z.string().optional(),
    productionStatus: z
      .enum(["demo", "mixed", "mastered", "complete"])
      .default("demo"),
    releaseAt: z.string().optional(),
    releaseStrategy: z
      .enum(["private", "publish_when_ready", "scheduled"])
      .default("publish_when_ready"),
    rightsAccepted: z
      .boolean()
      .refine(
        (value) => value,
        "Confirm you have the rights to upload this track"
      ),
    writers: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        data.isOpenVerse &&
        (!data.openVerseTitle || data.openVerseTitle.trim().length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Listing title is required when set as Open Verse",
      path: ["openVerseTitle"],
    }
  );

type TrackFormValues = z.infer<typeof trackFormSchema>;

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
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
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

  const form = useForm<TrackFormValues>({
    defaultValues: {
      bpm: "",
      collaborators: [],
      coverObjectKey: "",
      description: "",
      genre: "",
      isForSale: false,
      isOpenVerse: false,
      key: "",
      name: "",
      openVerseDescription: "",
      openVerseSlotEndsAt: "",
      openVerseSlotStartsAt: "",
      openVerseTitle: "",
      price: "29.99",
      producers: "",
      productionStatus: "demo",
      releaseStrategy: "publish_when_ready",
      rightsAccepted: false,
      writers: "",
    },
    resolver: zodResolver(trackFormSchema),
  });

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
    const price = values.price ? Number(values.price) : undefined;
    const priceCents =
      typeof price === "number" ? Math.round(price * 100) : undefined;
    const track = await rpcJson(
      await tracksPost({
        json: {
          assetIds: [],
          bpm: values.bpm ? Number(values.bpm) : undefined,
          catalogItemType: "single",
          description: values.description || undefined,
          genre: values.genre,
          isForSale: values.isForSale,
          isPublic: values.releaseStrategy !== "private",
          musicalKey: values.key || undefined,
          price,
          priceCents,
          productionStatus: values.productionStatus,
          purchaseMode: "digital_download",
          releaseAt: values.releaseAt || undefined,
          releaseStrategy: values.releaseStrategy,
          sourceObjectKey: objectKey,
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
    try {
      let coverKey = values.coverObjectKey;

      if (selectedCoverFile && !coverKey) {
        const keyPromise = new Promise<string>((resolve) => {
          coverUploadResolverRef.current = resolve;
        });
        void uploadCover([selectedCoverFile]);
        coverKey = await keyPromise;
        if (!coverKey) {
          setIsSubmitting(false);
          return;
        }
      }

      if (!coverKey) {
        toast({
          description: "Cover image is required.",
          title: "Cover image needed",
          variant: "destructive",
        });
        setStep("details");
        setIsSubmitting(false);
        return;
      }

      let trackPreview = uploadedTrack;

      if (selectedMasterFile && !trackPreview) {
        const previewPromise = new Promise<UploadedTrackPreview | null>(
          (resolve) => {
            masterUploadResolverRef.current = resolve;
          }
        );
        void upload([selectedMasterFile]);
        trackPreview = await previewPromise;
        if (!trackPreview) {
          setIsSubmitting(false);
          return;
        }
      }

      if (!trackPreview) {
        toast({
          description: "Upload the master file before completing setup.",
          title: "Master file required",
          variant: "destructive",
        });
        setStep("assets");
        setIsSubmitting(false);
        return;
      }

      if (values.isOpenVerse) {
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

      toast({
        description: `${values.name} is in your dashboard and processing continues in the background.`,
        title: "Track Setup Complete",
      });
      router.navigate({
        params: { id: trackPreview.trackId },
        to: "/dashboard/tracks/$id",
      });
    } catch (error) {
      posthog.captureException(error);
      toast({
        description: "Failed to create track. Please try again.",
        title: "Error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCollaborator = () => {
    const email = collaboratorEmail.trim();
    if (email && z.string().email().safeParse(email).success) {
      const current = form.getValues("collaborators");
      if (!current.includes(email)) {
        form.setValue("collaborators", [...current, email]);
      }
      setCollaboratorEmail("");
    } else {
      toast({
        description: "Please enter a valid collaborator email.",
        title: "Invalid Email",
        variant: "destructive",
      });
    }
  };

  const removeCollaborator = (email: string) => {
    const current = form.getValues("collaborators");
    form.setValue(
      "collaborators",
      current.filter((c) => c !== email)
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="bpm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BPM</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="120"
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
                    name="key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. C Major"
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
                    name="productionStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="demo">Demo / Idea</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                            <SelectItem value="mastered">Mastered</SelectItem>
                            <SelectItem value="complete">Complete</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                          : (coverUpload
                            ? [
                                {
                                  name: coverUpload.fileName,
                                  status: "Uploaded",
                                },
                              ]
                            : [])
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
                            : (uploadedTrack
                              ? [
                                  {
                                    name: uploadedTrack.title,
                                    status: "Uploaded",
                                  },
                                ]
                              : [])
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
                <FormField
                  control={form.control}
                  name="releaseStrategy"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>Release Strategy</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          <FormItem>
                            <FormLabel className="flex flex-col items-center justify-between rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem
                                  value="private"
                                  className="sr-only"
                                />
                              </FormControl>
                              <div className="size-8 rounded-lg bg-muted flex items-center justify-center mb-3">
                                <Clock className="size-4" />
                              </div>
                              <span className="font-bold text-sm">Private</span>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">
                                Keep it as a draft
                              </p>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormLabel className="flex flex-col items-center justify-between rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem
                                  value="publish_when_ready"
                                  className="sr-only"
                                />
                              </FormControl>
                              <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center mb-3 text-primary">
                                <Zap className="size-4 fill-current" />
                              </div>
                              <span className="font-bold text-sm">
                                Auto-Live
                              </span>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">
                                Go live after processing
                              </p>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormLabel className="flex flex-col items-center justify-between rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem
                                  value="scheduled"
                                  className="sr-only"
                                />
                              </FormControl>
                              <div className="size-8 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-3 text-indigo-500">
                                <Calendar className="size-4" />
                              </div>
                              <span className="font-bold text-sm">
                                Scheduled
                              </span>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">
                                Pick a specific date
                              </p>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

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

                {form.watch("isForSale") && (
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem className="max-w-[200px]">
                        <FormLabel>Price (USD)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              $
                            </span>
                            <Input
                              placeholder="29.99"
                              {...field}
                              className="pl-7 bg-background/50"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="border-t border-border/40 pt-6 mt-6 space-y-6">
                  <FormField
                    control={form.control}
                    name="isOpenVerse"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/40 bg-muted/20 p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-semibold">
                            Set as Open Verse
                          </FormLabel>
                          <FormDescription className="text-xs text-muted-foreground font-normal">
                            Allow other artists to submit recorded verses for
                            this track
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("isOpenVerse") && (
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="producers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Producers</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Search friends or type names"
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
                      name="writers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Writers</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Search friends or type names"
                              {...field}
                              className="bg-background/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Collaborator email address"
                      value={collaboratorEmail}
                      onChange={(e) => setCollaboratorEmail(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addCollaborator())
                      }
                      className="bg-background/50"
                    />
                    <Button type="button" onClick={addCollaborator}>
                      Add
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {form.watch("collaborators").map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20"
                      >
                        <span className="text-sm font-medium">{email}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full text-destructive"
                          onClick={() => removeCollaborator(email)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {form.watch("collaborators").length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4 border-2 border-dashed border-border/20 rounded-xl">
                        No collaborators added yet.
                      </p>
                    )}
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
