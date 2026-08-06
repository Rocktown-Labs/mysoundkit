"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Film,
  LoaderCircle,
  Lock,
  Sparkles,
  Upload,
  Youtube,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SoundKitVideoPlayer } from "@/components/video/soundkit-video-player";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import { useMeEntitlementsQuery } from "@/lib/soundkit-api-hooks";
import { uploadVideoFile, validateVideoFile } from "@/lib/video-upload";

const videoFormSchema = z.object({
  description: z.string().optional(),
  genre: z.string().min(1, "Please select a genre"),
  playbackPolicy: z.literal("public").default("public"),
  sourceProjectId: z.string().optional(),
  sourceTrackId: z.string().optional(),
  sourceType: z.enum(["upload", "youtube"]).default("upload"),
  title: z.string().min(2, "Title must be at least 2 characters"),
  videoKind: z.literal("music_video").default("music_video"),
  youtubeUrl: z
    .string()
    .url("Invalid YouTube URL")
    .optional()
    .or(z.literal("")),
});

type VideoFormValues = z.infer<typeof videoFormSchema>;

interface AddVideoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const uploadDirectVideo = async (
  values: VideoFormValues,
  videoFile: File,
  onProgress: (percent: number) => void
): Promise<void> => {
  const createResponse = await fetch(`${API_V1_URL}/videos/direct-upload`, {
    body: JSON.stringify({
      description: values.description || undefined,
      playbackPolicy: values.playbackPolicy,
      sourceProjectId: values.sourceProjectId || undefined,
      sourceTrackId: values.sourceTrackId || undefined,
      title: values.title,
      videoKind: values.videoKind,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  const createPayload = (await createResponse.json()) as {
    message?: string;
    uploadUrl?: string;
  };
  if (!createResponse.ok || !createPayload.uploadUrl) {
    throw new Error(createPayload.message ?? "Failed to create upload.");
  }

  await uploadVideoFile({
    file: videoFile,
    onProgress,
    uploadUrl: createPayload.uploadUrl,
  });
};

const saveExternalVideo = async (values: VideoFormValues): Promise<void> => {
  const createResponse = await fetch(`${API_V1_URL}/videos`, {
    body: JSON.stringify({
      description: values.description || undefined,
      externalPlaybackUrl: values.youtubeUrl,
      playbackPolicy: "public",
      sourceProjectId: values.sourceProjectId || undefined,
      sourceProvider: "external",
      sourceTrackId: values.sourceTrackId || undefined,
      title: values.title,
      videoKind: values.videoKind,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const createPayload = (await createResponse.json()) as {
    message?: string;
  };

  if (!createResponse.ok) {
    throw new Error(createPayload.message ?? "Failed to save external video.");
  }
};

export function AddVideoDialog({ isOpen, onOpenChange }: AddVideoDialogProps) {
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{
    muxPlaybackId?: string;
    externalPlaybackUrl?: string;
    title: string;
  } | null>(null);
  const { data: entitlements, isLoading: isEntitlementsLoading } =
    useMeEntitlementsQuery();
  const isPremium = entitlements?.isPremium ?? true;

  const form = useForm<VideoFormValues>({
    defaultValues: {
      description: "",
      genre: "",
      playbackPolicy: "public",
      sourceProjectId: "",
      sourceTrackId: "",
      sourceType: "upload",
      title: "",
      videoKind: "music_video",
      youtubeUrl: "",
    },
    resolver: zodResolver(videoFormSchema),
  });

  const sourceType = form.watch("sourceType");

  const onSubmit = async (values: VideoFormValues) => {
    if (values.sourceType === "upload" && !videoFile) {
      toast({
        description: "Please select a video file to upload.",
        title: "File required",
        variant: "destructive",
      });
      return;
    }

    if (values.sourceType === "upload" && !isPremium) {
      toast({
        description: "A premium artist subscription is required to upload.",
        title: "Premium required",
        variant: "destructive",
      });
      return;
    }

    if (step === 1) {
      // Prepare preview
      setPreviewData({
        externalPlaybackUrl:
          values.sourceType === "youtube" ? values.youtubeUrl : undefined,
        title: values.title,
        // For upload, we don't have a playback ID yet, so it will show the placeholder
      });
      setStep(2);
      return;
    }

    // Final submission
    setIsUploading(true);
    try {
      if (values.sourceType === "upload" && videoFile) {
        await uploadDirectVideo(values, videoFile, setUploadProgress);
        toast({
          description: "Your video is being processed by Mux.",
          title: "Upload started",
        });
      } else {
        await saveExternalVideo(values);
        toast({
          description: "Your YouTube video has been linked successfully.",
          title: "Video linked",
        });
      }

      onOpenChange(false);
      setStep(1);
      form.reset();
      setVideoFile(null);
      setUploadProgress(null);
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Something went wrong",
        title: "Error",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  let submitButtonContent = (
    <>
      Confirm & Save
      <Check className="ml-2 size-4" />
    </>
  );
  if (step === 1) {
    submitButtonContent = (
      <>
        Next: Preview
        <ArrowRight className="ml-2 size-4" />
      </>
    );
  }
  if (isUploading) {
    submitButtonContent = (
      <>
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        {uploadProgress !== null && sourceType === "upload"
          ? `Uploading ${Math.round(uploadProgress)}%`
          : "Processing..."}
      </>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!isUploading) {
          onOpenChange(open);
          if (!open) {
            setTimeout(() => {
              setStep(1);
              form.reset();
              setVideoFile(null);
            }, 300);
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-border/40 p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-[family-name:var(--font-playfair)] flex items-center gap-2">
              <Film className="size-6 text-primary" />
              {step === 1 ? "Add New Video" : "Confirm & Preview"}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? "Enter the details for your new music video or live performance."
                : "Review how your video will appear on the platform."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {step === 1 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Video Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Midnight Vibes Official"
                                {...field}
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
                            <FormLabel>Genre</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(value)}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select genre" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Afrobeats">
                                  Afrobeats
                                </SelectItem>
                                <SelectItem value="Electronic">
                                  Electronic
                                </SelectItem>
                                <SelectItem value="Hip-Hop">Hip-Hop</SelectItem>
                                <SelectItem value="Jazz">Jazz</SelectItem>
                                <SelectItem value="Latin">Latin</SelectItem>
                                <SelectItem value="Pop">Pop</SelectItem>
                                <SelectItem value="R&B/Soul">
                                  R&B/Soul
                                </SelectItem>
                                <SelectItem value="Rock">Rock</SelectItem>
                                <SelectItem value="Spoken Word">
                                  Spoken Word
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sourceTrackId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Track ID</FormLabel>
                            <FormControl>
                              <Input placeholder="track_id_123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sourceProjectId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project ID (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="project_id_456" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="sourceType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Source Type</FormLabel>
                          <FormControl>
                            <Tabs
                              defaultValue={field.value}
                              onValueChange={(value) =>
                                field.onChange(
                                  value as VideoFormValues["sourceType"]
                                )
                              }
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-12">
                                <TabsTrigger
                                  value="upload"
                                  disabled={
                                    isPremium === false &&
                                    !isEntitlementsLoading
                                  }
                                  className="flex items-center gap-2 data-[state=active]:bg-card"
                                >
                                  {isPremium === false &&
                                  !isEntitlementsLoading ? (
                                    <Lock className="size-4" />
                                  ) : (
                                    <Upload className="size-4" />
                                  )}
                                  Direct Upload
                                </TabsTrigger>
                                <TabsTrigger
                                  value="youtube"
                                  className="flex items-center gap-2 data-[state=active]:bg-card"
                                >
                                  <Youtube className="size-4" />
                                  YouTube Link
                                </TabsTrigger>
                              </TabsList>
                              <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-4">
                                <TabsContent
                                  value="upload"
                                  className="mt-0 space-y-4"
                                >
                                  {isPremium === false &&
                                  !isEntitlementsLoading ? (
                                    <div className="space-y-3 text-center py-2">
                                      <div className="mx-auto size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <Zap className="size-5" />
                                      </div>
                                      <p className="text-sm font-semibold">
                                        Verified uploads require Premium
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Upgrade to upload music videos hosted on
                                        SoundKit with Mux transcoding.
                                      </p>
                                      <Button asChild size="sm">
                                        <Link to="/dashboard/billing">
                                          <Zap className="mr-2 size-3.5" />
                                          Upgrade Account
                                        </Link>
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                          Video File
                                        </Label>
                                        <Input
                                          type="file"
                                          accept="video/mp4,video/quicktime,video/webm"
                                          onChange={(e) => {
                                            const file =
                                              e.target.files?.[0] || null;
                                            if (!file) {
                                              setVideoFile(null);
                                              return;
                                            }
                                            const validationError =
                                              validateVideoFile(file);
                                            if (validationError) {
                                              toast({
                                                description: validationError,
                                                title: "Invalid video",
                                                variant: "destructive",
                                              });
                                              e.target.value = "";
                                              setVideoFile(null);
                                              return;
                                            }
                                            setVideoFile(file);
                                          }}
                                          className="bg-card/50"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                          Max file size: 2GB. Supported: MP4,
                                          MOV, WebM.
                                        </p>
                                      </div>
                                      <FormField
                                        control={form.control}
                                        name="playbackPolicy"
                                        render={({ field: policyField }) => (
                                          <FormItem>
                                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                              Playback Policy
                                            </FormLabel>
                                            <Select
                                              onValueChange={(value) =>
                                                policyField.onChange(value)
                                              }
                                              defaultValue={policyField.value}
                                            >
                                              <FormControl>
                                                <SelectTrigger className="bg-card/50">
                                                  <SelectValue placeholder="Select policy" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="public">
                                                  Public (Everyone can view)
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />
                                    </>
                                  )}
                                </TabsContent>
                                <TabsContent value="youtube" className="mt-0">
                                  <FormField
                                    control={form.control}
                                    name="youtubeUrl"
                                    render={({ field: urlField }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                          YouTube URL
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            {...urlField}
                                            className="bg-card/50"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </TabsContent>
                              </div>
                            </Tabs>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-2xl overflow-hidden border border-border/50 bg-black">
                      <SoundKitVideoPlayer
                        title={previewData?.title || "Preview"}
                        externalPlaybackUrl={previewData?.externalPlaybackUrl}
                        muxPlaybackId={previewData?.muxPlaybackId}
                        posterUrl="/music-battle-video-thumbnail.jpg"
                        verifiedOnPlatform={sourceType === "upload"}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm bg-muted/30 p-4 rounded-xl border border-border/20">
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                          Title
                        </p>
                        <p className="mt-1 font-semibold">
                          {form.getValues("title")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                          Genre
                        </p>
                        <p className="mt-1 font-semibold capitalize">
                          {form.getValues("genre")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                          Source
                        </p>
                        <p className="mt-1 font-semibold capitalize">
                          {sourceType === "upload"
                            ? "Direct Mux Upload"
                            : "External YouTube Link"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                          Track ID
                        </p>
                        <p className="mt-1 font-semibold">
                          {form.getValues("sourceTrackId")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-4 border-t border-border/40">
                  {step === 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      disabled={isUploading}
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back to details
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="min-w-[140px]"
                    disabled={isUploading}
                  >
                    {submitButtonContent}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>

        {step === 1 && (
          <div className="bg-primary/5 border-t border-border/40 p-4 flex items-center gap-3">
            <Sparkles className="size-5 text-primary" />
            <p className="text-xs text-muted-foreground">
              Verified uploads are optimized by Mux for the highest quality
              playback across all devices.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
