import { createFileRoute, useRouter } from "@tanstack/react-router";
import { 
  Film, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Upload, 
  Youtube, 
  Info, 
  Play, 
  Sparkles,
  Settings,
  ShieldCheck,
  LoaderCircle,
  Search,
  Music,
  FolderOpen
} from "lucide-react";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SoundKitVideoPlayer } from "@/components/video/soundkit-video-player";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

// Mock data for search
const mockHistory = {
  tracks: [
    { id: "t1", name: "Midnight Vibes", project: "After Dark" },
    { id: "t2", name: "Summer Rain", project: "Summer Sessions" },
    { id: "t3", name: "City Lights", project: "After Dark" },
  ],
  projects: [
    { id: "p1", name: "After Dark", year: "2023" },
    { id: "p2", name: "Summer Sessions", year: "2024" },
  ]
};

const videoFormSchema = z.object({
  title: z.string().min(2, "Video title is required"),
  genre: z.string().min(1, "Genre is required"),
  description: z.string().optional(),
  sourceType: z.enum(["upload", "youtube"]).default("upload"),
  youtubeUrl: z.string().url("Invalid YouTube URL").optional().or(z.literal("")),
  playbackPolicy: z.enum(["public", "signed"]).default("public"),
  sourceTrackId: z.string().optional(),
  sourceProjectId: z.string().optional(),
});

type VideoFormValues = z.infer<typeof videoFormSchema>;

export const Route = createFileRoute("/dashboard/videos/new")({
  component: NewVideoPage,
});

