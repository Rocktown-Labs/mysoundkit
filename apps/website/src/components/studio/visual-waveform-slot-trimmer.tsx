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
import React, { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VisualWaveformSlotTrimmerProps {
  audioFile?: File | null;
  audioUrl?: string | null;
  className?: string;
  durationSeconds?: number;
  formatLabel?: string;
  onChangeSlot: (startSeconds: number, endSeconds: number) => void;
  slotEndsAt: number;
  slotStartsAt: number;
  trackTitle?: string;
}

const formatTimestamp = (seconds: number) => {
  const mins = Math.floor(Math.max(0, seconds) / 60),
    secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function VisualWaveformSlotTrimmer({
  audioFile,
  audioUrl,
  className,
  durationSeconds = 214,
  formatLabel = "WAV 48kHz",
  onChangeSlot,
  slotEndsAt,
  slotStartsAt,
  trackTitle = "Open Verse Master",
}: VisualWaveformSlotTrimmerProps) {
  const [zoomLevel, setZoomLevel] = useState(1),
    [isPlaying, setIsPlaying] = useState(false),
    [currentTime, setCurrentTime] = useState(slotStartsAt || 27),
    audioRef = useRef<HTMLAudioElement | null>(null),
    containerRef = useRef<HTMLDivElement | null>(null),
    [draggingHandle, setDraggingHandle] = useState<"start" | "end" | null>(
      null
    ),
    effectiveDuration = Math.max(durationSeconds, 30),
    startSec = Math.max(0, Math.min(slotStartsAt || 27, effectiveDuration - 5)),
    endSec = Math.max(
      startSec + 3,
      Math.min(
        slotEndsAt || Math.min(effectiveDuration, 183),
        effectiveDuration
      )
    ),
    selectionDuration = Math.max(0, endSec - startSec),
    bars = useMemo(() => {
      const amplitudes: number[] = [];
      for (let i = 0; i < 72; i++) {
        const wave1 = Math.sin((i / 72) * Math.PI * 6),
          wave2 = Math.cos((i / 72) * Math.PI * 12) * 0.4,
          wave3 = Math.sin((i / 72) * Math.PI * 2) * 0.3,
          noise = Math.sin(i * 19.3) * 0.15,
          raw = 0.25 + Math.abs(wave1 + wave2 + wave3 + noise) * 0.7;
        amplitudes.push(Math.max(0.12, Math.min(0.95, raw)));
      }
      return amplitudes;
    }, []),
    startPercent = (startSec / effectiveDuration) * 100,
    endPercent = (endSec / effectiveDuration) * 100,
    playheadPercent =
      (Math.max(0, Math.min(currentTime, effectiveDuration)) /
        effectiveDuration) *
      100,
    handleTogglePlay = () => {
      if (!audioRef.current) {
        setIsPlaying((p) => !p);
        return;
      }
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (currentTime >= endSec || currentTime < startSec) {
          audioRef.current.currentTime = startSec;
          setCurrentTime(startSec);
        }
        audioRef.current.play().catch(() => {
          setIsPlaying(true);
        });
        setIsPlaying(true);
      }
    },
    handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingHandle || !containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect(),
        clickX = e.clientX - rect.left,
        ratio = Math.max(0, Math.min(1, clickX / rect.width)),
        targetSec = Math.round(ratio * effectiveDuration);

      if (draggingHandle === "start") {
        const newStart = Math.max(0, Math.min(targetSec, endSec - 3));
        onChangeSlot(newStart, endSec);
        setCurrentTime(newStart);
      } else if (draggingHandle === "end") {
        const newEnd = Math.max(
          startSec + 3,
          Math.min(targetSec, effectiveDuration)
        );
        onChangeSlot(startSec, newEnd);
      }
    },
    handlePointerUp = () => {
      setDraggingHandle(null);
    },
    resolvedAudioSrc = useMemo(() => {
      if (audioFile) {
        return URL.createObjectURL(audioFile);
      }
      if (audioUrl) {
        return audioUrl;
      }
      return;
    }, [audioFile, audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= endSec) {
        audio.currentTime = startSec;
      }
    };
    audio.addEventListener("timeupdate", updateTime);
    return () => audio.removeEventListener("timeupdate", updateTime);
  }, [startSec, endSec]);

  return (
    <div
      className={cn(
        "relative select-none overflow-hidden rounded-2xl border border-border/40 bg-zinc-950 p-5 text-white shadow-2xl transition-all",
        className
      )}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {resolvedAudioSrc && (
        <audio
          ref={audioRef}
          src={resolvedAudioSrc}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Scissors className="size-4" />
          </div>
          <h4 className="truncate font-semibold text-sm text-zinc-100">
            {trackTitle}
          </h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      {/* Waveform Editor Area */}
      <div
        ref={containerRef}
        className="relative my-2 h-28 w-full cursor-crosshair rounded-xl bg-zinc-900/60 p-2 overflow-hidden border border-zinc-800/80"
        onPointerDown={(e) => {
          if (!containerRef.current) {
            return;
          }
          const rect = containerRef.current.getBoundingClientRect(),
            clickX = e.clientX - rect.left,
            ratio = Math.max(0, Math.min(1, clickX / rect.width)),
            clickedSec = Math.round(ratio * effectiveDuration);
          setCurrentTime(clickedSec);
          if (audioRef.current) {
            audioRef.current.currentTime = clickedSec;
          }
        }}
      >
        {/* Shaded Selection Region */}
        <div
          className="absolute top-0 bottom-0 bg-primary/20 backdrop-brightness-125 border-y border-primary/40 pointer-events-none transition-[left,width] duration-75"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
          }}
        />

        {/* Amplitude Bars Waveform */}
        <div className="flex size-full items-center justify-between gap-[2px]">
          {bars.map((heightFactor, idx) => {
            const barPercent = (idx / bars.length) * 100,
              isInSelection =
                barPercent >= startPercent && barPercent <= endPercent;
            return (
              <div
                key={idx}
                className={cn(
                  "w-full rounded-full transition-colors duration-150",
                  isInSelection ? "bg-zinc-200" : "bg-zinc-700/50"
                )}
                style={{
                  height: `${heightFactor * 100}%`,
                }}
              />
            );
          })}
        </div>

        {/* Start Trim Handle (Hook Start) */}
        <div
          className="absolute top-0 bottom-0 z-20 w-4 -translate-x-1/2 cursor-ew-resize flex flex-col items-center justify-between"
          style={{ left: `${startPercent}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDraggingHandle("start");
          }}
        >
          <div className="size-3 rounded-full bg-white shadow-md ring-2 ring-primary" />
          <div className="w-[2px] flex-1 bg-white" />
          <div className="size-3 rounded-full bg-white shadow-md ring-2 ring-primary" />
        </div>

        {/* End Trim Handle (Open Verse End) */}
        <div
          className="absolute top-0 bottom-0 z-20 w-4 -translate-x-1/2 cursor-ew-resize flex flex-col items-center justify-between"
          style={{ left: `${endPercent}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDraggingHandle("end");
          }}
        >
          <div className="size-3 rounded-full bg-white shadow-md ring-2 ring-primary" />
          <div className="w-[2px] flex-1 bg-white" />
          <div className="size-3 rounded-full bg-white shadow-md ring-2 ring-primary" />
        </div>

        {/* Red Playhead Line */}
        <div
          className="absolute top-0 bottom-0 z-10 w-[2px] bg-red-500 shadow-sm pointer-events-none transition-all"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>

      {/* Time Markers Strip below Waveform */}
      <div className="relative flex items-center justify-between font-mono text-[11px] text-zinc-400 pt-1">
        <span>{formatTimestamp(startSec)}</span>
        <span className="text-zinc-200 font-semibold">
          {formatTimestamp(currentTime)}
        </span>
        <span>{formatTimestamp(endSec)}</span>
      </div>

      {/* Selection Stats */}
      <div className="flex items-center justify-between pt-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-300 font-mono">
          <span className="size-2 rounded-full bg-primary animate-pulse inline-block" />
          <span>Selection: {formatTimestamp(selectionDuration)}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">
            {formatTimestamp(startSec)} — {formatTimestamp(endSec)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-zinc-400 hover:text-white"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = startSec;
                setCurrentTime(startSec);
              }
            }}
            title="Jump to Start"
          >
            <SkipBack className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-zinc-400 hover:text-white"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = endSec;
                setCurrentTime(endSec);
              }
            }}
            title="Jump to End"
          >
            <SkipForward className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="size-9 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 font-bold shadow"
            onClick={handleTogglePlay}
          >
            {isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current translate-x-0.5" />
            )}
          </Button>

          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-zinc-400 hover:text-white"
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
            >
              <ZoomOut className="size-3" />
            </Button>
            <span className="font-mono text-xs text-zinc-300 px-1">
              {zoomLevel}x
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-zinc-400 hover:text-white"
              onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
            >
              <ZoomIn className="size-3" />
            </Button>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="h-9 px-4 font-bold bg-white text-zinc-950 hover:bg-zinc-200 shadow-md gap-2 text-xs"
          onClick={() => {
            onChangeSlot(startSec, endSec);
            toast({
              description: `Open verse slot set from ${formatTimestamp(startSec)} to ${formatTimestamp(endSec)} (${formatTimestamp(selectionDuration)}).`,
              title: "Open Verse Slot Updated",
            });
          }}
        >
          <Scissors className="size-3.5" />
          Set Open Verse Slot
        </Button>
      </div>
    </div>
  );
}
