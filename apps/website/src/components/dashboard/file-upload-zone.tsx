import { CheckCircle2, File, FileAudio, ImageIcon, Upload } from "lucide-react";
import type React from "react";
import { useState, useRef } from "react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  title: string;
  description: string;
  acceptedTypes: string;
  onFileUpload: (files: FileList) => void;
  files?: readonly { name: string; status?: string }[];
  optional?: boolean;
  progress?: number;
  status?: string;
  variant?: "default" | "compact";
}

export function FileUploadZone({
  title,
  description,
  acceptedTypes,
  files = [],
  onFileUpload,
  optional,
  progress,
  status,
  variant = "default",
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const { files } = e.dataTransfer;
    if (files.length > 0) {
      onFileUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      onFileUpload(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getIcon = () => {
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
  };

  const IconComponent = getIcon();
  const hasFiles = files.length > 0;
  const hasProgress = typeof progress === "number";

  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        isDragOver
          ? "border-primary bg-primary/5 border-2"
          : "border-border/40 hover:border-primary/60 bg-card/30 hover:bg-card/50",
        hasFiles && "border-primary/40 bg-primary/5",
        variant === "compact" && "min-h-0"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div
        className={cn(
          "text-center",
          variant === "compact" ? "space-y-2 p-4" : "space-y-3 p-6"
        )}
      >
        <div
          className={cn(
            "mx-auto flex items-center justify-center rounded-lg bg-primary/20",
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
          <h3 className="font-medium">
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
                {file.status && (
                  <span className="shrink-0 text-muted-foreground">
                    {file.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {hasProgress && (
          <div className="space-y-1">
            <Progress value={Math.max(0, Math.min(progress, 100))} />
            <p className="text-xs text-muted-foreground">
              {status ?? `${Math.round(progress)}% uploaded`}
            </p>
          </div>
        )}
        {!hasFiles && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Upload className="size-3" />
            <span>Click or drag files here</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Accepted: {acceptedTypes.replaceAll(".", "").toUpperCase()}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileSelect}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        multiple
      />
    </Card>
  );
}
