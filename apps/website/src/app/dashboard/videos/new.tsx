import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CloudUpload,
  FolderOpen,
  Info,
  LoaderCircle,
  Lock,
  Music,
  Search,
  Settings,
  Sparkles,
  Upload,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFormDraftGuard } from "@/hooks/use-form-draft-guard";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import {
  useGenresQuery,
  useMeEntitlementsQuery,
  useProjectsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";
import { uploadVideoFile, validateVideoFile } from "@/lib/video-upload";

const SUPPORTED_GENRES = [
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

 videoFormSchema = z.object({
  description: z.string().optional(),
  genre: z.string().min(1, "Genre is required"),
  playbackPolicy: z.literal("public").default("public"),
  releaseAt: z.string().optional(),
  sourceProjectId: z.string().optional(),
  sourceTrackId: z.string().optional(),
  sourceType: z.enum(["upload", "youtube"]).default("upload"),
  title: z.string().min(2, "Video title is required"),
  videoKind: z
    .enum([
      "music_video",
      "promo",
      "teaser",
      "battle_replay",
      "battle_clip",
      "live_recording",
    ])
    .default("music_video"),
  visibility: z.enum(["public", "private"]).default("public"),
  youtubeUrl: z
    .string()
    .url("Invalid YouTube URL")
    .optional()
    .or(z.literal("")),
});

type VideoFormValues = z.infer<typeof videoFormSchema>;

export const Route = createFileRoute("/dashboard/videos/new")({
  component: NewVideoPage,
});

function PremiumUploadUpsell() {
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card/90 to-primary/5 p-6 text-center space-y-4">
      <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        <Zap className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-lg">Verified uploads require Premium</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Upgrade to a Premium Artist subscription to upload music videos hosted
          on SoundKit with Mux transcoding and verified badges.
        </p>
      </div>
      <Button asChild className="shadow-md">
        <Link to="/dashboard/billing">
          <Zap className="mr-2 size-4" />
          Upgrade Account
        </Link>
      </Button>
    </div>
  );
}

function SelectedVideoFile({
  onClearFile,
  videoFile,
}: {
  onClearFile: () => void;
  videoFile: File;
}) {
  return (
    <Card className="border border-primary/40 bg-card/60 p-4 rounded-2xl space-y-3">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-primary/20">
        <video
          src={URL.createObjectURL(videoFile)}
          controls
          className="size-full object-contain"
        >
          <track kind="captions" />
        </video>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-sm text-foreground flex items-center gap-2">
            {videoFile.name}
            <Badge
              variant="secondary"
              className="text-[9px] uppercase bg-emerald-500/20 text-emerald-300 font-bold"
            >
              Video Ready
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {(videoFile.size / (1024 * 1024)).toFixed(1)} MB •{" "}
            {videoFile.type || "video/mp4"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={onClearFile}
        >
          <X className="size-3.5 mr-1" />
          Change Video
        </Button>
      </div>
    </Card>
  );
}

function VideoSourcePanel({
  isEntitlementsLoading,
  isPremium,
  onFileSelected,
  videoFile,
}: {
  isEntitlementsLoading: boolean;
  isPremium: boolean;
  onFileSelected: (file: File | null) => void;
  videoFile: File | null;
}) {
  if (isPremium === false && !isEntitlementsLoading) {
    return <PremiumUploadUpsell />;
  }

  if (videoFile) {
    return (
      <SelectedVideoFile
        onClearFile={() => onFileSelected(null)}
        videoFile={videoFile}
      />
    );
  }

  return (
    <div className="p-6 rounded-2xl border-2 border-dashed border-border/40 bg-muted/20 text-center hover:bg-muted/30 transition-colors cursor-pointer group">
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        id="video-upload"
        onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
      />
      <label htmlFor="video-upload" className="cursor-pointer space-y-4 block">
        <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-500 group-hover:scale-110 transition-transform">
          <CloudUpload className="size-6" />
        </div>
        <div>
          <p className="font-bold">Click or drag to select video file</p>
          <p className="text-xs text-muted-foreground mt-1">
            MP4, MOV, WEBM up to 2GB
          </p>
        </div>
      </label>
    </div>
  );
}

function SubmitButtonContent({
  isSubmitting,
  isUploading,
  uploadProgress,
}: {
  isSubmitting: boolean;
  isUploading: boolean;
  uploadProgress: number | null;
}) {
  if (!isSubmitting) {
    return (
      <>
        Confirm & Save
        <Check className="ml-2 size-4" />
      </>
    );
  }

  return (
    <>
      <LoaderCircle className="mr-2 size-4 animate-spin" />
      {isUploading
        ? `Uploading ${Math.round(uploadProgress ?? 0)}%`
        : "Adding Video..."}
    </>
  );
}

type FilteredHistory = {
  projects: { id: string; title: string; trackCount: number }[];
  tracks: { id: string; title: string; genre: string }[];
} | null;

function LinkHistoryDropdown({
  filteredHistory,
  onSelect,
}: {
  filteredHistory: FilteredHistory;
  onSelect: (kind: "track" | "project", id: string, title: string) => void;
}) {
  if (!filteredHistory) {
    return null;
  }

  return (
    <Card className="absolute top-full left-0 right-0 z-50 mt-2 bg-card/95 backdrop-blur-xl border-border/40 shadow-2xl max-h-[300px] overflow-y-auto">
      <CardContent className="p-2 space-y-1">
        {filteredHistory.tracks.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Tracks
            </p>
            {filteredHistory.tracks.map((track) => (
              <button
                type="button"
                key={track.id}
                onClick={() => onSelect("track", track.id, track.title)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition-colors"
              >
                <div className="size-8 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Music className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{track.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {track.genre}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        {filteredHistory.projects.length > 0 && (
          <div className="p-2 border-t border-border/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 mt-1">
              Projects
            </p>
            {filteredHistory.projects.map((project) => (
              <button
                type="button"
                key={project.id}
                onClick={() => onSelect("project", project.id, project.title)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition-colors"
              >
                <div className="size-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <FolderOpen className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{project.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {project.trackCount} tracks
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewVideoPage() {
  const router = useRouter(),
   [step, setStep] = useState("identity"),
   [isSubmitting, setIsSubmitting] = useState(false),
   [uploadProgress, setUploadProgress] = useState<number | null>(null),
   [videoFile, setVideoFile] = useState<File | null>(null),
   [historySearch, setHistorySearch] = useState(""),
   { data: entitlements, isLoading: isEntitlementsLoading } =
    useMeEntitlementsQuery(),
   projectsQuery = useProjectsQuery(),
   tracksQuery = useTracksQuery(undefined, { scope: "dashboard" }),
   genresQuery = useGenresQuery(),
   isPremium = entitlements?.isPremium ?? true,

   form = useForm<VideoFormValues>({
    defaultValues: {
      description: "",
      genre: "",
      playbackPolicy: "public",
      releaseAt: "",
      sourceProjectId: "",
      sourceTrackId: "",
      sourceType: "upload",
      title: "",
      videoKind: "music_video",
      visibility: "public",
      youtubeUrl: "",
    },
    resolver: zodResolver(videoFormSchema),
  }),

   availableGenres = Array.isArray(genresQuery.data)
    ? genresQuery.data
        .map((genre) =>
          typeof genre === "string"
            ? genre
            : (typeof genre === "object" && genre && "name" in genre
              ? String(genre.name)
              : null)
        )
        .filter((genre): genre is string => Boolean(genre))
    : [...SUPPORTED_GENRES],

   { allowNavigation, blockerDialog, clearDraft } = useFormDraftGuard({
    additionalDirtyState: Boolean(videoFile),
    defaultValues: {
      description: "",
      genre: "",
      playbackPolicy: "public",
      releaseAt: "",
      sourceProjectId: "",
      sourceTrackId: "",
      sourceType: "upload",
      title: "",
      videoKind: "music_video",
      visibility: "public",
      youtubeUrl: "",
    },
    form,
    storageKey: "soundkit:new-video-draft",
  }),

   filteredHistory = useMemo(() => {
    const query = historySearch.toLowerCase();
    if (!query) {
      return null;
    }
    return {
      projects: (projectsQuery.data ?? []).filter((project) =>
        project.title.toLowerCase().includes(query)
      ),
      tracks: (tracksQuery.data ?? []).filter((track) =>
        track.title.toLowerCase().includes(query)
      ),
    };
  }, [historySearch, projectsQuery.data, tracksQuery.data]),

   onFileSelected = (file: File | null) => {
    if (!file) {
      setVideoFile(null);
      return;
    }

    const validationError = validateVideoFile(file);

    if (validationError) {
      toast({
        description: validationError,
        title: "Invalid Video",
        variant: "destructive",
      });
      return;
    }

    setVideoFile(file);
  },

   onSubmit = async (values: VideoFormValues) => {
    if (values.sourceType === "upload" && !videoFile) {
      toast({
        description: "Please select a video file to upload.",
        title: "File Required",
        variant: "destructive",
      });
      return;
    }

    if (values.sourceType === "upload" && !isPremium) {
      toast({
        description: "A premium artist subscription is required to upload.",
        title: "Premium Required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const isPublic = values.visibility === "public" && !values.releaseAt;
      if (values.sourceType === "upload" && videoFile) {
        const createResponse = await fetch(
          `${API_V1_URL}/videos/direct-upload`,
          {
            body: JSON.stringify({
              description: values.description || undefined,
              genre: values.genre,
              isPublic,
              playbackPolicy: "public",
              releaseAt: values.releaseAt || undefined,
              sourceProjectId: values.sourceProjectId || undefined,
              sourceTrackId: values.sourceTrackId || undefined,
              title: values.title,
              videoKind: values.videoKind,
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        ),
         createPayload = (await createResponse.json()) as {
          message?: string;
          uploadUrl?: string;
        };

        if (!createResponse.ok) {
          throw new Error(createPayload.message ?? "Failed to create upload.");
        }

        if (createPayload.uploadUrl) {
          await uploadVideoFile({
            file: videoFile,
            onProgress: setUploadProgress,
            uploadUrl: createPayload.uploadUrl,
          });
        }
      } else {
        const createResponse = await fetch(`${API_V1_URL}/videos`, {
          body: JSON.stringify({
            description: values.description || undefined,
            externalPlaybackUrl: values.youtubeUrl,
            genre: values.genre,
            isPublic,
            playbackPolicy: "public",
            releaseAt: values.releaseAt || undefined,
            sourceProjectId: values.sourceProjectId || undefined,
            sourceProvider: "external",
            sourceTrackId: values.sourceTrackId || undefined,
            title: values.title,
            videoKind: values.videoKind,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
         payload = (await createResponse.json()) as { message?: string };

        if (!createResponse.ok) {
          throw new Error(payload.message ?? "Failed to save external video.");
        }
      }

      allowNavigation();
      clearDraft();
      toast({
        description: `${values.title} is now ${values.sourceType === "upload" ? "processing" : "linked"}.`,
        title: "Video Added",
      });
      router.navigate({ to: "/dashboard/videos" });
    } catch {
      toast({
        description: "Failed to add video. Please try again.",
        title: "Error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  },

   selectFromHistory = (
    type: "track" | "project",
    id: string,
    name: string
  ) => {
    if (type === "track") {
      form.setValue("sourceTrackId", id);
    } else {
      form.setValue("sourceProjectId", id);
    }
    setHistorySearch("");
    toast({
      description: `Video linked to ${name}`,
      title: "Linked Successfully",
    });
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
          Back to Library
        </Button>
        <Badge
          variant="outline"
          className="bg-amber-500/5 text-amber-500 border-amber-500/20"
        >
          Video Pipeline
        </Badge>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
          Add New Video
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Share your music videos or live performances. We will handle the
          hosting or link your external sources.
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
            {/* STEP 1: IDENTITY */}
            <AccordionItem
              value="identity"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "identity"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <Info className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Video Identity</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Title, category and track linkage
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Video Title{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Midnight Vibes Official"
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
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select a genre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableGenres.map((genre) => (
                              <SelectItem key={genre} value={genre}>
                                {genre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Link to Release (Optional)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search your tracks or projects..."
                      className="pl-9 bg-background/50"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                    />
                    <LinkHistoryDropdown
                      filteredHistory={filteredHistory}
                      onSelect={selectFromHistory}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {form.watch("sourceTrackId") && (
                      <Badge
                        variant="secondary"
                        className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 pr-1 py-1 h-7"
                      >
                        Linked Track:{" "}
                        {
                          (tracksQuery.data ?? []).find(
                            (t) => t.id === form.watch("sourceTrackId")
                          )?.title
                        }
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 ml-1 rounded-full hover:bg-indigo-500/20"
                          onClick={() => form.setValue("sourceTrackId", "")}
                        >
                          <X className="size-3" />
                        </Button>
                      </Badge>
                    )}
                    {form.watch("sourceProjectId") && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 pr-1 py-1 h-7"
                      >
                        Linked Project:{" "}
                        {
                          (projectsQuery.data ?? []).find(
                            (p) => p.id === form.watch("sourceProjectId")
                          )?.title
                        }
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 ml-1 rounded-full hover:bg-emerald-500/20"
                          onClick={() => form.setValue("sourceProjectId", "")}
                        >
                          <X className="size-3" />
                        </Button>
                      </Badge>
                    )}
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
                          placeholder="Video credits, director, and story..."
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
                    onClick={() => setStep("source")}
                    className="bg-amber-500 hover:bg-amber-600 group text-white"
                  >
                    Next: Choose Source
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 2: SOURCE */}
            <AccordionItem
              value="source"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "source"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <Upload className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Media Source</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Direct upload or external link
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Tabs
                          value={field.value}
                          onValueChange={(value) =>
                            field.onChange(
                              value as VideoFormValues["sourceType"]
                            )
                          }
                          className="w-full"
                        >
                          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-12 mb-6">
                            <TabsTrigger
                              value="upload"
                              disabled={
                                isPremium === false && !isEntitlementsLoading
                              }
                              className="flex items-center gap-2 data-[state=active]:bg-background"
                            >
                              {isPremium === false && !isEntitlementsLoading ? (
                                <Lock className="size-4" />
                              ) : (
                                <Upload className="size-4" />
                              )}
                              Direct Upload
                            </TabsTrigger>
                            <TabsTrigger
                              value="youtube"
                              className="flex items-center gap-2 data-[state=active]:bg-background"
                            >
                              <Youtube className="size-4" />
                              YouTube Link
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent
                            value="upload"
                            className="space-y-6 mt-0"
                          >
                            <VideoSourcePanel
                              isEntitlementsLoading={isEntitlementsLoading}
                              isPremium={isPremium}
                              onFileSelected={onFileSelected}
                              videoFile={videoFile}
                            />

                            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex items-center gap-3">
                              <Sparkles className="size-5 text-amber-500" />
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Pro+ members get SoundKit Verified badges and
                                priority Mux transcoding for 4K playback.
                              </p>
                            </div>
                          </TabsContent>

                          <TabsContent value="youtube" className="mt-0">
                            <FormField
                              control={form.control}
                              name="youtubeUrl"
                              render={({ field: urlField }) => (
                                <FormItem>
                                  <FormLabel>YouTube URL</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      {...urlField}
                                      className="bg-background/50"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TabsContent>
                        </Tabs>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("identity")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep("settings")}
                    className="bg-amber-500 hover:bg-amber-600 group text-white"
                  >
                    Next: Settings & Preview
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 3: VISIBILITY & RELEASE */}
            <AccordionItem
              value="settings"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "settings"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <Settings className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Visibility & Release</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Privacy, release date and final confirmation
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                {isSubmitting &&
                uploadProgress !== null &&
                form.watch("sourceType") === "upload" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Uploading to Mux</span>
                      <span className="text-muted-foreground">
                        {Math.round(uploadProgress)}%
                      </span>
                    </div>
                    <Progress value={uploadProgress} />
                    <p className="text-xs text-muted-foreground">
                      Large files upload in chunks so they can resume if your
                      connection drops.
                    </p>
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>Visibility</FormLabel>
                      <FormControl>
                        <RadioGroup
                          defaultValue={field.value}
                          onValueChange={(value) =>
                            field.onChange(
                              value as VideoFormValues["visibility"]
                            )
                          }
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <FormItem>
                            <FormLabel className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem
                                  value="public"
                                  className="mt-1"
                                />
                              </FormControl>
                              <div className="space-y-1">
                                <span className="font-bold text-sm">
                                  Public
                                </span>
                                <p className="text-[10px] text-muted-foreground">
                                  Available to everyone on SoundKit.
                                </p>
                              </div>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormLabel className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem
                                  value="private"
                                  className="mt-1"
                                />
                              </FormControl>
                              <div className="space-y-1">
                                <span className="font-bold text-sm">
                                  Private
                                </span>
                                <p className="text-[10px] text-muted-foreground">
                                  Only you can see this video.
                                </p>
                              </div>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="releaseAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Release Date</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          className="bg-background/50"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to go live immediately. Private videos
                        ignore this date.
                      </p>
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("source")}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[160px] bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                  >
                    <SubmitButtonContent
                      isSubmitting={isSubmitting}
                      isUploading={
                        form.watch("sourceType") === "upload" &&
                        uploadProgress !== null
                      }
                      uploadProgress={uploadProgress}
                    />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>
      {blockerDialog}
    </div>
  );
}
