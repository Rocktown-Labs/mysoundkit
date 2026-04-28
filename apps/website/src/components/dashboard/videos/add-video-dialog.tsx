"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Film,
  LoaderCircle,
  Radio,
  Sparkles,
  Youtube,
  Upload,
  ArrowLeft,
  ArrowRight,
  Check,
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SoundKitVideoPlayer } from "@/components/video/soundkit-video-player";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";

const videoFormSchema = z.object({
  description: z.string().optional(),
  genre: z.string().min(1, "Please select a genre"),
  playbackPolicy: z.enum(["public", "signed"]).default("public"),
  sourceProjectId: z.string().optional(),
  sourceTrackId: z.string().min(1, "Track ID is required"),
  sourceType: z.enum(["upload", "youtube"]).default("upload"),
  title: z.string().min(2, "Title must be at least 2 characters"),
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

export function AddVideoDialog({ isOpen, onOpenChange }: AddVideoDialogProps) {
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{
    muxPlaybackId?: string;
    externalPlaybackUrl?: string;
    title: string;
  } | null>(null);

  const form = useForm<VideoFormValues>({
    defaultValues: {
      description: "",
      genre: "",
      playbackPolicy: "public",
      sourceProjectId: "",
      sourceTrackId: "",
      sourceType: "upload",
      title: "",
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
      if (values.sourceType === "upload") {
        // Handle Mux Upload
        const createResponse = await fetch(
          `${API_V1_URL}/videos/direct-upload`,
          {
            body: JSON.stringify({
              title: values.title,
              sourceTrackId: values.sourceTrackId,
              sourceProjectId: values.sourceProjectId || undefined,
              playbackPolicy: values.playbackPolicy,
              description: values.description || undefined,
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );

        const createPayload = await createResponse.json();
        if (!createResponse.ok || !createPayload.uploadUrl) {
          throw new Error(createPayload.message || "Failed to create upload");
        }

        await fetch(createPayload.uploadUrl, {
          body: videoFile,
          headers: { "Content-Type": videoFile!.type },
          method: "PUT",
        });

        toast({
          description: "Your video is being processed by Mux.",
          title: "Upload started",
        });
      } else {
        // Handle YouTube Link
        // In a real app, this would call an API to save the link
        toast({
          description: "Your YouTube video has been linked successfully.",
          title: "Video linked",
        });
      }

      onOpenChange(false);
      setStep(1);
      form.reset();
      setVideoFile(null);
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
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select genre" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                                <SelectItem value="r-and-b">R&B</SelectItem>
                                <SelectItem value="pop">Pop</SelectItem>
                                <SelectItem value="electronic">
                                  Electronic
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
                              onValueChange={(v) => field.onChange(v)}
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-12">
                                <TabsTrigger
                                  value="upload"
                                  className="flex items-center gap-2 data-[state=active]:bg-card"
                                >
                                  <Upload className="size-4" />
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
                                  <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                      Video File
                                    </Label>
                                    <Input
                                      type="file"
                                      accept="video/*"
                                      onChange={(e) =>
                                        setVideoFile(
                                          e.target.files?.[0] || null
                                        )
                                      }
                                      className="bg-card/50"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                      Max file size: 2GB. Supported: MP4, MOV,
                                      WebM.
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
                                          onValueChange={policyField.onChange}
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
                                            <SelectItem value="signed">
                                              Signed (Gated/Premium only)
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )}
                                  />
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
                    {isUploading ? (
                      <>
                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                        Processing...
                      </>
                    ) : (step === 1 ? (
                      <>
                        Next: Preview
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    ) : (
                      <>
                        Confirm & Save
                        <Check className="ml-2 size-4" />
                      </>
                    ))}
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

function Label({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
