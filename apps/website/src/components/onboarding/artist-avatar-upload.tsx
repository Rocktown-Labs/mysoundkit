"use client";

import { useUploadFiles } from "@better-upload/client";
import { LoaderCircle, Upload } from "lucide-react";
import { useId, useState } from "react";
import type { ChangeEvent } from "react";

import { ImageCropperDialog } from "@/components/dashboard/image-cropper-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MEDIA_BASE_URL, PROFILE_MEDIA_UPLOAD_URL } from "@/lib/api";

interface UploadedAvatar {
  objectKey: string;
  url: string;
}

export type AvatarUploadStatus =
  | "idle"
  | "uploading"
  | "settled"
  | "failed"
  | "skipped";

export function ArtistAvatarUpload({
  avatarUrl,
  onStatusChange,
  onUploaded,
}: {
  avatarUrl: string;
  onStatusChange?: (status: AvatarUploadStatus) => void;
  onUploaded: (avatar: UploadedAvatar) => void;
}) {
  const inputId = useId(),
    [localPreviewUrl, setLocalPreviewUrl] = useState(""),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [selectedObjectUrl, setSelectedObjectUrl] = useState(""),
    [statusMessage, setStatusMessage] = useState(""),
    [uploadFailed, setUploadFailed] = useState(false),
    { averageProgress, isPending, upload } = useUploadFiles({
      api: PROFILE_MEDIA_UPLOAD_URL,
      credentials: "include",
      onError: (uploadError) => {
        setUploadFailed(true);
        onStatusChange?.("failed");
        setStatusMessage(`${uploadError.message} You can continue without it.`);
      },
      onUploadComplete: ({ files }) => {
        const [file] = files;
        if (!file) {
          setUploadFailed(true);
          onStatusChange?.("failed");
          setStatusMessage(
            "The upload did not finish. You can continue without it."
          );
          return;
        }
        const objectKey = file.objectInfo.key,
          url = `${MEDIA_BASE_URL}/${objectKey}`;
        setUploadFailed(false);
        onUploaded({ objectKey, url });
        onStatusChange?.("settled");
        setLocalPreviewUrl("");
        setStatusMessage("Profile picture uploaded and ready to save.");
      },
      route: "profile-media",
    }),
    handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      setSelectedFile(file);
      setSelectedObjectUrl(URL.createObjectURL(file));
    },
    uploadCroppedFile = async (file: File, previewUrl: string) => {
      setUploadFailed(false);
      setLocalPreviewUrl(previewUrl);
      setSelectedFile(null);
      setSelectedObjectUrl("");
      onStatusChange?.("uploading");
      setStatusMessage("Uploading your profile picture…");
      await upload([file]);
    };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        <Avatar className="size-32 border border-border/50">
          <AvatarImage
            alt="Artist profile picture preview"
            className="object-cover"
            src={localPreviewUrl || avatarUrl || undefined}
          />
          <AvatarFallback className="text-2xl">SK</AvatarFallback>
        </Avatar>
        <Button asChild size="lg" variant="outline">
          <label className="cursor-pointer" htmlFor={inputId}>
            {isPending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {avatarUrl ? "Choose a different picture" : "Choose a picture"}
          </label>
        </Button>
      </div>
      <input
        accept="image/*"
        className="hidden"
        id={inputId}
        onChange={handleFileChange}
        type="file"
      />
      <ImageCropperDialog
        aspectRatio={1}
        file={selectedFile}
        objectUrl={selectedObjectUrl}
        onCancel={() => {
          setSelectedFile(null);
          setSelectedObjectUrl("");
        }}
        onCropped={uploadCroppedFile}
        open={Boolean(selectedFile && selectedObjectUrl)}
        title="Crop profile picture"
      />
      {isPending ? (
        <p className="text-center text-xs text-muted-foreground">
          Upload progress: {Math.round(averageProgress * 100)}%
        </p>
      ) : null}
      {statusMessage ? (
        <p className="text-center text-xs text-muted-foreground">
          {statusMessage}
        </p>
      ) : null}
      {uploadFailed && !isPending ? (
        <div className="flex justify-center">
          <Button
            disabled={false}
            onClick={() => {
              onStatusChange?.("skipped");
              setStatusMessage("Continuing without a profile picture.");
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Continue without picture
          </Button>
        </div>
      ) : null}
    </div>
  );
}
