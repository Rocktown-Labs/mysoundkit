"use client";

import { useUploadFiles } from "@better-upload/client";
import { LoaderCircle, Upload } from "lucide-react";
import { useId, useState } from "react";
import type { ChangeEvent } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MEDIA_BASE_URL, PROFILE_MEDIA_UPLOAD_URL } from "@/lib/api";

interface UploadedAvatar {
  objectKey: string;
  url: string;
}

export function ArtistAvatarUpload({
  avatarUrl,
  onUploaded,
}: {
  avatarUrl: string;
  onUploaded: (avatar: UploadedAvatar) => void;
}) {
  const inputId = useId();
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const { averageProgress, isPending, upload } = useUploadFiles({
    api: PROFILE_MEDIA_UPLOAD_URL,
    credentials: "include",
    onError: (uploadError) => {
      setStatusMessage(
        `${uploadError.message} You can skip this and add one later.`
      );
    },
    onUploadComplete: ({ files }) => {
      const [file] = files;

      if (!file) {
        setStatusMessage(
          "The upload did not return a profile picture. You can skip this and add one later."
        );
        return;
      }

      const objectKey = file.objectInfo.key;
      const url = `${MEDIA_BASE_URL}/${objectKey}`;

      onUploaded({ objectKey, url });
      setLocalPreviewUrl("");
      setStatusMessage("Profile picture uploaded.");
    },
    route: "profile-media",
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setLocalPreviewUrl(URL.createObjectURL(file));
    setStatusMessage("Uploading your profile picture...");
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

        <Button asChild={true} size="lg" variant="outline">
          <label className="cursor-pointer" htmlFor={inputId}>
            {isPending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {avatarUrl ? "Choose a Different Picture" : "Choose a Picture"}
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
    </div>
  );
}
