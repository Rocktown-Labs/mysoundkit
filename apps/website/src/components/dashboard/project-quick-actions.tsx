"use client";
/* oxlint-disable no-alert, no-void, prefer-destructuring, react-hooks/exhaustive-deps, react/set-state-in-effect, react/todo, sort-vars, one-var */

import { useUploadFiles } from "@better-upload/client";
import { Calendar, ImagePlus, LoaderCircle, Settings2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiClient, MEDIA_UPLOAD_URL, rpcJson } from "@/lib/api";
import { optimizeCoverImageFile } from "@/lib/image-processing";
import { projectCoverFile } from "@/lib/project-cover";
import {
  useGenresQuery,
  useUpdateProjectMutation,
} from "@/lib/soundkit-api-hooks";
import type { PublicProjectDetail } from "@/lib/soundkit-api-hooks";

const projectPatch = apiClient.v1.projects[":projectId"].$patch;

type ProjectType = "album" | "ep" | "mixtape" | "single";
type ListeningAccess = "premium_or_purchased" | "public";

export type ProjectQuickActionName = "cover" | "details";

interface ProjectDialogProps {
  onOpenChange: (open: boolean) => void;
  onSaved: () => unknown;
  open: boolean;
  projectId: string;
}

interface ProjectDetailsDialogProps extends ProjectDialogProps {
  project: PublicProjectDetail | null;
}

interface ProjectCoverDialogProps extends ProjectDialogProps {
  project: PublicProjectDetail | null;
}

const projectTypeOptions: { label: string; value: ProjectType }[] = [
    { label: "Album", value: "album" },
    { label: "EP", value: "ep" },
    { label: "Mixtape", value: "mixtape" },
    { label: "Single", value: "single" },
  ],
  toDateInput = (value: string | null | undefined) => {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  },
  toIsoDateOrEmpty = (value: string) =>
    value ? new Date(`${value}T00:00:00`).toISOString() : "",
  isProjectType = (value: string): value is ProjectType =>
    projectTypeOptions.some((option) => option.value === value),
  isListeningAccess = (value: string): value is ListeningAccess =>
    value === "public" || value === "premium_or_purchased";

export function ProjectQuickActionDialogs({
  activeDialog,
  onClose,
  onSaved,
  project,
  projectId,
}: {
  activeDialog: ProjectQuickActionName | null;
  onClose: () => void;
  onSaved: () => unknown;
  project: PublicProjectDetail | null;
  projectId: string;
}) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <>
      <EditProjectDetailsDialog
        onOpenChange={handleOpenChange}
        onSaved={onSaved}
        open={activeDialog === "details"}
        project={project}
        projectId={projectId}
      />
      <ChangeProjectCoverDialog
        onOpenChange={handleOpenChange}
        onSaved={onSaved}
        open={activeDialog === "cover"}
        project={project}
        projectId={projectId}
      />
    </>
  );
}

