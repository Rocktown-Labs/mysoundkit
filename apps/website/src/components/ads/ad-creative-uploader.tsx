import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { sliceAudioFileToSnippet } from "@/lib/media-bunny-slicer";
import { readAudioDurationMs } from "@/lib/media-duration";
import { cn } from "@/lib/utils";

export type AdSlotKind = "audio" | "image" | "video";

export const AD_SLOT_LIMITS: Record<
  AdSlotKind,
  { label: string; maxBytes: number; maxSeconds: number | null }
> = {
  audio: {
    label: "Audio spot (max 30s)",
    maxBytes: 100 * 1024 * 1024,
    maxSeconds: 30,
  },
  image: {
    label: "Banner image",
    maxBytes: 10 * 1024 * 1024,
    maxSeconds: null,
  },
  video: {
    label: "Video spot (max 60s)",
    maxBytes: 100 * 1024 * 1024,
    maxSeconds: 60,
  },
};

interface AdCreativeUploaderProps {
  onFileReady: (file: File, durationSeconds: number | null) => void;
  slot: AdSlotKind;
}

const formatSeconds = (value: number) => `${value.toFixed(1)}s`;

/**
 * Guided creative intake: validates size/duration in plain language and
 * offers inline trimming (click-free fades included) instead of dead-end
 * errors. The parent owns the actual upload; this component hands over a
 * ready-to-upload File.
 */
export function AdCreativeUploader({
  onFileReady,
  slot,
}: AdCreativeUploaderProps) {
  const { toast } = useToast(),
    [file, setFile] = useState<File | null>(null),
    [durationSeconds, setDurationSeconds] = useState<number | null>(null),
    [probing, setProbing] = useState(false),
    [trimStart, setTrimStart] = useState("0"),
    [trimEnd, setTrimEnd] = useState("30"),
    [trimming, setTrimming] = useState(false),
    previewUrlRef = useRef<string | null>(null),
    [previewUrl, setPreviewUrl] = useState<string | null>(null),
    limits = AD_SLOT_LIMITS[slot];

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    []
  );

  const setPreview = (next: File) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  },

   handleSelected = async (selected: File | null) => {
    if (!selected) {
      return;
    }
    if (selected.size > limits.maxBytes) {
      toast({
        description: `This file is ${(selected.size / 1_048_576).toFixed(1)} MB — the limit is ${limits.maxBytes / 1_048_576} MB. Try a compressed export.`,
        title: "File too large",
        variant: "destructive",
      });
      return;
    }
    setFile(selected);
    setPreview(selected);
    if (slot === "audio" || slot === "video") {
      setProbing(true);
      try {
        const ms = await readAudioDurationMs(selected),
         seconds = ms === null ? null : ms / 1000;
        setDurationSeconds(seconds);
        if (seconds !== null) {
          setTrimEnd(
            `${Math.min(seconds, limits.maxSeconds ?? seconds).toFixed(1)}`
          );
        }
        if (
          seconds !== null &&
          limits.maxSeconds !== null &&
          seconds > limits.maxSeconds
        ) {
          toast({
            description: `${formatSeconds(seconds)} is over the ${limits.maxSeconds}s slot — trim it below, no re-upload needed.`,
            title: "Too long for this slot",
          });
        } else {
          onFileReady(selected, seconds);
        }
      } finally {
        setProbing(false);
      }
    } else {
      setDurationSeconds(null);
      onFileReady(selected, null);
    }
  },

   applyTrim = async () => {
    if (!file) {
      return;
    }
    const start = Number(trimStart),
      end = Number(trimEnd);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      start < 0
    ) {
      toast({
        description:
          "Trim range needs a start before the end, both inside the clip.",
        title: "Invalid trim range",
        variant: "destructive",
      });
      return;
    }
    setTrimming(true);
    try {
      const trimmed = await sliceAudioFileToSnippet(
        file,
        start,
        end,
        file.name
      );
      setFile(trimmed);
      setPreview(trimmed);
      const ms = await readAudioDurationMs(trimmed),
       seconds = ms === null ? null : ms / 1000;
      setDurationSeconds(seconds);
      onFileReady(trimmed, seconds);
      toast({
        description: `Trimmed to ${seconds === null ? "?" : formatSeconds(seconds)}. Ready to upload.`,
        title: "Trim applied",
      });
    } catch {
      toast({
        description:
          "Could not trim this file in the browser. Try a shorter export.",
        title: "Trim failed",
        variant: "destructive",
      });
    } finally {
      setTrimming(false);
    }
  },

   overLimit =
    durationSeconds !== null &&
    limits.maxSeconds !== null &&
    durationSeconds > limits.maxSeconds;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-2">
        <Label>Creative file · {limits.label}</Label>
        <Input
          accept={
            slot === "audio"
              ? "audio/*"
              : (slot === "video"
                ? "video/*"
                : "image/*")
          }
          onChange={(event) =>
            void handleSelected(event.target.files?.[0] ?? null)
          }
          type="file"
        />
      </div>
      {probing && (
        <p className="text-xs text-muted-foreground">Reading duration…</p>
      )}
      {file && durationSeconds !== null && (
        <p
          className={cn(
            "text-xs",
            overLimit
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          Duration: {formatSeconds(durationSeconds)}
          {overLimit
            ? ` — ${formatSeconds(durationSeconds - (limits.maxSeconds ?? 0))} over`
            : " — fits the slot"}
        </p>
      )}
      {file && previewUrl && (slot === "audio" || slot === "video") && (
        <div className="space-y-2">
          {slot === "audio" ? (
            <audio className="w-full" controls src={previewUrl} />
          ) : (
            <video
              className="max-h-40 w-full rounded object-cover"
              controls
              src={previewUrl}
            />
          )}
          {overLimit && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Trim start (s)</Label>
                <Input
                  min="0"
                  onChange={(event) => setTrimStart(event.target.value)}
                  step="0.1"
                  type="number"
                  value={trimStart}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Trim end (s)</Label>
                <Input
                  min="0"
                  onChange={(event) => setTrimEnd(event.target.value)}
                  step="0.1"
                  type="number"
                  value={trimEnd}
                />
              </div>
              <Button
                disabled={trimming}
                onClick={() => void applyTrim()}
                size="sm"
                type="button"
              >
                {trimming ? "Trimming…" : "Trim"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
