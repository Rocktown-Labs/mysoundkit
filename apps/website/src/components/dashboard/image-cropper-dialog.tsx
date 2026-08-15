"use client";

import { LoaderCircle, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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

interface ImageCropperDialogProps {
  aspectRatio: number;
  file: File | null;
  objectUrl: string;
  onCancel: () => void;
  onCropped: (file: File, previewUrl: string) => Promise<void>;
  open: boolean;
  title: string;
}

export function ImageCropperDialog({
  aspectRatio,
  file,
  objectUrl,
  onCancel,
  onCropped,
  open,
  title,
}: ImageCropperDialogProps) {
  const [zoom, setZoom] = useState(1),
   [position, setPosition] = useState({ x: 0, y: 0 }),
   [isDragging, setIsDragging] = useState(false),
   [dragStart, setDragStart] = useState({ x: 0, y: 0 }),
   [isCropping, setIsCropping] = useState(false),

   containerRef = useRef<HTMLDivElement>(null),
   imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  },

   handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) {
      return;
    }
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  },

   handleMouseUp = () => {
    setIsDragging(false);
  },

   handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  },

   confirmCrop = async () => {
    if (!file || !objectUrl || !imageRef.current) {
      return;
    }

    setIsCropping(true);
    try {
      const img = imageRef.current,
       outputWidth = aspectRatio === 1 ? 800 : 1600,
       outputHeight = Math.round(outputWidth / aspectRatio),

       canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, outputWidth, outputHeight);

        const scale = zoom,
         drawWidth = outputWidth * scale,
         drawHeight =
          (outputWidth / (img.naturalWidth / img.naturalHeight)) * scale,

         offsetX = (outputWidth - drawWidth) / 2 + position.x * 2,
         offsetY = (outputHeight - drawHeight) / 2 + position.y * 2;

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, file.type || "image/jpeg", 0.92)
        );

        if (blob) {
          const croppedFile = new File([blob], file.name, { type: blob.type }),
           previewUrl = URL.createObjectURL(croppedFile);
          await onCropped(croppedFile, previewUrl);
        }
      }
    } catch (error) {
      console.error("Cropping failed:", error);
    } finally {
      setIsCropping(false);
      handleReset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-bold text-lg">{title}</DialogTitle>
          <DialogDescription>
            Drag to position your image and use the zoom slider to frame your
            crop.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-xl border border-border/50 bg-black cursor-grab active:cursor-grabbing select-none"
            style={{ aspectRatio }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {objectUrl ? (
              <img
                ref={imageRef}
                alt="Crop canvas"
                className="absolute size-full object-contain pointer-events-none transition-transform duration-75"
                src={objectUrl}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                }}
              />
            ) : null}

            {/* Grid Lines Overlay */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/20">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border border-white/10" />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 bg-muted/40 p-3 rounded-lg border">
            <ZoomOut className="size-4 text-muted-foreground shrink-0" />
            <Slider
              max={3}
              min={1}
              onValueChange={([val]) => setZoom(val ?? 1)}
              step={0.05}
              value={[zoom]}
              className="flex-1"
            />
            <ZoomIn className="size-4 text-muted-foreground shrink-0" />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleReset}
              title="Reset Crop Position & Zoom"
              className="size-8 ml-2"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button disabled={isCropping} onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isCropping}
            onClick={() => void confirmCrop()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isCropping ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : null}
            Crop & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
