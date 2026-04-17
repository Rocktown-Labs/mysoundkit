import { Upload, FileAudio, ImageIcon, File } from "lucide-react";
import type React from "react";
import { useState, useRef } from "react";

import { Card } from "@/components/ui/card";

interface FileUploadZoneProps {
  title: string;
  description: string;
  acceptedTypes: string;
  onFileUpload: (files: FileList) => void;
  optional?: boolean;
}

export function FileUploadZone({
  title,
  description,
  acceptedTypes,
  onFileUpload,
  optional,
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

  return (
    <Card
      className={`relative cursor-pointer transition-all duration-200 ${
        isDragOver
          ? "border-primary bg-primary/5 border-2"
          : "border-border/40 hover:border-primary/60 bg-card/30 hover:bg-card/50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="p-6 text-center space-y-3">
        <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto">
          <IconComponent className="h-6 w-6 text-primary" />
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
        <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
          <Upload className="h-3 w-3" />
          <span>Click or drag files here</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Accepted: {acceptedTypes.replaceAll(".", "").toUpperCase()}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        multiple
      />
    </Card>
  );
}
