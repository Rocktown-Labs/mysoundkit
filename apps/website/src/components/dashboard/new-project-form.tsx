"use client";
/* eslint-disable complexity, import/first, no-empty-function, no-nested-ternary, no-promise-executor-return, promise/avoid-new, promise/prefer-await-to-then, react/jsx-handler-names, require-await, require-unicode-regexp, unicorn/max-nested-calls */

import { useUploadFiles } from "@better-upload/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHog } from "@posthog/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  Plus,
  X,
  Music,
  ChevronRight,
  ChevronLeft,
  Check,
  Calendar,
  Users,
  ListMusic,
  LayoutGrid,
  Trash2,
  Mic2,
  Disc,
  LoaderCircle,
  RotateCcw,
  Info,
} from "lucide-react";
import { useState, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";

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
] as const;

import { FileUploadZone } from "@/components/dashboard/file-upload-zone";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormDraftGuard } from "@/hooks/use-form-draft-guard";
import { toast } from "@/hooks/use-toast";
import {
  apiClient,
  MEDIA_BASE_URL,
  MEDIA_UPLOAD_URL,
  PROJECT_ASSETS_UPLOAD_URL,
  rpcJson,
} from "@/lib/api";
import {
  soundkitQueryKeys,
  useCreateProjectMutation,
  useGenresQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

const collaboratorRoles = [
  "featured",
  "producer",
  "writer",
  "engineer",
] as const;

type CollaboratorRole = (typeof collaboratorRoles)[number];

const isCollaboratorRole = (value: string): value is CollaboratorRole =>
  collaboratorRoles.includes(value as CollaboratorRole);

const collaboratorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z
    .enum(["featured", "producer", "writer", "engineer"])
    .default("featured"),
});

