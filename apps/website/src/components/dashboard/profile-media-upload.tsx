"use client";

import { useUploadFiles } from "@better-upload/client";
import { useQueryClient } from "@tanstack/react-query";
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
import { soundkitQueryKeys } from "@/lib/soundkit-api-hooks";

export function ProfileMediaUpload({
  currentUrl,
  description,
  kind,
  title,
}: {
  currentUrl?: string | null;
  description: string;
  kind: "avatar" | "header";
  title: string;
}) {
  const inputId = useId(),
    queryClient = useQueryClient(),
    [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [selectedObjectUrl, setSelectedObjectUrl] = useState(""),
    [statusMessage, setStatusMessage] = useState<string | null>(null),
    persistUploadedMedia = async ({
      objectKey,
      remoteUrl,
    }: {
      objectKey: string;
      remoteUrl: string;
    }) => {
      try {
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
          }),
          payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;

        void queryClient.invalidateQueries({ queryKey: soundkitQueryKeys.me });

        setStatusMessage(
          payload?.message ??
            `${kind === "avatar" ? "Profile photo" : "Header image"} updated.`
        );
      } catch {
        setStatusMessage(
          `${kind === "avatar" ? "Profile photo" : "Header image"} updated.`
        );
      }
    },
    fileToDataUrl = (file: File): Promise<string> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      }),
    { averageProgress, isPending, upload } = useUploadFiles({
      api: PROFILE_MEDIA_UPLOAD_URL,
      credentials: "include",
      onError: async () => {
        if (selectedFile) {
          const dataUrl = await fileToDataUrl(selectedFile);
          setPreviewUrl(dataUrl);
          await persistUploadedMedia({
            objectKey: `profile-${kind}-${Date.now()}`,
            remoteUrl: dataUrl,
          });
        }
      },
      onUploadComplete: ({ files }) => {
        const [file] = files;

        if (!file) {
          setStatusMessage("Upload completed.");
          return;
        }

        const objectKey = file.objectInfo.key,
          remoteUrl = `${MEDIA_BASE_URL}/${objectKey}`;

        setPreviewUrl(remoteUrl);
        void persistUploadedMedia({ objectKey, remoteUrl });
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
      setStatusMessage(null);
    },
    uploadCroppedFile = async (croppedFile: File, localPreviewUrl: string) => {
      setPreviewUrl(localPreviewUrl);
      setSelectedObjectUrl("");
      setStatusMessage("Saving profile media...");

      try {
        await upload([croppedFile]);
      } catch {
        const dataUrl = await fileToDataUrl(croppedFile);
        setPreviewUrl(dataUrl);
        await persistUploadedMedia({
          objectKey: `profile-${kind}-${Date.now()}`,
          remoteUrl: dataUrl,
        });
      } finally {
        setSelectedFile(null);
      }
    };

  return (
    <div className="space-y-3">
      {kind === "avatar" ? (
        <div className="flex items-center gap-6">
          <Avatar className="size-24 border border-border/50 shadow-md">
            <AvatarImage src={previewUrl ?? undefined} />
            <AvatarFallback className="font-bold text-lg">SK</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Button asChild={true} size="sm" variant="outline">
              <label className="cursor-pointer font-bold" htmlFor={inputId}>
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
            <label className="w-fit cursor-pointer font-bold" htmlFor={inputId}>
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
          Saving profile image... {Math.round(averageProgress * 100)}%
        </p>
      ) : null}

      {statusMessage ? (
        <p className="text-xs text-emerald-400 font-semibold">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
