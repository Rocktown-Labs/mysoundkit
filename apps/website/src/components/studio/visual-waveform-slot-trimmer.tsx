"use client";

import {
  Pause,
  Play,
  Scissors,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { decodeAudioWaveform } from "@/lib/audio-waveform";
import { cn } from "@/lib/utils";

interface VisualWaveformSlotTrimmerProps {
  audioFile?: File | null;
  audioUrl?: string | null;
  className?: string;
  durationSeconds?: number;
  formatLabel?: string;
  isGeneratingClip?: boolean;
  onChangeSlot: (startSeconds: number, endSeconds: number) => void;
  onGenerateClip?: (
    startSeconds: number,
    endSeconds: number
  ) => void | Promise<void>;
  slotEndsAt: number;
  slotStartsAt: number;
  trackTitle?: string;
}

const MIN_SELECTION_SECONDS = 1;

export const formatTimestamp = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds),
    mins = Math.floor(safeSeconds / 60),
    secs = Math.floor(safeSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function VisualWaveformSlotTrimmer({
  audioFile,
  audioUrl,
  className,
  durationSeconds = 0,
  formatLabel = "WAV",
  isGeneratingClip = false,
  onChangeSlot,
  onGenerateClip,
  slotEndsAt,
  slotStartsAt,
  trackTitle = "Open Verse Master",
}: VisualWaveformSlotTrimmerProps) {
  const [waveform, setWaveform] = useState<number[]>([]),
    [audioSource, setAudioSource] = useState<string | null>(null),
    [decodedDuration, setDecodedDuration] = useState(durationSeconds),
    [zoomLevel, setZoomLevel] = useState(1),
    [viewportStart, setViewportStart] = useState(0),
    [currentTime, setCurrentTime] = useState(slotStartsAt),
    [isPlaying, setIsPlaying] = useState(false),
    [isFocused, setIsFocused] = useState(false),
    [draggingHandle, setDraggingHandle] = useState<"start" | "end" | null>(
      null
    ),
    audioRef = useRef<HTMLAudioElement | null>(null),
    waveformRef = useRef<HTMLDivElement | null>(null),
    objectUrlRef = useRef<string | null>(null),
    effectiveDuration = Math.max(decodedDuration, durationSeconds, 0.1),
    visibleDuration = effectiveDuration / zoomLevel,
    maxViewportStart = Math.max(0, effectiveDuration - visibleDuration),
    viewportEnd = Math.min(effectiveDuration, viewportStart + visibleDuration),
    startSec = Math.max(0, Math.min(slotStartsAt, effectiveDuration)),
    endSec = Math.max(
      Math.min(effectiveDuration, startSec + MIN_SELECTION_SECONDS),
      Math.min(slotEndsAt, effectiveDuration)
    ),
    selectionDuration = Math.max(0, endSec - startSec),
    startPercent = ((startSec - viewportStart) / visibleDuration) * 100,
    endPercent = ((endSec - viewportStart) / visibleDuration) * 100,
    playheadPercent = ((currentTime - viewportStart) / visibleDuration) * 100,
    visibleBars = useMemo(() => {
      if (waveform.length === 0) {
        return Array.from({ length: 120 }, () => 0.05);
      }
      const first = Math.floor(
          (viewportStart / effectiveDuration) * waveform.length
        ),
        last = Math.ceil((viewportEnd / effectiveDuration) * waveform.length);
      return waveform.slice(Math.max(0, first), Math.max(first + 1, last));
    }, [effectiveDuration, viewportEnd, viewportStart, waveform]);

  useEffect(() => {
    let cancelled = false;
    if (!audioFile) {
      setWaveform([]);
      setDecodedDuration(durationSeconds);
      return;
    }

    void decodeAudioWaveform(audioFile)
      .then((data) => {
        if (!cancelled) {
          setWaveform(data.amplitudes);
          setDecodedDuration(data.durationSeconds);
          setViewportStart(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWaveform([]);
          toast({
            description: "The file could not be analyzed for a waveform.",
            title: "Waveform unavailable",
            variant: "destructive",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioFile, durationSeconds]);

  useEffect(() => {
    if (!audioFile) {
      return;
    }
    const url = URL.createObjectURL(audioFile);
    objectUrlRef.current = url;
    setAudioSource(url);
    return () => {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
      setAudioSource(null);
    };
  }, [audioFile]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const updateTime = () => {
      const nextTime = audio.currentTime;
      setCurrentTime(nextTime);
      if (nextTime >= endSec) {
        audio.pause();
        setIsPlaying(false);
        audio.currentTime = endSec;
      }
    };
    audio.addEventListener("timeupdate", updateTime);
    return () => audio.removeEventListener("timeupdate", updateTime);
  }, [endSec]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        event.code !== "Space" ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.matches("button, [role=button]")))
      ) {
        return;
      }
      event.preventDefault();
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      if (audio.paused) {
        if (audio.currentTime < startSec || audio.currentTime >= endSec) {
          audio.currentTime = startSec;
        }
        void audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [endSec, isFocused, startSec]);

  useEffect(() => {
    setViewportStart((value) => Math.min(value, maxViewportStart));
  }, [maxViewportStart]);

  const seekTo = (seconds: number) => {
      const nextTime = Math.max(0, Math.min(seconds, effectiveDuration));
      setCurrentTime(nextTime);
      if (audioRef.current) {
        audioRef.current.currentTime = nextTime;
      }
    },
    secondsForPointer = (clientX: number) => {
      const rect = waveformRef.current?.getBoundingClientRect();
      if (!rect) {
        return currentTime;
      }
      return (
        viewportStart +
        Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) *
          visibleDuration
      );
    },
    handlePointerMove = (event: PointerEvent<HTMLElement>) => {
      if (!draggingHandle) {
        return;
      }
      const target = secondsForPointer(event.clientX);
      if (draggingHandle === "start") {
        onChangeSlot(Math.min(target, endSec - MIN_SELECTION_SECONDS), endSec);
      } else {
        onChangeSlot(
          startSec,
          Math.max(target, startSec + MIN_SELECTION_SECONDS)
        );
      }
    },
    togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      if (audio.paused) {
        if (audio.currentTime < startSec || audio.currentTime >= endSec) {
          audio.currentTime = startSec;
        }
        void audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    };

  return (
    <div
      className={cn(
        "relative select-none overflow-hidden rounded-2xl border border-border/40 bg-zinc-950 p-5 text-white shadow-2xl",
        className
      )}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
      onFocus={() => setIsFocused(true)}
      tabIndex={0}
    >
      {audioFile && audioSource && (
        <audio
          ref={audioRef}
          src={audioSource}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />
      )}
      {!audioFile && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />
      )}

      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Scissors className="size-4" />
          </div>
          <h4 className="truncate text-sm font-semibold text-zinc-100">
            {trackTitle}
          </h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className="border-zinc-800 bg-zinc-900 font-mono text-[11px] text-zinc-400"
          >
            {formatLabel}
          </Badge>
          <span className="font-mono text-xs text-zinc-400">
            {formatTimestamp(effectiveDuration)}
          </span>
        </div>
      </div>

      <div
        ref={waveformRef}
        className="relative my-2 h-32 w-full cursor-crosshair overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2"
        onPointerDown={(event) => {
          if (draggingHandle) {
            return;
          }
          seekTo(secondsForPointer(event.clientX));
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingHandle(null)}
      >
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-[1] border-y border-primary/40 bg-primary/20"
          style={{
            left: `${Math.max(0, startPercent)}%`,
            width: `${Math.max(0, Math.min(100, endPercent) - Math.max(0, startPercent))}%`,
          }}
        />
        <div className="relative z-0 flex size-full items-center justify-between gap-px">
          {visibleBars.map((heightFactor, index) => {
            const barStart =
                viewportStart + (index / visibleBars.length) * visibleDuration,
              inSelection = barStart >= startSec && barStart <= endSec;
            return (
              <div
                key={`${index}-${barStart}`}
                className={cn(
                  "w-full rounded-full",
                  inSelection ? "bg-zinc-100" : "bg-zinc-700/70"
                )}
                style={{ height: `${Math.max(4, heightFactor * 100)}%` }}
              />
            );
          })}
        </div>
        {(["start", "end"] as const).map((handle) => {
          const percent = handle === "start" ? startPercent : endPercent;
          return (
            <button
              aria-label={
                handle === "start"
                  ? "Move open verse start"
                  : "Move open verse end"
              }
              className="absolute bottom-0 top-0 z-20 flex w-4 -translate-x-1/2 cursor-ew-resize flex-col items-center justify-between py-0.5"
              key={handle}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                setDraggingHandle(handle);
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                setDraggingHandle(null);
              }}
              style={{ left: `${percent}%` }}
              type="button"
            >
              <span className="size-3 rounded-full bg-white shadow-md ring-2 ring-primary" />
              <span className="w-0.5 flex-1 bg-white" />
              <span className="size-3 rounded-full bg-white shadow-md ring-2 ring-primary" />
            </button>
          );
        })}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-red-500 shadow-sm"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-zinc-400">
        <span>{formatTimestamp(viewportStart)}</span>
        <span className="font-semibold text-zinc-200">
          {formatTimestamp(currentTime)}
        </span>
        <span>{formatTimestamp(viewportEnd)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs">
        <div className="flex items-center gap-2 font-mono text-zinc-300">
          <span className="inline-block size-2 rounded-full bg-primary" />
          <span>Selection: {formatTimestamp(selectionDuration)}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">
            {formatTimestamp(startSec)} → {formatTimestamp(endSec)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-zinc-400 hover:text-white"
            onClick={() => seekTo(startSec)}
            title="Jump to start"
          >
            <SkipBack className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-zinc-400 hover:text-white"
            onClick={() => seekTo(endSec)}
            title="Jump to end"
          >
            <SkipForward className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            className="size-9 rounded-full bg-white text-zinc-950 hover:bg-zinc-200"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="ml-0.5 size-4 fill-current" />
            )}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-1 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-zinc-400 hover:text-white"
              disabled={zoomLevel <= 1}
              onClick={() => setZoomLevel((value) => Math.max(1, value - 1))}
            >
              <ZoomOut className="size-3" />
            </Button>
            <span className="px-1 font-mono text-xs text-zinc-300">
              {zoomLevel}x
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-zinc-400 hover:text-white"
              disabled={zoomLevel >= 4}
              onClick={() => {
                setZoomLevel((value) => Math.min(4, value + 1));
                setViewportStart((value) => Math.min(maxViewportStart, value));
              }}
            >
              <ZoomIn className="size-3" />
            </Button>
          </div>
          {zoomLevel > 1 && (
            <div className="flex items-center gap-1" aria-label="Pan waveform">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={viewportStart <= 0}
                onClick={() =>
                  setViewportStart((value) =>
                    Math.max(0, value - visibleDuration * 0.5)
                  )
                }
              >
                ←
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={viewportStart >= maxViewportStart}
                onClick={() =>
                  setViewportStart((value) =>
                    Math.min(maxViewportStart, value + visibleDuration * 0.5)
                  )
                }
              >
                →
              </Button>
            </div>
          )}
        </div>
        {onGenerateClip && (
          <Button
            type="button"
            size="sm"
            className="h-9 gap-2 bg-white px-4 text-xs font-bold text-zinc-950 hover:bg-zinc-200"
            disabled={isGeneratingClip || !audioFile}
            onClick={() => void onGenerateClip(startSec, endSec)}
          >
            {isGeneratingClip ? (
              <span className="animate-spin">◌</span>
            ) : (
              <Scissors className="size-3.5" />
            )}
            {isGeneratingClip
              ? "Generating Open Verse Clip…"
              : "Set Open Verse Slot"}
          </Button>
        )}
      </div>
    </div>
  );
}