function NewVideoPage() {
  const router = useRouter();
  const [step, setStep] = useState("identity");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [historySearch, setHistorySearch] = useState("");

  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      title: "",
      genre: "",
      description: "",
      sourceType: "upload",
      youtubeUrl: "",
      playbackPolicy: "public",
      sourceTrackId: "",
      sourceProjectId: "",
    },
  });

  const filteredHistory = useMemo(() => {
    const query = historySearch.toLowerCase();
    if (!query) return null;
    return {
      tracks: mockHistory.tracks.filter(t => t.name.toLowerCase().includes(query)),
      projects: mockHistory.projects.filter(p => p.name.toLowerCase().includes(query))
    };
  }, [historySearch]);

  const onSubmit = async (values: VideoFormValues) => {
    if (values.sourceType === "upload" && !videoFile) {
      toast({
        title: "File Required",
        description: "Please select a video file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      toast({
        title: "Video Added",
        description: `${values.title} is now ${values.sourceType === "upload" ? "processing" : "linked"}.`,
      });
      router.navigate({ to: "/dashboard/videos" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectFromHistory = (type: 'track' | 'project', id: string, name: string) => {
    if (type === 'track') {
      form.setValue("sourceTrackId", id);
    } else {
      form.setValue("sourceProjectId", id);
    }
    setHistorySearch("");
    toast({
      title: "Linked Successfully",
      description: `Video linked to ${name}`,
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
        <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20">
          Video Pipeline
        </Badge>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
          Add New Video
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Share your music videos or live performances. We'll handle the hosting or link your external sources.
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
            <AccordionItem value="identity" className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border transition-colors",
                    step === "identity" ? "bg-amber-500 text-white border-amber-500" : "bg-muted text-muted-foreground border-border/40"
                  )}>
                    <Info className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Video Identity</h3>
                    <p className="text-xs text-muted-foreground font-normal">Title, category and track linkage</p>
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
                        <FormLabel>Video Title <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Midnight Vibes Official" {...field} className="bg-background/50" />
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
                        <FormLabel>Genre <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Hip-Hop, Pop" {...field} className="bg-background/50" />
                        </FormControl>
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
                    {filteredHistory && (
                      <Card className="absolute top-full left-0 right-0 z-50 mt-2 bg-card/95 backdrop-blur-xl border-border/40 shadow-2xl max-h-[300px] overflow-y-auto">
                        <CardContent className="p-2 space-y-1">
                          {filteredHistory.tracks.length > 0 && (
                            <div className="p-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Tracks</p>
                              {filteredHistory.tracks.map(track => (
                                <button
                                  key={track.id}
                                  onClick={() => selectFromHistory('track', track.id, track.name)}
                                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition-colors"
                                >
                                  <div className="size-8 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <Music className="size-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{track.name}</p>
                                    <p className="text-[10px] text-muted-foreground">Project: {track.project}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {filteredHistory.projects.length > 0 && (
                            <div className="p-2 border-t border-border/10">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 mt-1">Projects</p>
                              {filteredHistory.projects.map(project => (
                                <button
                                  key={project.id}
                                  onClick={() => selectFromHistory('project', project.id, project.name)}
                                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition-colors"
                                >
                                  <div className="size-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <FolderOpen className="size-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{project.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{project.year}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {form.watch("sourceTrackId") && (
                      <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 pr-1 py-1 h-7">
                        Linked Track: {mockHistory.tracks.find(t => t.id === form.watch("sourceTrackId"))?.name}
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
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 pr-1 py-1 h-7">
                        Linked Project: {mockHistory.projects.find(p => p.id === form.watch("sourceProjectId"))?.name}
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
                  <Button type="button" onClick={() => setStep("source")} className="bg-amber-500 hover:bg-amber-600 group text-white">
                    Next: Choose Source
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 2: SOURCE */}
            <AccordionItem value="source" className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border transition-colors",
                    step === "source" ? "bg-amber-500 text-white border-amber-500" : "bg-muted text-muted-foreground border-border/40"
                  )}>
                    <Upload className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Media Source</h3>
                    <p className="text-xs text-muted-foreground font-normal">Direct upload or external link</p>
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
                          onValueChange={(v: any) => field.onChange(v)} 
                          className="w-full"
                        >
                          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-12 mb-6">
                            <TabsTrigger value="upload" className="flex items-center gap-2 data-[state=active]:bg-background">
                              <Upload className="size-4" />
                              Direct Upload
                            </TabsTrigger>
                            <TabsTrigger value="youtube" className="flex items-center gap-2 data-[state=active]:bg-background">
                              <Youtube className="size-4" />
                              YouTube Link
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="upload" className="space-y-6 mt-0">
                            <div className="p-6 rounded-2xl border-2 border-dashed border-border/40 bg-muted/20 text-center hover:bg-muted/30 transition-colors cursor-pointer group">
                              <input 
                                type="file" 
                                accept="video/*" 
                                className="hidden" 
                                id="video-upload"
                                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                              />
                              <label htmlFor="video-upload" className="cursor-pointer space-y-4 block">
                                <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-500 group-hover:scale-110 transition-transform">
                                  <CloudUpload className="size-6" />
                                </div>
                                <div>
                                  <p className="font-bold">{videoFile ? videoFile.name : "Click to select video file"}</p>
                                  <p className="text-xs text-muted-foreground mt-1">MP4, MOV up to 2GB</p>
                                </div>
                              </label>
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex items-center gap-3">
                              <Sparkles className="size-5 text-amber-500" />
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Pro+ members get SoundKit Verified badges and priority Mux transcoding for 4K playback.
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
                                    <Input placeholder="https://www.youtube.com/watch?v=..." {...urlField} className="bg-background/50" />
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
                  <Button type="button" variant="ghost" onClick={() => setStep("identity")}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep("settings")} className="bg-amber-500 hover:bg-amber-600 group text-white">
                    Next: Settings & Preview
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 3: SETTINGS */}
            <AccordionItem value="settings" className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border transition-colors",
                    step === "settings" ? "bg-amber-500 text-white border-amber-500" : "bg-muted text-muted-foreground border-border/40"
                  )}>
                    <Settings className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Playback Settings</h3>
                    <p className="text-xs text-muted-foreground font-normal">Privacy, preview and final confirmation</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                <div className="rounded-2xl overflow-hidden border border-border/20 bg-black aspect-video relative group">
                  <SoundKitVideoPlayer 
                    title={form.watch("title") || "Preview"} 
                    externalPlaybackUrl={form.watch("sourceType") === "youtube" ? form.watch("youtubeUrl") : undefined}
                    posterUrl="/music-battle-live-performance-video.jpg"
                    verifiedOnPlatform={form.watch("sourceType") === "upload"}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="playbackPolicy"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>Playback Policy</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <FormItem>
                            <FormLabel className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem value="public" className="mt-1" />
                              </FormControl>
                              <div className="space-y-1">
                                <span className="font-bold text-sm">Public Playback</span>
                                <p className="text-[10px] text-muted-foreground">Available to everyone on SoundKit.</p>
                              </div>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormLabel className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem value="signed" className="mt-1" />
                              </FormControl>
                              <div className="space-y-1">
                                <span className="font-bold text-sm">Signed Access</span>
                                <p className="text-[10px] text-muted-foreground">Only accessible via gated/premium links.</p>
                              </div>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep("source")}>
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="min-w-[160px] bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                        Adding Video...
                      </>
                    ) : (
                      <>
                        Confirm & Save
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

import { CloudUpload, Calendar, X } from "lucide-react";
