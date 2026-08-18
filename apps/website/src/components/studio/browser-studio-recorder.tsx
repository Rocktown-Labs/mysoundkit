"use client";
/* eslint-disable complexity, no-nested-ternary, unicorn/no-nested-ternary, unicorn/prefer-number-properties, promise/prefer-await-to-then, unicorn/consistent-function-scoping, react/no-array-index-key, no-unused-vars, sort-vars, one-var */

import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Check,
  Radio,
  Sliders,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  extractAudioWaveformPeaks,
  readAudioFileMetadata,
} from "@/lib/audio-studio";

interface BrowserStudioRecorderProps {
  onRecordingComplete?: (file: File) => void;
}

export function BrowserStudioRecorder({
  onRecordingComplete,
}: BrowserStudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false),
    [isPaused, setIsPaused] = useState(false),
    [recordingDurationSec, setRecordingDurationSec] = useState(0),
    [recordedBlob, setRecordedBlob] = useState<Blob | null>(null),
    [recordedFile, setRecordedFile] = useState<File | null>(null),
    [isPlaying, setIsPlaying] = useState(false),
    [playbackProgress, setPlaybackProgress] = useState(0),
    [trimStartSec, setTrimStartSec] = useState(0),
    [trimEndSec, setTrimEndSec] = useState(30),
    [waveformPeaks, setWaveformPeaks] = useState<number[]>([]),
    [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]),
    [selectedDeviceId, setSelectedDeviceId] = useState<string>(""),
    [volumeLevel, setVolumeLevel] = useState(0),
    mediaRecorderRef = useRef<MediaRecorder | null>(null),
    audioChunksRef = useRef<Blob[]>([]),
    timerIntervalRef = useRef<NodeJS.Timeout | null>(null),
    audioContextRef = useRef<AudioContext | null>(null),
    analyserRef = useRef<AnalyserNode | null>(null),
    animationFrameRef = useRef<number | null>(null),
    audioElementRef = useRef<HTMLAudioElement | null>(null),
    canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.enumerateDevices
    ) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const mics = devices.filter((d) => d.kind === "audioinput");
          setAudioDevices(mics);
          if (mics.length > 0 && mics[0]) {
            setSelectedDeviceId(mics[0].deviceId);
          }
        })
        .catch(console.warn);
    }
  }, []);

  const startVisualizer = (stream: MediaStream) => {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount),
        draw = () => {
          if (!canvasRef.current || !analyserRef.current) {
            return;
          }
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (const val of dataArray) {
            sum += val;
          }
          const avg = sum / dataArray.length;
          setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));

          const canvas = canvasRef.current,
            ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / dataArray.length) * 2.5;
            let x = 0;

            for (const val of dataArray) {
              const barHeight = (val / 255) * canvas.height;
              ctx.fillStyle = `rgb(${Math.min(255, 120 + barHeight)}, 90, 240)`;
              ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
          }

          animationFrameRef.current = requestAnimationFrame(draw);
        };

      draw();
    },
    stopVisualizer = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.warn);
        audioContextRef.current = null;
      }
      setVolumeLevel(0);
    },
    handleStartRecording = async () => {
      try {
        audioChunksRef.current = [];
        const constraints: MediaStreamConstraints = {
            audio: selectedDeviceId
              ? { deviceId: { exact: selectedDeviceId } }
              : true,
          },
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        startVisualizer(stream);

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "",
          options = mimeType ? { mimeType } : undefined,
          recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          stopVisualizer();
          for (const track of stream.getTracks()) {
            track.stop();
          }

          const finalMime = recorder.mimeType || "audio/webm",
            blob = new Blob(audioChunksRef.current, { type: finalMime });
          setRecordedBlob(blob);

          const extension = finalMime.includes("mp4") ? "m4a" : "webm",
            file = new File(
              [blob],
              `studio-recording-${Date.now()}.${extension}`,
              {
                type: finalMime,
              }
            );
          setRecordedFile(file);

          const peaks = await extractAudioWaveformPeaks(blob, 48);
          setWaveformPeaks(peaks);

          const meta = await readAudioFileMetadata(blob),
            duration = meta?.durationMs
              ? meta.durationMs / 1000
              : recordingDurationSec;
          setTrimEndSec(duration);
        };

        recorder.start(250);
        setIsRecording(true);
        setIsPaused(false);
        setRecordingDurationSec(0);

        timerIntervalRef.current = setInterval(() => {
          setRecordingDurationSec((prev) => prev + 1);
        }, 1000);
      } catch (error) {
        console.error("Failed to start live studio recording:", error);
      }
    },
    handleStopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setIsPaused(false);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }
    },
    handleTogglePlayback = () => {
      if (!recordedBlob) {
        return;
      }

      if (isPlaying && audioElementRef.current) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        if (!audioElementRef.current) {
          const url = URL.createObjectURL(recordedBlob),
            audio = new Audio(url);
          audioElementRef.current = audio;

          audio.addEventListener("timeupdate", () => {
            if (audio.duration) {
              setPlaybackProgress((audio.currentTime / audio.duration) * 100);
            }
          });

          audio.addEventListener("ended", () => {
            setIsPlaying(false);
            setPlaybackProgress(0);
          });
        }

        audioElementRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(console.warn);
      }
    },
    formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60),
        secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    };

  return (
    <Card className="border border-purple-500/20 bg-background/80 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-purple-400 animate-pulse" />
            <CardTitle className="text-lg">Live Studio Recorder</CardTitle>
            <Badge
              variant="outline"
              className="border-purple-500/40 text-purple-300 font-mono text-xs uppercase tracking-wider"
            >
              Beta
            </Badge>
          </div>
          {isRecording && (
            <Badge
              variant="destructive"
              className="animate-pulse flex items-center gap-1.5"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              REC {formatTime(recordingDurationSec)}
            </Badge>
          )}
        </div>
        <CardDescription>
          Record high-definition vocals, instruments, and live takes directly in
          the browser powered by WebCodecs & MediaBunny.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Device selector and meter */}
        {!isRecording && !recordedFile && audioDevices.length > 1 && (
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-xs text-foreground"
            >
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Audio Visualizer Canvas */}
        <div className="relative h-24 w-full bg-secondary/30 rounded-lg overflow-hidden flex items-center justify-center border border-border/50">
          {isRecording ? (
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              width={400}
              height={96}
            />
          ) : recordedBlob && waveformPeaks.length > 0 ? (
            <div className="w-full h-full px-4 flex items-center gap-1">
              {waveformPeaks.map((peak, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-purple-500/80 rounded-full transition-all"
                  style={{ height: `${Math.max(12, peak * 80)}%` }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Mic className="h-6 w-6 opacity-40" />
              <span className="text-xs">Microphone ready</span>
            </div>
          )}

          {isRecording && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded text-[10px] text-purple-300 font-mono">
              <Volume2 className="h-3 w-3" />
              {volumeLevel}%
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          {!isRecording && !recordedFile ? (
            <Button
              onClick={handleStartRecording}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center gap-2"
            >
              <Mic className="h-4 w-4" /> Start Studio Recording
            </Button>
          ) : isRecording ? (
            <Button
              onClick={handleStopRecording}
              variant="destructive"
              className="w-full font-medium flex items-center gap-2"
            >
              <Square className="h-4 w-4 fill-white" /> Stop &amp; Process Take
            </Button>
          ) : (
            <div className="w-full space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTogglePlayback}
                  className="flex items-center gap-1.5"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isPlaying ? "Pause" : "Listen Back"}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (audioElementRef.current) {
                      audioElementRef.current.pause();
                      audioElementRef.current = null;
                    }
                    setRecordedBlob(null);
                    setRecordedFile(null);
                    setWaveformPeaks([]);
                  }}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" /> Re-record Take
                </Button>

                {onRecordingComplete && recordedFile && (
                  <Button
                    size="sm"
                    onClick={() => onRecordingComplete(recordedFile)}
                    className="ml-auto bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4" /> Attach to Track
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
