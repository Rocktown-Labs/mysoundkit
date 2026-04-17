import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Repeat,
  Shuffle,
  Laptop2,
  Smartphone,
  Speaker,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
}

interface Device {
  id: string;
  name: string;
  type: "computer" | "phone" | "speaker";
  active: boolean;
}

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isVisible, setIsVisible] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout>();

  // Mock queue data
  const [queue, setQueue] = useState<Track[]>([
    {
      album: "Beach Beats",
      artist: "DJ Cool",
      cover: "/placeholder.svg?height=48&width=48",
      duration: 245,
      id: "1",
      title: "Summer Vibes",
    },
    {
      album: "City Lights",
      artist: "Urban Sounds",
      cover: "/placeholder.svg?height=48&width=48",
      duration: 198,
      id: "2",
      title: "Night Drive",
    },
    {
      album: "Morning Coffee",
      artist: "Acoustic Beats",
      cover: "/placeholder.svg?height=48&width=48",
      duration: 223,
      id: "3",
      title: "Chill Morning",
    },
  ]);

  // Mock devices
  const [devices, setDevices] = useState<Device[]>([
    { active: true, id: "1", name: "This Computer", type: "computer" },
    { active: false, id: "2", name: "iPhone", type: "phone" },
    { active: false, id: "3", name: "Living Room Speaker", type: "speaker" },
  ]);

  // Set initial track
  useEffect(() => {
    if (queue.length > 0 && !currentTrack) {
      setCurrentTrack(queue[0]);
      setIsVisible(true);
    }
  }, [queue, currentTrack]);

  // Auto-hide after 5 minutes of inactivity when paused
  useEffect(() => {
    if (!isPlaying && isVisible) {
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 300_000); // 5 minutes
    } else {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isPlaying, isVisible]);

  // Simulate progress
  useEffect(() => {
    if (isPlaying && currentTrack) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            handleNext();
            return 0;
          }
          return prev + 100 / currentTrack.duration;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isPlaying, currentTrack]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    setIsVisible(true);
  };

  const handleNext = () => {
    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    setCurrentTrack(queue[nextIndex]);
    setProgress(0);
  };

  const handlePrevious = () => {
    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentTrack(queue[prevIndex]);
    setProgress(0);
  };

  const handleVolumeToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleRepeatToggle = () => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const handleDeviceChange = (deviceId: string) => {
    setDevices(devices.map((d) => ({ ...d, active: d.id === deviceId })));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDeviceIcon = (type: Device["type"]) => {
    switch (type) {
      case "computer": {
        return <Laptop2 className="h-4 w-4" />;
      }
      case "phone": {
        return <Smartphone className="h-4 w-4" />;
      }
      case "speaker": {
        return <Speaker className="h-4 w-4" />;
      }
    }
  };

  if (!isVisible || !currentTrack) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:left-64">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 lg:hidden"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-3 lg:w-1/4">
            <AppImage
              src={currentTrack.cover || "/placeholder.svg"}
              alt={currentTrack.title}
              width={48}
              height={48}
              layout="fixed"
              className="rounded"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {currentTrack.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 lg:w-1/2">
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsShuffled(!isShuffled)}
              >
                <Shuffle
                  className={`h-4 w-4 ${isShuffled ? "text-primary" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrevious}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNext}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRepeatToggle}
              >
                <Repeat
                  className={`h-4 w-4 ${repeatMode !== "off" ? "text-primary" : ""}`}
                />
                {repeatMode === "one" && (
                  <span className="absolute text-[10px] font-bold">1</span>
                )}
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime((progress / 100) * currentTrack.duration)}
              </span>
              <Slider
                value={[progress]}
                onValueChange={(value) => setProgress(value[0])}
                max={100}
                step={0.1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">
                {formatTime(currentTrack.duration)}
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center justify-end gap-2 lg:w-1/4">
            {/* Queue Drawer */}
            <Sheet open={queueOpen} onOpenChange={setQueueOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ListMusic className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-96">
                <SheetHeader>
                  <SheetTitle>Queue</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                  <div className="space-y-2">
                    {queue.map((track, index) => (
                      <div
                        key={track.id}
                        className={`flex items-center gap-3 rounded-lg p-2 hover:bg-accent cursor-pointer ${
                          track.id === currentTrack.id ? "bg-accent" : ""
                        }`}
                        onClick={() => {
                          setCurrentTrack(track);
                          setProgress(0);
                        }}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs font-medium">
                          {index + 1}
                        </div>
                        <AppImage
                          src={track.cover || "/placeholder.svg"}
                          alt={track.title}
                          width={40}
                          height={40}
                          layout="fixed"
                          className="rounded"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {track.artist}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(track.duration)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            {/* Device Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hidden lg:flex"
                >
                  {getDeviceIcon(
                    devices.find((d) => d.active)?.type || "computer"
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-semibold">
                  Available Devices
                </div>
                {devices.map((device) => (
                  <DropdownMenuItem
                    key={device.id}
                    onClick={() => handleDeviceChange(device.id)}
                    className="flex items-center gap-2"
                  >
                    {getDeviceIcon(device.type)}
                    <span className="flex-1">{device.name}</span>
                    {device.active && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Volume Control */}
            <div className="hidden items-center gap-2 lg:flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleVolumeToggle}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={(value) => {
                  setVolume(value[0]);
                  if (value[0] > 0) {
                    setIsMuted(false);
                  }
                }}
                max={100}
                step={1}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