const projectFormSchema = z.object({
  collaborators: z.array(collaboratorSchema).default([]),
  description: z.string().optional(),
  genre: z
    .string()
    .min(1, "Project primary genre is required")
    .default("R&B/Soul"),
  name: z.string().min(2, "Project name is required"),
  newTracks: z
    .array(
      z.object({
        assetId: z.string().optional(),
        file: z.any().optional(),
        fileName: z.string().optional(),
        genre: z.string().min(1, "Genre is required"),
        mimeType: z.string().optional(),
        name: z.string().min(1, "Track name is required"),
        producers: z.string().optional(),
        sizeBytes: z.number().int().optional(),
        writers: z.string().optional(),
      })
    )
    .default([]),
  projectCoverObjectKey: z.string().optional(),
  releaseDate: z.string().optional(),
  rightsAccepted: z
    .boolean()
    .refine((value) => value, "Confirm you have the rights to this project"),
  selectedExistingTracks: z.array(z.string()).default([]),
  type: z.enum(["album", "ep", "mixtape"]).default("album"),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;
const projectGet = apiClient.v1.projects[":projectId"].$get;
const trackAssetPost = apiClient.v1.tracks[":trackId"].assets.$post;

interface GenreOption {
  name: string;
}

const isGenreOption = (value: unknown): value is GenreOption =>
  Boolean(
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string"
  );

export function NewProjectForm() {
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const router = useRouter();
  const genresQuery = useGenresQuery();
  const genreRows = Array.isArray(genresQuery.data)
    ? genresQuery.data.filter(isGenreOption)
    : [];
  const availableGenres =
    genreRows.length > 0
      ? genreRows.map((genre) => genre.name)
      : SUPPORTED_GENRES;
  const [step, setStep] = useState("identity");
  const [newCollabName, setNewCollabName] = useState("");
  const [newCollabRole, setNewCollabRole] =
    useState<CollaboratorRole>("featured");
  const [projectCover, setProjectCover] = useState<{
    fileName: string;
    objectKey: string;
    remoteUrl: string;
  } | null>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const coverUploadResolverRef = useRef<((key: string) => void) | null>(null);
  const projectAssetsUploadResolverRef = useRef<
    ((assets: ProjectTrackUploadResult[] | null) => void) | null
  >(null);
  const {
    data: existingTracks = [],
    error: tracksError,
    isLoading: tracksLoading,
  } = useTracksQuery();
  const createProjectMutation = useCreateProjectMutation();

  const defaultProjectFormValues: ProjectFormValues = {
    collaborators: [],
    description: "",
    genre: "Hip-Hop/Rap",
    name: "",
    newTracks: [],
    projectCoverObjectKey: "",
    releaseDate: "",
    rightsAccepted: false,
    selectedExistingTracks: [],
    type: "album",
  };

  const form = useForm<ProjectFormValues>({
    defaultValues: defaultProjectFormValues,
    resolver: zodResolver(projectFormSchema),
  });

  const {
    allowNavigation,
    blockerDialog,
    clearDraft,
    hasSavedDraft,
    resetDraft,
  } = useFormDraftGuard({
    additionalDirtyState: Boolean(selectedCoverFile),
    defaultValues: defaultProjectFormValues,
    form,
    storageKey: "soundkit:new-project-draft",
  });

  const resetProjectDraft = () => {
    resetDraft();
    setSelectedCoverFile(null);
    setProjectCover(null);
    toast({
      description: "Project draft cleared. You can start fresh.",
      title: "Draft reset",
    });
  };

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "newTracks",
  });

  const handleSaveProjectDraft = async () => {
    const values = form.getValues();

    if (values.name.trim().length < 2) {
      toast({
        description: "Add a project title before saving a draft.",
        title: "Project title required",
        variant: "destructive",
      });
      return;
    }

    try {
      const project = await createProjectMutation.mutateAsync({
        assetIds: [],
        collaboratorNames: values.collaborators.map(
          (collaborator) => collaborator.name
        ),
        description: values.description || undefined,
        isPublic: false,
        newTracks: values.newTracks.map((track) => ({
          genre: track.genre || values.genre || "Hip-Hop/Rap",
          title: track.name,
        })),
        projectType: values.type,
        streamingLinks: {},
        title: values.name,
        trackIds: values.selectedExistingTracks,
        ...(values.releaseDate ? { releaseDate: values.releaseDate } : {}),
      });
      clearDraft();
      allowNavigation();
      toast({
        description:
          selectedCoverFile ||
          values.newTracks.some((track) => track.file instanceof File)
            ? "Project metadata saved. Staged files will upload when you complete the project."
            : `${project.title} was saved as a draft.`,
        title: "Draft saved",
      });
      router.navigate({ to: "/dashboard/projects" });
    } catch (error) {
      posthog.captureException(error);
      toast({
        description:
          error instanceof Error ? error.message : "Failed to save draft.",
        title: "Draft save failed",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: ProjectFormValues) => {
    if (values.selectedExistingTracks.length + values.newTracks.length < 2) {
      toast({
        description:
          "Projects need at least two songs. Add more tracks before submitting.",
        title: "More tracks required",
        variant: "destructive",
      });
      return;
    }

    let coverKey = values.projectCoverObjectKey;

    if (selectedCoverFile && !coverKey) {
      const keyPromise = new Promise<string>((resolve) => {
        coverUploadResolverRef.current = resolve;
      });
      uploadCover([selectedCoverFile]).catch((uploadError: unknown) => {
        posthog.captureException(uploadError);
        coverUploadResolverRef.current?.("");
        coverUploadResolverRef.current = null;
      });
      coverKey = await Promise.race([
        keyPromise,
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 60_000)),
      ]);
      if (!coverKey) {
        coverUploadResolverRef.current = null;
        toast({
          description:
            "Project cover upload did not finish. Please retry before creating this project.",
          title: "Artwork upload incomplete",
          variant: "destructive",
        });
        return;
      }
    }

    if (!coverKey) {
      toast({
        description: "Please select a project cover artwork first.",
        title: "Artwork required",
        variant: "destructive",
      });
      return;
    }

    try {
      const projectTracks = values.newTracks.map((track) => {
        const projectTrack = {
          genre: track.genre || values.genre || "Hip-Hop/Rap",
          title: track.name,
        };

        return projectTrack;
      });

      const projectPayload = {
        assetIds: coverKey ? [coverKey] : [],
        collaboratorNames: values.collaborators.map(
          (collaborator) => collaborator.name
        ),
        isPublic: true,
        newTracks: projectTracks,
        projectType: values.type,
        streamingLinks: {},
        title: values.name,
        trackIds: values.selectedExistingTracks,
        ...(values.description ? { description: values.description } : {}),
        ...(values.releaseDate ? { releaseDate: values.releaseDate } : {}),
      };

      const project = await createProjectMutation.mutateAsync(projectPayload);
      const pendingTrackFiles = values.newTracks
        .map((track, index) => ({
          file: track.file instanceof File ? track.file : null,
          index,
        }))
        .filter(
          (entry): entry is { file: File; index: number } =>
            Boolean(entry.file) && !values.newTracks[entry.index]?.assetId
        );

      if (pendingTrackFiles.length > 0) {
        const uploadedAssets = await uploadProjectTrackFiles(
          pendingTrackFiles.map(({ file }) => file)
        );

        if (!uploadedAssets) {
          toast({
            description:
              "Your project draft was saved, but one or more track files did not finish uploading. Open the project draft and retry those files.",
            title: "Project draft saved",
            variant: "destructive",
          });
          await queryClient.invalidateQueries({
            queryKey: soundkitQueryKeys.projects,
          });
          router.navigate({ to: "/dashboard/projects" });
          return;
        }

        const projectDetail = await rpcJson(
          await projectGet({ param: { projectId: project.id } })
        );
        const newProjectTracks = projectDetail.tracks.filter(
          (track) => !values.selectedExistingTracks.includes(track.id)
        );

        for (const [uploadIndex, pendingTrack] of pendingTrackFiles.entries()) {
          const uploadedAsset = uploadedAssets[uploadIndex];
          const projectTrack = newProjectTracks[pendingTrack.index];

          if (!(uploadedAsset && projectTrack)) {
            continue;
          }

          await rpcJson(
            await trackAssetPost({
              json: {
                assetKind: "master",
                metadata: {
                  originalFileName: uploadedAsset.fileName,
                  url: `${MEDIA_BASE_URL}/${uploadedAsset.objectKey}`,
                },
                mimeType: uploadedAsset.mimeType,
                objectKey: uploadedAsset.objectKey,
                sizeBytes: uploadedAsset.sizeBytes,
                status: "uploaded",
                storageProvider: "r2",
              },
              param: { trackId: projectTrack.id },
            })
          );
        }
      }

      posthog.capture("project_created", {
        collaborator_count: values.collaborators.length,
        existing_track_count: values.selectedExistingTracks.length,
        has_release_date: Boolean(values.releaseDate),
        new_track_count: values.newTracks.length,
        project_id: project.id,
        project_type: values.type,
      });
      toast({
        description: `${project.title} is now in your project dashboard.`,
        title: "Project Created",
      });
      clearDraft();
      allowNavigation();
      router.navigate({ to: "/dashboard/projects" });
    } catch (error) {
      posthog.captureException(error);
      toast({
        description: "Failed to create project. Please try again.",
        title: "Error",
        variant: "destructive",
      });
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
    for (const file of files) {
      append({
        file,
        genre: form.getValues("genre") || "Hip-Hop/Rap",
        name: file.name.replace(/\.[^/.]+$/, ""),
        producers: "",
        writers: "",
      });
    }
  };

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
        title: "Artwork upload failed",
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

      setProjectCover({
        fileName: uploadedFile.raw.name,
        objectKey,
        remoteUrl: `${MEDIA_BASE_URL}/${objectKey}`,
      });
      form.setValue("projectCoverObjectKey", objectKey, {
        shouldDirty: true,
        shouldValidate: true,
      });

      if (coverUploadResolverRef.current) {
        coverUploadResolverRef.current(objectKey);
        coverUploadResolverRef.current = null;
      }
    },
    onUploadFail: ({ failedFiles }) => {
      const [failed] = failedFiles;
      posthog.captureException(failed?.error);
      toast({
        description:
          failed?.error?.message ?? "The artwork could not be stored.",
        title: "Artwork upload failed",
        variant: "destructive",
      });
      if (coverUploadResolverRef.current) {
        coverUploadResolverRef.current("");
        coverUploadResolverRef.current = null;
      }
    },
    route: "media",
  });

  interface ProjectTrackUploadResult {
    fileName: string;
    mimeType: string;
    objectKey: string;
    sizeBytes: number;
  }

  const {
    averageProgress: projectAssetProgress,
    isPending: isProjectAssetUploading,
    upload: uploadProjectAssets,
  } = useUploadFiles({
    api: PROJECT_ASSETS_UPLOAD_URL,
    credentials: "include",
    onError: (uploadError) => {
      posthog.captureException(uploadError);
      toast({
        description: uploadError.message,
        title: "Project file upload failed",
        variant: "destructive",
      });
      projectAssetsUploadResolverRef.current?.(null);
      projectAssetsUploadResolverRef.current = null;
    },
    onUploadComplete: ({ files }) => {
      const assets = files.map((uploadedFile) => ({
        fileName: uploadedFile.raw.name,
        mimeType: uploadedFile.raw.type || "application/octet-stream",
        objectKey: uploadedFile.objectInfo.key,
        sizeBytes: uploadedFile.raw.size,
      }));

      projectAssetsUploadResolverRef.current?.(assets);
      projectAssetsUploadResolverRef.current = null;
    },
    onUploadFail: ({ failedFiles }) => {
      const [failed] = failedFiles;
      posthog.captureException(failed?.error);
      toast({
        description:
          failed?.error?.message ?? "The project files could not be stored.",
        title: "Project file upload failed",
        variant: "destructive",
      });
      projectAssetsUploadResolverRef.current?.(null);
      projectAssetsUploadResolverRef.current = null;
    },
    route: "project-assets",
  });

  const uploadProjectTrackFiles = async (files: File[]) => {
    const uploadPromise = new Promise<ProjectTrackUploadResult[] | null>(
      (resolve) => {
        projectAssetsUploadResolverRef.current = resolve;
      }
    );

    uploadProjectAssets(files).catch((uploadError: unknown) => {
      posthog.captureException(uploadError);
      projectAssetsUploadResolverRef.current?.(null);
      projectAssetsUploadResolverRef.current = null;
    });

    return Promise.race([
      uploadPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 120_000)),
    ]);
  };

  const handleProjectCoverUpload = async (files: FileList) => {
    const [file] = [...files];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        description: "Select a JPG or PNG project cover.",
        title: "Invalid artwork",
        variant: "destructive",
      });
      return;
    }

    setSelectedCoverFile(file);
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
      {blockerDialog}
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
            onClick={resetProjectDraft}
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
                        : projectCover
                          ? [
                              {
                                name: projectCover.fileName,
                                status: "Uploaded",
                              },
                            ]
                          : []
                    }
                    onFileUpload={handleProjectCoverUpload}
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
                    name="projectCoverObjectKey"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    render={({ field }) => {
                      const handleProjectTypeChange = field.onChange;

                      return (
                        <FormItem>
                          <FormLabel>Project Type</FormLabel>
                          <Select
                            onValueChange={handleProjectTypeChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-background/50">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="album">Full Album</SelectItem>
                              <SelectItem value="ep">EP</SelectItem>
                              <SelectItem value="mixtape">Mixtape</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="genre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Primary Genre{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            const currentTracks = form.getValues("newTracks");
                            const updated = currentTracks.map((t) => ({
                              ...t,
                              genre: t.genre || val,
                            }));
                            form.setValue("newTracks", updated);
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select primary genre" />
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
                    files={fields.map((field) => ({
                      name:
                        field.file instanceof File
                          ? field.file.name
                          : field.name,
                      status: "Selected",
                    }))}
                    onFileUpload={handleNewUpload}
                    variant="compact"
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
                                  <Select
                                    onValueChange={genreField.onChange}
                                    defaultValue={genreField.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-8 text-sm bg-background/50">
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
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`newTracks.${index}.producers`}
                              render={({ field: producersField }) => (
                                <FormItem>
                                  <FormLabel className="text-[10px]">
                                    Producers
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...producersField}
                                      placeholder="Type names (separated by commas)"
                                      className="h-8 text-sm bg-background/50"
                                    />
                                  </FormControl>
                                  {Boolean(producersField.value) && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {producersField.value
                                        ?.split(",")
                                        .map((p) => p.trim())
                                        .filter(Boolean)
                                        .map((producerName) => (
                                          <Badge
                                            key={producerName}
                                            variant="secondary"
                                            className="text-[10px] bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 py-0.5 px-2"
                                          >
                                            <span>{producerName}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated =
                                                  producersField.value
                                                    ?.split(",")
                                                    .map((p) => p.trim())
                                                    .filter(
                                                      (p) => p !== producerName
                                                    )
                                                    .join(", ");
                                                producersField.onChange(
                                                  updated
                                                );
                                              }}
                                            >
                                              <X className="size-3 hover:text-destructive" />
                                            </button>
                                          </Badge>
                                        ))}
                                    </div>
                                  )}
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`newTracks.${index}.writers`}
                              render={({ field: writersField }) => (
                                <FormItem>
                                  <FormLabel className="text-[10px]">
                                    Writers
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...writersField}
                                      placeholder="Type names (separated by commas)"
                                      className="h-8 text-sm bg-background/50"
                                    />
                                  </FormControl>
                                  {Boolean(writersField.value) && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {writersField.value
                                        ?.split(",")
                                        .map((w) => w.trim())
                                        .filter(Boolean)
                                        .map((writerName) => (
                                          <Badge
                                            key={writerName}
                                            variant="secondary"
                                            className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 py-0.5 px-2"
                                          >
                                            <span>{writerName}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated =
                                                  writersField.value
                                                    ?.split(",")
                                                    .map((w) => w.trim())
                                                    .filter(
                                                      (w) => w !== writerName
                                                    )
                                                    .join(", ");
                                                writersField.onChange(updated);
                                              }}
                                            >
                                              <X className="size-3 hover:text-destructive" />
                                            </button>
                                          </Badge>
                                        ))}
                                    </div>
                                  )}
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* EXISTING TRACKS DROPDOWN WITH CHECKBOXES */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Select From Previous Uploads
                    </Label>
                    <span className="text-xs font-mono text-emerald-400">
                      {form.watch("selectedExistingTracks").length} selected
                      from library
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full justify-between h-12 bg-background/50 border-border/40 text-left font-medium"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <ListMusic className="size-4 text-emerald-500 shrink-0" />
                          {form.watch("selectedExistingTracks").length > 0
                            ? `Selected ${form.watch("selectedExistingTracks").length} previous upload${
                                form.watch("selectedExistingTracks").length ===
                                1
                                  ? ""
                                  : "s"
                              }`
                            : "Click to select tracks from your library"}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground rotate-90" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[calc(100vw-3rem)] max-w-xl max-h-80 overflow-y-auto p-2 space-y-1 bg-popover/95 backdrop-blur-xl border-border/60 shadow-2xl"
                    >
                      <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                        Library Tracks
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {tracksLoading && (
                        <div className="p-3 text-xs text-muted-foreground text-center">
                          Loading your uploaded tracks...
                        </div>
                      )}
                      {tracksError && (
                        <div className="p-3 text-xs text-destructive text-center">
                          Failed to load tracks.
                        </div>
                      )}
                      {!tracksLoading &&
                        !tracksError &&
                        existingTracks.length === 0 && (
                          <div className="p-3 text-xs text-muted-foreground text-center">
                            No previous uploads found in library.
                          </div>
                        )}

                      {existingTracks.map((track) => {
                        const isSelected = form
                          .watch("selectedExistingTracks")
                          .includes(track.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={track.id}
                            checked={isSelected}
                            onCheckedChange={() =>
                              toggleExistingTrack(track.id)
                            }
                            className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-accent"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Music className="size-4 text-emerald-500 shrink-0" />
                              <span className="font-semibold text-sm truncate">
                                {track.title}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase px-1.5 py-0 shrink-0 ml-2"
                            >
                              {track.genre}
                            </Badge>
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* SELECTED TRACK CARDS DISPLAY */}
                  {form.watch("selectedExistingTracks").length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        Selected Library Tracks
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {existingTracks
                          .filter((track) =>
                            form
                              .watch("selectedExistingTracks")
                              .includes(track.id)
                          )
                          .map((track) => (
                            <div
                              key={`selected-${track.id}`}
                              className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Check className="size-4 text-emerald-400 shrink-0" />
                                <span className="font-bold truncate">
                                  {track.title}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] uppercase bg-emerald-500/20 text-emerald-300"
                                >
                                  {track.genre}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => toggleExistingTrack(track.id)}
                              >
                                <X className="size-3.5 mr-1" />
                                Remove
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
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
                      variant="compact"
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
                      variant="compact"
                    />
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
                            and sell every song in this project on SoundKit.
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
                      onValueChange={(value) => {
                        if (isCollaboratorRole(value)) {
                          setNewCollabRole(value);
                        }
                      }}
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
                        key={`${collab.role}-${collab.name}`}
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
                  <div className="flex gap-2">
                    <Button
                      disabled={
                        createProjectMutation.isPending ||
                        isProjectAssetUploading
                      }
                      onClick={handleSaveProjectDraft}
                      type="button"
                      variant="outline"
                    >
                      Save Draft
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createProjectMutation.isPending ||
                        isProjectAssetUploading
                      }
                      className="min-w-[180px] bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    >
                      {isProjectAssetUploading ? (
                        <>
                          <LoaderCircle className="mr-2 size-4 animate-spin" />
                          Uploading {Math.round(projectAssetProgress)}%
                        </>
                      ) : createProjectMutation.isPending ? (
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>
    </div>
  );
}
