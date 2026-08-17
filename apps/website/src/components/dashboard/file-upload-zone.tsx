import {
  CheckCircle2,
  File,
  FileAudio,
  ImageIcon,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  acceptedTypes: string;
  description: string;
  files?: readonly { name: string; status?: string }[];
  onFileUpload: (files: FileList) => void;
  onRemove?: () => void;
  optional?: boolean;
  previewUrl?: string | null;
  progress?: number;
  status?: string;
  title: string;
  variant?: "default" | "compact";
}

const EMPTY_FILES: readonly { name: string; status?: string }[] = [],
  isArtworkTitle = (title: string) => {
    const normalizedTitle = title.toLowerCase();

    return (
      normalizedTitle.includes("cover") ||
      normalizedTitle.includes("artwork") ||
      normalizedTitle.includes("art")
    );
  };

// This shared dropzone intentionally handles multiple upload and preview states.
// eslint-disable-next-line complexity
export function FileUploadZone({
  acceptedTypes,
  description,
  files = EMPTY_FILES,
  onFileUpload,
  onRemove,
  optional,
  previewUrl,
  progress,
  status,
  title,
  variant = "default",
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false),
    fileInputRef = useRef<HTMLInputElement>(null),
    handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    },
    handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    },
    handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        onFileUpload(droppedFiles);
      }
    },
    handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        onFileUpload(selectedFiles);
      }
    },
    handleClick = () => {
      fileInputRef.current?.click();
    },
    getIcon = () => {
      if (
        title.toLowerCase().includes("cover") ||
        title.toLowerCase().includes("art")
      ) {
        return ImageIcon;
      }
      if (title.toLowerCase().includes("session")) {
        return File;
      }
      return FileAudio;
    },
    IconComponent = getIcon(),
    isArtwork = isArtworkTitle(title),
    hasFiles = files.length > 0 || Boolean(previewUrl),
    hasProgress = typeof progress === "number";

  return (
    <Card
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-200 group min-h-[160px] flex flex-col justify-center",
        isDragOver
          ? "border-primary bg-primary/5 border-2"
          : "border-border/40 hover:border-primary/60 bg-card/30 hover:bg-card/50",
        hasFiles && "border-primary/40 bg-primary/5",
        variant === "compact" && "min-h-[120px]",
        isArtwork && "aspect-square min-h-0 w-full max-w-md mx-auto"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {previewUrl ? (
        /* IN-BOX FULL IMAGE PREVIEW */
        <div className="absolute inset-0 z-0 flex flex-col justify-end bg-black/80">
          <img
            src={previewUrl}
            alt="Artwork preview"
            className="size-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 opacity-80 group-hover:opacity-95 transition-opacity" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end p-4 text-center space-y-2">
            <div className="rounded-full bg-primary/20 p-2 border border-primary/40 backdrop-blur-md">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <p className="font-bold text-sm text-white tracking-tight drop-shadow">
              {files[0]?.name || title}
            </p>
            <p className="text-xs text-emerald-400 font-semibold">
              {status || "Artwork Attached"}
            </p>
            <div className="flex items-center gap-2 pt-1 opacity-100 transition-opacity">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                Change Artwork
              </Button>
              {onRemove && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  <X className="size-3.5 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD UPLOAD DROPZONE */
        <div
          className={cn(
            "text-center z-10 relative",
            variant === "compact" ? "space-y-2 p-4" : "space-y-3 p-6"
          )}
        >
          <div
            className={cn(
              "mx-auto flex items-center justify-center rounded-lg bg-primary/20 transition-transform group-hover:scale-110",
              variant === "compact" ? "size-9" : "size-12"
            )}
          >
            {hasFiles ? (
              <CheckCircle2 className="size-5 text-primary" />
            ) : (
              <IconComponent
                className={cn(
                  "text-primary",
                  variant === "compact" ? "size-5" : "size-6"
                )}
              />
            )}
          </div>
          <div>
            <h3 className="font-medium text-foreground">
              {title}
              {optional && (
                <span className="text-muted-foreground text-sm ml-1">
                  (Optional)
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          {hasFiles && (
            <div className="rounded-md border border-border/40 bg-background/50 px-3 py-2 text-left">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {file.status && (
                      <span className="text-emerald-400 font-medium">
                        {file.status}
                      </span>
                    )}
                    {onRemove && (
                      <button
                        aria-label={`Remove ${file.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove();
                        }}
                        type="button"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          {hasProgress && (
            <div className="space-y-1">
              <Progress value={Math.max(0, Math.min(progress, 100))} />
              <p className="text-xs text-muted-foreground font-mono">
                {status ?? `${Math.round(progress)}% uploaded`}
              </p>
            </div>
          )}
          {!hasFiles && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Upload className="size-3" />
              <span>Click or drag file here</span>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground/80 font-mono">
            Accepted: {acceptedTypes.replaceAll(".", "").toUpperCase()}
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileSelect}
        onClick={(e) => e.stopPropagation()}
        className="sr-only"
        multiple={false}
      />
    </Card>
  );
}