function EditProjectDetailsDialog({
  onOpenChange,
  onSaved,
  open,
  project,
  projectId,
}: ProjectDetailsDialogProps) {
  const genresQuery = useGenresQuery(),
    updateProjectMutation = useUpdateProjectMutation(projectId),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [projectType, setProjectType] = useState<ProjectType>("album"),
    [genre, setGenre] = useState(""),
    [releaseDate, setReleaseDate] = useState(""),
    [listeningAccess, setListeningAccess] = useState<ListeningAccess>("public"),
    [isForSale, setIsForSale] = useState(false),
    [priceCents, setPriceCents] = useState(""),
    [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!(open && project)) {
      return;
    }

    setTitle(project.title);
    setDescription(project.description ?? "");
    setProjectType(
      isProjectType(project.projectType) ? project.projectType : "album"
    );
    setGenre(project.genre ?? "");
    setReleaseDate(toDateInput(project.releaseDate));
    setListeningAccess(
      isListeningAccess(project.listeningAccess)
        ? project.listeningAccess
        : "public"
    );
    setIsForSale(project.isForSale);
    setPriceCents(
      project.priceCents === null || project.priceCents === undefined
        ? ""
        : String(project.priceCents / 100)
    );
  }, [open, project]);

  const handleSave = async () => {
    if (isSaving || updateProjectMutation.isPending) {
      return;
    }

    if (title.trim().length < 1) {
      toast({
        description: "Add a project title before saving.",
        title: "Title required",
        variant: "destructive",
      });
      return;
    }

    const parsedPrice = Number(priceCents);
    setIsSaving(true);
    try {
      await updateProjectMutation.mutateAsync({
        description: description.trim(),
        genre: genre.trim() || undefined,
        isForSale,
        listeningAccess,
        priceCents:
          isForSale && Number.isFinite(parsedPrice)
            ? Math.round(parsedPrice * 100)
            : undefined,
        projectType,
        releaseDate: toIsoDateOrEmpty(releaseDate),
        title: title.trim(),
      });
      await onSaved();
      toast({
        description: `“${title.trim()}” changes were saved.`,
        title: "Project updated",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Could not update project.",
        title: "Project update failed",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit project details</DialogTitle>
          <DialogDescription>
            Update the project metadata, release settings, and catalog access
            without leaving the workspace.
          </DialogDescription>
        </DialogHeader>
        {project ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="project-edit-title">Project title</Label>
                <Input
                  id="project-edit-title"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-edit-type">Project type</Label>
                <Select
                  onValueChange={(value) => {
                    if (isProjectType(value)) {
                      setProjectType(value);
                    }
                  }}
                  value={projectType}
                >
                  <SelectTrigger id="project-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-edit-genre">Genre</Label>
                <Select onValueChange={setGenre} value={genre}>
                  <SelectTrigger id="project-edit-genre">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {(genresQuery.data ?? []).map((option) => (
                      <SelectItem key={option.slug} value={option.slug}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="project-edit-description">Description</Label>
                <Textarea
                  id="project-edit-description"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </div>
            </div>
            <div className="grid gap-4 border-t border-border/40 pt-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-edit-release-date">
                  <Calendar className="mr-1 inline size-4" />
                  Release date
                </Label>
                <Input
                  id="project-edit-release-date"
                  onChange={(event) => setReleaseDate(event.target.value)}
                  type="date"
                  value={releaseDate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-edit-access">Listening access</Label>
                <Select
                  onValueChange={(value) => {
                    if (isListeningAccess(value)) {
                      setListeningAccess(value);
                    }
                  }}
                  value={listeningAccess}
                >
                  <SelectTrigger id="project-edit-access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="premium_or_purchased">
                      Premium or purchased
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 border-t border-border/40 pt-5 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                <Label htmlFor="project-edit-sale">List for sale</Label>
                <input
                  aria-label="List project for sale"
                  checked={isForSale}
                  className="size-4 accent-primary"
                  id="project-edit-sale"
                  onChange={(event) => setIsForSale(event.target.checked)}
                  type="checkbox"
                />
              </div>
              {isForSale ? (
                <div className="space-y-2">
                  <Label htmlFor="project-edit-price">Price (USD)</Label>
                  <Input
                    id="project-edit-price"
                    min="0"
                    onChange={(event) => setPriceCents(event.target.value)}
                    step="0.01"
                    type="number"
                    value={priceCents}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={isSaving || updateProjectMutation.isPending || !project}
            onClick={() => void handleSave()}
          >
            {isSaving || updateProjectMutation.isPending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Settings2 className="mr-2 size-4" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeProjectCoverDialog({
  onOpenChange,
  onSaved,
  open,
  project,
  projectId,
}: ProjectCoverDialogProps) {
  const { isPending: isUploading, uploadAsync } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      route: "media",
    }),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [isSaving, setIsSaving] = useState(false),
    [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile || isSaving || isUploading) {
      return;
    }

    setIsSaving(true);
    try {
      const optimizedCover = await optimizeCoverImageFile(selectedFile).catch(
          () => selectedFile
        ),
        namedCover = projectCoverFile(
          optimizedCover,
          project?.title ?? "project"
        ),
        result = await uploadAsync([namedCover]),
        uploadedFile = result.files[0];
      if (!uploadedFile) {
        throw new Error("The cover image could not be uploaded.");
      }

      await rpcJson(
        await projectPatch({
          json: {
            assetIds: [uploadedFile.objectInfo.key],
          },
          param: { projectId },
        })
      );
      await onSaved();
      toast({
        description: "The new cover art was saved.",
        title: "Cover updated",
      });
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Could not update cover art.",
        title: "Cover update failed",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedFile(null);
        }
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change project cover art</DialogTitle>
          <DialogDescription>
            Upload a square JPG or PNG for this project and its public
            tracklist.
          </DialogDescription>
        </DialogHeader>
        {previewUrl ? (
          <img
            alt="Selected project cover preview"
            className="mx-auto max-h-64 rounded-lg border border-border/40 object-contain"
            src={previewUrl}
          />
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-muted/20 p-10 text-center text-sm text-muted-foreground hover:border-primary/50">
            <ImagePlus className="size-7 text-primary" />
            Choose cover image
            <input
              accept=".png,.jpg,.jpeg"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && !file.type.startsWith("image/")) {
                  toast({
                    description: "Select a JPG or PNG cover image.",
                    title: "Invalid cover image",
                    variant: "destructive",
                  });
                  return;
                }
                setSelectedFile(file ?? null);
              }}
              type="file"
            />
          </label>
        )}
        {selectedFile ? (
          <Button
            onClick={() => setSelectedFile(null)}
            type="button"
            variant="ghost"
          >
            Choose a different image
          </Button>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!selectedFile || isSaving || isUploading}
            onClick={() => void handleSave()}
          >
            {isSaving || isUploading ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : null}
            Save cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
