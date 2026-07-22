"use client";

import { useUploadFiles } from "@better-upload/client";
import { ImageIcon, LoaderCircle, Upload } from "lucide-react";
import { useId, useState } from "react";
import type { ChangeEvent } from "react";

import { ImageCropperDialog } from "@/components/dashboard/image-cropper-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  API_V1_URL,
  MEDIA_BASE_URL,
  PROFILE_MEDIA_UPLOAD_URL,
} from "@/lib/api";

export function ProfileMediaUpload({
  description,
  kind,
  title,
}: {
  description: string;
  kind: "avatar" | "header";
  title: string;
}) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedObjectUrl, setSelectedObjectUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const persistUploadedMedia = async ({
    objectKey,
    remoteUrl,
  }: {
    objectKey: string;
    remoteUrl: string;
  }) => {
    const response = await fetch(`${API_V1_URL}/me/profile`, {
      body: JSON.stringify(
        kind === "avatar"
          ? {
              avatarObjectKey: objectKey,
              avatarUrl: remoteUrl,
            }
          : {
              headerObjectKey: objectKey,
              headerUrl: remoteUrl,
            }
      ),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });

    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

    setStatusMessage(payload?.message ?? "Upload saved.");
  };

  const { averageProgress, error, isPending, upload } = useUploadFiles({
    api: PROFILE_MEDIA_UPLOAD_URL,
    credentials: "include",
    onError: (uploadError) => {
      setStatusMessage(uploadError.message);
    },
    onUploadComplete: ({ files }) => {
      const [file] = files;

      if (!file) {
        setStatusMessage(
          "No uploaded file was returned from SoundKit storage."
        );
        return;
      }

      const objectKey = file.objectInfo.key;
      const remoteUrl = `${MEDIA_BASE_URL}/${objectKey}`;

      setPreviewUrl(remoteUrl);
      void persistUploadedMedia({ objectKey, remoteUrl });
    },
    route: "profile-media",
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setSelectedObjectUrl(URL.createObjectURL(file));
  };

  const uploadCroppedFile = async (file: File, localPreviewUrl: string) => {
    setPreviewUrl(localPreviewUrl);
    setSelectedFile(null);
    setSelectedObjectUrl("");
    setStatusMessage("Uploading to SoundKit storage...");
    await upload([file]);
  };

  return (
    <div className="space-y-3">
      {kind === "avatar" ? (
        <div className="flex items-center gap-6">
          <Avatar className="size-24 border border-border/50">
            <AvatarImage src={previewUrl ?? undefined} />
            <AvatarFallback>SK</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Button asChild={true} size="sm" variant="outline">
              <label className="cursor-pointer" htmlFor={inputId}>
                {isPending ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {title}
              </label>
            </Button>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-muted">
            <div className="aspect-[3/1]">
              {previewUrl ? (
                <img
                  alt="Profile header preview"
                  className="h-full w-full object-cover"
                  src={previewUrl}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="mr-2 size-5" />
                  Header preview
                </div>
              )}
            </div>
          </div>
          <Button asChild={true} size="sm" variant="outline">
            <label className="w-fit cursor-pointer" htmlFor={inputId}>
              {isPending ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {title}
            </label>
          </Button>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      )}

      <input
        accept="image/*"
        className="hidden"
        id={inputId}
        onChange={handleFileChange}
        type="file"
      />

      <ImageCropperDialog
        aspectRatio={kind === "avatar" ? 1 : 3}
        file={selectedFile}
        objectUrl={selectedObjectUrl}
        onCancel={() => {
          setSelectedFile(null);
          setSelectedObjectUrl("");
        }}
        onCropped={uploadCroppedFile}
        open={Boolean(selectedFile && selectedObjectUrl)}
        title={kind === "avatar" ? "Crop Profile Photo" : "Crop Header Image"}
      />

      {isPending ? (
        <p className="text-xs text-muted-foreground">
          Upload progress: {Math.round(averageProgress * 100)}%
        </p>
      ) : null}

      {statusMessage ? (
        <p className="text-xs text-muted-foreground">{statusMessage}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
    </div>
  );
}
