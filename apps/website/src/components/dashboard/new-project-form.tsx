"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHog } from "@posthog/react";
import { useRouter } from "@tanstack/react-router";
import {
  Plus,
  X,
  Music,
  ChevronRight,
  ChevronLeft,
  Check,
  FolderPlus,
  Calendar,
  Users,
  CloudUpload,
  ListMusic,
  LayoutGrid,
  GripVertical,
  Trash2,
  Mic2,
  Disc,
  LoaderCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";

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
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const collaboratorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z
    .enum(["featured", "producer", "writer", "engineer"])
    .default("featured"),
});

const projectFormSchema = z.object({
  collaborators: z.array(collaboratorSchema).default([]),
  description: z.string().optional(),
  name: z.string().min(2, "Project name is required"),
  newTracks: z
    .array(
      z.object({
        file: z.any().optional(),
        genre: z.string().min(1, "Genre is required"),
        name: z.string().min(1, "Track name is required"),
      })
    )
    .default([]),
  releaseDate: z.string().optional(),
  selectedExistingTracks: z.array(z.string()).default([]),
  type: z.enum(["album", "ep", "single"]).default("album"),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const mockExistingTracks = [
  { duration: "3:24", genre: "Hip-Hop", id: "t1", name: "Midnight Vibes" },
  { duration: "4:12", genre: "R&B", id: "t2", name: "Night Drive" },
  { duration: "3:45", genre: "Pop", id: "t3", name: "City Lights" },
  { duration: "3:58", genre: "Hip-Hop", id: "t4", name: "Summer Rain" },
];

export function NewProjectForm() {
  const posthog = usePostHog();
  const router = useRouter();
  const [step, setStep] = useState("identity");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCollabName, setNewCollabName] = useState("");
  const [newCollabRole, setNewCollabRole] = useState<
    "featured" | "producer" | "writer" | "engineer"
  >("featured");

  const form = useForm<ProjectFormValues>({
    defaultValues: {
      collaborators: [],
      description: "",
      name: "",
      newTracks: [],
      releaseDate: "",
      selectedExistingTracks: [],
      type: "album",
    },
    resolver: zodResolver(projectFormSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "newTracks",
  });

  const onSubmit = async (values: ProjectFormValues) => {
    if (
      values.selectedExistingTracks.length === 0 &&
      values.newTracks.length === 0
    ) {
      toast({
        description: "Please select existing tracks or upload new ones.",
        title: "No tracks added",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      posthog.capture("project_created", {
        project_type: values.type,
        new_track_count: values.newTracks.length,
        existing_track_count: values.selectedExistingTracks.length,
        collaborator_count: values.collaborators.length,
        has_release_date: Boolean(values.releaseDate),
      });
      toast({
        description: `${values.name} has been queued for processing.`,
        title: "Project Created",
      });
      router.navigate({ to: "/dashboard/projects" });
    } catch (error) {
      posthog.captureException(error);
      toast({
        description: "Failed to create project. Please try again.",
        title: "Error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExistingTrack = (trackId: string) => {
    const current = form.getValues("selectedExistingTracks");
    const updated = current.includes(trackId)
      ? current.filter((id) => id !== trackId)
      : [...current, trackId];
    form.setValue("selectedExistingTracks", updated);
  };

  const handleNewUpload = (files: FileList | File[]) => {
    [...files].forEach((file) => {
      append({
        file,
        genre: "Hip-Hop",
        name: file.name.replace(/\.[^/.]+$/, ""),
      });
    });
  };

  const addCollaborator = () => {
    if (!newCollabName.trim()) {
      return;
    }

    const current = form.getValues("collaborators");
    form.setValue("collaborators", [
      ...current,
      { name: newCollabName.trim(), role: newCollabRole },
    ]);
    setNewCollabName("");
  };

  const removeCollaborator = (index: number) => {
    const current = form.getValues("collaborators");
    form.setValue(
      "collaborators",
      current.filter((_, i) => i !== index)
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
          Back
        </Button>
        <Badge
          variant="outline"
          className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20"
        >
          Collection Workflow
        </Badge>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
          Create New Project
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Bundle your tracks into a cohesive release. Manage artwork, credits,
          and multi-track distribution.
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
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <LayoutGrid className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Project Identity</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Global metadata and collection artwork
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    Main Artwork
                  </Label>
                  <FileUploadZone
                    title="Upload Project Cover"
                    description="Used for the entire collection"
                    acceptedTypes=".png,.jpg,.jpeg"
                    onFileUpload={() => {}}
                    optional
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Project Name{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Summer Sessions"
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
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="album">Full Album</SelectItem>
                            <SelectItem value="ep">
                              EP (Extended Play)
                            </SelectItem>
                            <SelectItem value="single">
                              Single Release
                            </SelectItem>
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
                      <FormLabel>Project Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What's the vibe of this project? Credits, inspiration..."
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
                    onClick={() => setStep("tracks")}
                    className="bg-emerald-500 hover:bg-emerald-600 group text-white"
                  >
                    Next: Manage Tracklist
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 2: TRACKLIST */}
            <AccordionItem
              value="tracks"
              className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border transition-colors",
                      step === "tracks"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <ListMusic className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Tracklist</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Select existing or upload new songs
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                {/* NEW UPLOADS */}
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    Upload New Tracks
                  </Label>
                  <FileUploadZone
                    title="Add New Audio Files"
                    description="Drag multiple files here. Each will become a track."
                    acceptedTypes=".wav,.mp3,.aiff"
                    onFileUpload={handleNewUpload}
                  />

                  {fields.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 animate-in fade-in slide-in-from-top-2 duration-300"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Music className="size-4 text-emerald-500" />
                              <span className="text-sm font-bold">
                                New Track {index + 1}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-full text-destructive hover:bg-destructive/10"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`newTracks.${index}.name`}
                              render={({ field: nameField }) => (
                                <FormItem>
                                  <FormLabel className="text-[10px]">
                                    Track Name
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...nameField}
                                      className="h-8 text-sm bg-background/50"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`newTracks.${index}.genre`}
                              render={({ field: genreField }) => (
                                <FormItem>
                                  <FormLabel className="text-[10px]">
                                    Genre
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...genreField}
                                      className="h-8 text-sm bg-background/50"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* EXISTING TRACKS */}
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Select From Library
                  </Label>
                  <div className="grid grid-cols-1 gap-3">
                    {mockExistingTracks.map((track) => {
                      const isSelected = form
                        .watch("selectedExistingTracks")
                        .includes(track.id);
                      return (
                        <div
                          key={track.id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group",
                            isSelected
                              ? "border-emerald-500/50 bg-emerald-500/10 shadow-sm"
                              : "border-border/40 bg-background/40 hover:border-emerald-500/30"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExistingTrack(track.id);
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                isSelected
                                  ? "bg-emerald-500 border-emerald-500"
                                  : "border-border/60 group-hover:border-emerald-500/40"
                              )}
                            >
                              {isSelected && (
                                <Check
                                  className="size-3 text-white"
                                  strokeWidth={4}
                                />
                              )}
                            </div>
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-emerald-500 transition-colors">
                              <Music className="size-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{track.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] uppercase h-4 px-1"
                                >
                                  {track.genre}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {track.duration}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

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
                    onClick={() => setStep("distribution")}
                    className="bg-emerald-500 hover:bg-emerald-600 group text-white"
                  >
                    Next: Distribution
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 3: DISTRIBUTION */}
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
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Release Plan</h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Date, additional media and promo
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                <FormField
                  control={form.control}
                  name="releaseDate"
                  render={({ field }) => (
                    <FormItem className="max-w-[250px]">
                      <FormLabel>Project Release Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="bg-background/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      EPK / Promo Photos
                    </Label>
                    <FileUploadZone
                      title="Promotional Media"
                      description="Behind-the-scenes content"
                      acceptedTypes=".png,.jpg,.jpeg"
                      onFileUpload={() => {}}
                      optional
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Social Teasers
                    </Label>
                    <FileUploadZone
                      title="Vertical Videos"
                      description="Trailers, snippets, teasers"
                      acceptedTypes=".mp4,.mov"
                      onFileUpload={() => {}}
                      optional
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("tracks")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep("collaboration")}
                    className="bg-emerald-500 hover:bg-emerald-600 group text-white"
                  >
                    Next: Credits & Team
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 4: COLLABORATION (METADATA / TAGGING) */}
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
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-muted text-muted-foreground border-border/40"
                    )}
                  >
                    <Users className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      Credits & Collaboration
                    </h3>
                    <p className="text-xs text-muted-foreground font-normal">
                      Tag featured artists, producers and team
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Search or type name..."
                        value={newCollabName}
                        onChange={(e) => setNewCollabName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addCollaborator())
                        }
                        className="bg-background/50"
                      />
                    </div>
                    <Select
                      value={newCollabRole}
                      onValueChange={(v: any) => setNewCollabRole(v)}
                    >
                      <SelectTrigger className="w-full sm:w-[150px] bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="featured">
                          Featured Artist
                        </SelectItem>
                        <SelectItem value="producer">Producer</SelectItem>
                        <SelectItem value="writer">Writer</SelectItem>
                        <SelectItem value="engineer">Engineer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={addCollaborator}
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Plus className="size-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {form.watch("collaborators").map((collab, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20 group hover:border-emerald-500/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            {collab.role === "producer" ? (
                              <Disc className="size-4" />
                            ) : (
                              <Mic2 className="size-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{collab.name}</p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                              {collab.role}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeCollaborator(index)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    {form.watch("collaborators").length === 0 && (
                      <div className="sm:col-span-2 text-xs text-center text-muted-foreground py-8 border-2 border-dashed border-border/20 rounded-xl">
                        No collaborators tagged yet.
                      </div>
                    )}
                  </div>
                </div>

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
                    className="min-w-[180px] bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                        Creating Project...
                      </>
                    ) : (
                      <>
                        Launch Project
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
