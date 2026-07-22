"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const createCroppedFile = async ({
  aspectRatio,
  file,
  objectUrl,
  zoom,
}: {
  aspectRatio: number;
  file: File;
  objectUrl: string;
  zoom: number;
}) => {
  const image = new Image();
  image.src = objectUrl;
  await image.decode();

  const outputWidth = aspectRatio === 1 ? 800 : 1600;
  const outputHeight = Math.round(outputWidth / aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare image crop.");
  }

  const sourceAspect = image.naturalWidth / image.naturalHeight;
  const cropWidth =
    sourceAspect > aspectRatio
      ? image.naturalHeight * aspectRatio
      : image.naturalWidth;
  const cropHeight = cropWidth / aspectRatio;
  const zoomedWidth = cropWidth / zoom;
  const zoomedHeight = cropHeight / zoom;
  const sourceX = (image.naturalWidth - zoomedWidth) / 2;
  const sourceY = (image.naturalHeight - zoomedHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    zoomedWidth,
    zoomedHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, file.type || "image/jpeg", 0.92)
  );

  if (!blob) {
    throw new Error("Unable to export cropped image.");
  }

  return new File([blob], file.name, { type: blob.type });
};

export function ImageCropperDialog({
  aspectRatio,
  file,
  objectUrl,
  onCancel,
  onCropped,
  open,
  title,
}: {
  aspectRatio: number;
  file: File | null;
  objectUrl: string;
  onCancel: () => void;
  onCropped: (file: File, previewUrl: string) => Promise<void>;
  open: boolean;
  title: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);

  const confirmCrop = async () => {
    if (!(file && objectUrl)) {
      return;
    }

    setIsCropping(true);
    const croppedFile = await createCroppedFile({
      aspectRatio,
      file,
      objectUrl,
      zoom,
    });
    await onCropped(croppedFile, URL.createObjectURL(croppedFile));
    setIsCropping(false);
    setZoom(1);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Adjust the crop before uploading this profile image.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div
            className="overflow-hidden rounded-lg border border-border/50 bg-muted"
            style={{ aspectRatio }}
          >
            {objectUrl ? (
              <img
                alt="Crop preview"
                className="size-full object-cover"
                src={objectUrl}
                style={{ transform: `scale(${zoom})` }}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">Zoom</p>
            <Slider
              max={2}
              min={1}
              onValueChange={([value]) => setZoom(value ?? 1)}
              step={0.05}
              value={[zoom]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isCropping} onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button disabled={isCropping} onClick={() => void confirmCrop()}>
            {isCropping ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : null}
            Crop & Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
