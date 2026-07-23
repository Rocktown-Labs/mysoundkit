import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Key,
  Layers,
  ListMusic,
  Lock,
  Mic,
  MicOff,
  Music,
  Play,
  Radio,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Video,
  Volume2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

export const Route = createFileRoute("/_explore/live/preview")({
  component: LivePreviewShowcase,
});

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface BattleKitTrack {
  duration: string;
  id: string;
  status: "played" | "queued" | "available";
  title: string;
}

interface TimedLyricLine {
  active?: boolean;
  text: string;
  time: string;
}

export function LivePreviewShowcase({
  defaultPerspective = "artist",
  defaultTab = "battle",
}: {
  defaultPerspective?: "viewer" | "artist";
  defaultTab?: "battle" | "stream" | "party";
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"battle" | "stream" | "party">(
    defaultTab
  );
  const [perspective, setPerspective] = useState<"viewer" | "artist">(
    defaultPerspective
  );
  const [battlePhase, setBattlePhase] = useState<
    "track_select" | "round_active" | "voting" | "grace_period"
  >("round_active");
  const [viewMode, setViewMode] = useState<"stage" | "lyrics" | "tracklist">(
    "stage"
  );
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [obsConnected, setObsConnected] = useState(true);
  const [artistCameraActive, setArtistCameraActive] = useState(true);
  const [selectCountdown, setSelectCountdown] = useState(24);

  // Pre-loaded Battle Kit tracks
  const [battleKit, setBattleKit] = useState<BattleKitTrack[]>([
    {
      duration: "2:45",
      id: "bk-1",
      status: "played",
      title: "Round 1: Metro Bounce (WAV)",
    },
    {
      duration: "3:12",
      id: "bk-2",
      status: "queued",
      title: "Round 2: Nightfall Vibe (Master)",
    },
    {
      duration: "2:58",
      id: "bk-3",
      status: "available",
      title: "Round 3: Cyberpunk Anthem (Unreleased)",
    },
    {
      duration: "3:30",
      id: "bk-4",
      status: "available",
      title: "Tiebreaker: Final Knockout Beat",
    },
  ]);

  const [selectedTrackId, setSelectedTrackId] = useState("bk-2");

  // Timed synchronized lyrics
  const lyrics: TimedLyricLine[] = [
    { text: "Yeah, stepping in the arena, battle lights on", time: "0:04" },
    {
      active: true,
      text: "MetroFlow on the mic, beat switches in round two",
      time: "0:12",
    },
    {
      text: "Turn the bass up, heavy 808s cutting through the room",
      time: "0:18",
    },
    { text: "Crowd casting votes, clock ticking down to zero", time: "0:24" },
    {
      text: "No ghostwriters here, strictly master tracks playing live",
      time: "0:30",
    },
  ];

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "MetroFlow",
      text: "Beat switches in round 2 were insane 🔥",
      time: "10:12",
    },
    {
      id: "2",
      sender: "ProducerKev",
      text: "Mixing on track A is super clean",
      time: "10:13",
    },
    {
      id: "3",
      sender: "BattleBot (Ref)",
      text: "🤖 Round 1 complete. 2-minute voting is now OPEN for active viewers!",
      time: "10:14",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (battlePhase === "track_select" && selectCountdown > 0) {
      const timer = setInterval(
        () => setSelectCountdown((prev) => prev - 1),
        1000
      );
      return () => clearInterval(timer);
    }
  }, [battlePhase, selectCountdown]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) {
      return;
    }
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: perspective === "artist" ? "You (Artist)" : "You (Fan)",
        text: chatInput.trim(),
        time: "Now",
      },
    ]);
    setChatInput("");
  };

  const handleCastVote = (candidate: string) => {
    if (perspective === "artist") {
      toast({
        description:
          "Contenders participating in the battle cannot vote on their own battle rounds.",
        title: "Voting Restricted",
        variant: "destructive",
      });
      return;
    }

    if (selectedVote) {
      toast({
        description: `You have already voted for ${selectedVote} in Round 2.`,
        title: "Single Vote Limit",
      });
      return;
    }

    setIsSubmittingVote(true);
    setTimeout(() => {
      setSelectedVote(candidate);
      setIsSubmittingVote(false);
      toast({
        description: `Your vote for ${candidate} has been registered by BattleBot.`,
        title: "Vote Confirmed! 🗳️",
      });
    }, 300);
  };

  const handleConfirmTrackSelection = () => {
    const chosen = battleKit.find((t) => t.id === selectedTrackId);
    if (!chosen) {
      return;
    }
    setBattleKit((prev) =>
      prev.map((t) =>
        t.id === selectedTrackId ? { ...t, status: "queued" } : t
      )
    );
    toast({
      description: `${chosen.title} is locked and ready for your turn.`,
      title: "Battle Track Locked 🔒",
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copied to clipboard.`, title: "Copied!" });
  };

  const currentTrackObj =
    battleKit.find((t) => t.id === selectedTrackId) || battleKit[1];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Bar Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-bold tracking-widest text-primary border-primary/40"
            >
              Cloudflare RealtimeKit Engine
            </Badge>
            <Badge
              variant="secondary"
              className="text-[10px] uppercase font-bold tracking-widest"
            >
              Live Showcase &amp; Layout Engine
            </Badge>
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            SoundKit Live Experiences
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live battles, creator streaming, listening parties, and battle
            challenge invitations.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl border border-border/50">
          <Button
            size="sm"
            variant={perspective === "artist" ? "default" : "ghost"}
            onClick={() => setPerspective("artist")}
            className="text-xs font-bold"
          >
            <Mic className="size-3.5 mr-1.5" /> Artist View
          </Button>
          <Button
            size="sm"
            variant={perspective === "viewer" ? "default" : "ghost"}
            onClick={() => setPerspective("viewer")}
            className="text-xs font-bold"
          >
            <Eye className="size-3.5 mr-1.5" /> Viewer View
          </Button>
        </div>
      </div>

      {/* Main Mode Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          setActiveTab(val as "battle" | "challenge" | "stream" | "party")
        }
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full md:w-[720px] h-12">
          <TabsTrigger
            value="battle"
            className="font-bold gap-2 text-xs md:text-sm"
          >
            <Swords className="size-4 text-rose-500" /> Live Battle
          </TabsTrigger>
          <TabsTrigger
            value="challenge"
            className="font-bold gap-2 text-xs md:text-sm"
          >
            <Zap className="size-4 text-amber-500" /> Battle Request
          </TabsTrigger>
          <TabsTrigger
            value="stream"
            className="font-bold gap-2 text-xs md:text-sm"
          >
            <Radio className="size-4 text-purple-500" /> Live Stream
          </TabsTrigger>
          <TabsTrigger
            value="party"
            className="font-bold gap-2 text-xs md:text-sm"
          >
            <Music className="size-4 text-emerald-500" /> Listening Party
          </TabsTrigger>
        </TabsList>

        {/* ---------------- LIVE BATTLE TAB CONTENT ---------------- */}
        <TabsContent value="battle" className="space-y-6">
          {/* Slim, High-Contrast Referee Banner for BattleBot */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 text-zinc-100 p-3 rounded-xl shadow-lg">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 shrink-0">
                <Bot className="size-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-white">
                  BattleBot Referee:{" "}
                </span>
                <span className="text-zinc-300">
                  Automated round switching, 2-min voting polls, and 2-min
                  post-battle grace teardown.
                </span>
              </div>
            </div>

            {/* Battle Phase Controller for Testing */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              <Button
                size="sm"
                variant={battlePhase === "track_select" ? "default" : "outline"}
                onClick={() => {
                  setBattlePhase("track_select");
                  setSelectCountdown(30);
                }}
                className="text-[10px] h-7 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
              >
                1. Select Track
              </Button>
              <Button
                size="sm"
                variant={battlePhase === "round_active" ? "default" : "outline"}
                onClick={() => setBattlePhase("round_active")}
                className="text-[10px] h-7 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
              >
                2. Round Active
              </Button>
              <Button
                size="sm"
                variant={battlePhase === "voting" ? "default" : "outline"}
                onClick={() => setBattlePhase("voting")}
                className="text-[10px] h-7 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
              >
                3. 2-Min Vote Poll
              </Button>
              <Button
                size="sm"
                variant={battlePhase === "grace_period" ? "default" : "outline"}
                onClick={() => setBattlePhase("grace_period")}
                className="text-[10px] h-7 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
              >
                4. 2-Min Grace &amp; Kick
              </Button>
            </div>
          </div>

          {/* Battle Arena Stage & View Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Battle Arena Main Container */}
              <div className="relative rounded-2xl bg-card border border-border overflow-hidden p-4 sm:p-6 space-y-6 shadow-2xl">
                {/* Live Stats Bar Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="destructive"
                      className="animate-pulse flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold"
                    >
                      <Radio className="size-3" /> LIVE BATTLE
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs">
                      ROUND 2 OF 3
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs text-muted-foreground"
                    >
                      <Clock className="size-3 mr-1" /> 01:14
                    </Badge>
                  </div>

                  {/* View Mode Toggle Buttons */}
                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
                    <Button
                      size="sm"
                      variant={viewMode === "stage" ? "default" : "ghost"}
                      onClick={() => setViewMode("stage")}
                      className="h-7 text-xs px-2.5"
                    >
                      <Video className="size-3.5 mr-1" /> Stage
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === "lyrics" ? "default" : "ghost"}
                      onClick={() => setViewMode("lyrics")}
                      className="h-7 text-xs px-2.5"
                    >
                      <FileText className="size-3.5 mr-1" /> Timed Lyrics
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === "tracklist" ? "default" : "ghost"}
                      onClick={() => setViewMode("tracklist")}
                      className="h-7 text-xs px-2.5"
                    >
                      <ListMusic className="size-3.5 mr-1" /> Tracklist Log
                    </Button>
                  </div>
                </div>

                {/* Live Score Counter Bar */}
                <div className="bg-muted/40 p-3 rounded-xl border flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-primary">
                    <Avatar className="size-6 border">
                      <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300" />
                      <AvatarFallback>MF</AvatarFallback>
                    </Avatar>
                    <span>MetroFlow (58%)</span>
                  </div>
                  <Badge variant="outline" className="font-mono bg-background">
                    SCORE: 1 - 0
                  </Badge>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>ProducerKev (42%)</span>
                    <Avatar className="size-6 border">
                      <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300" />
                      <AvatarFallback>PK</AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* VIEW MODE 1: DUAL ARTIST STAGE */}
                {viewMode === "stage" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Contender 1: MetroFlow */}
                    <Card className="border-2 border-primary bg-primary/5 relative overflow-hidden">
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-emerald-500 text-white text-[10px] font-bold">
                          <Mic className="size-3 mr-1" /> LIVE MIC ON
                        </Badge>
                      </div>
                      <CardContent className="p-6 text-center space-y-4">
                        <Avatar className="size-24 mx-auto border-4 border-primary ring-4 ring-primary/20 shadow-xl">
                          <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300" />
                          <AvatarFallback>MF</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-bold text-lg flex items-center justify-center gap-1">
                            MetroFlow{" "}
                            <CheckCircle2 className="size-4 text-emerald-500" />
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Rank #4 • 12-2 Record
                          </p>
                        </div>
                        <div className="bg-background/90 p-3 rounded-lg border text-left text-xs space-y-1">
                          <span className="font-bold text-foreground text-[10px] uppercase tracking-wider block">
                            Round 2 Performing:
                          </span>
                          <p className="font-bold truncate text-primary">
                            🎵 {currentTrackObj.title}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contender 2: ProducerKev */}
                    <Card className="border-border bg-card/40 relative overflow-hidden">
                      <div className="absolute top-3 right-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground font-bold"
                        >
                          <MicOff className="size-3 mr-1" /> MUTED UNTIL TURN
                        </Badge>
                      </div>
                      <CardContent className="p-6 text-center space-y-4">
                        <Avatar className="size-24 mx-auto border-2 border-border opacity-80">
                          <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300" />
                          <AvatarFallback>PK</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-bold text-lg">ProducerKev</h3>
                          <p className="text-xs text-muted-foreground">
                            Rank #9 • 8-4 Record
                          </p>
                        </div>
                        <div className="bg-background/90 p-3 rounded-lg border text-left text-xs space-y-1 opacity-75">
                          <span className="font-bold text-foreground text-[10px] uppercase tracking-wider block">
                            Queued Response:
                          </span>
                          <p className="font-bold truncate text-muted-foreground">
                            🎵 Cyberpunk Anthem (WAV)
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* VIEW MODE 2: TIMED LYRICS SYNC */}
                {viewMode === "lyrics" && (
                  <Card className="border-primary/30 bg-primary/5 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        <span className="font-bold text-sm">
                          Real-time Synchronized Lyrics
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        SYNCED TO STAGE AUDIO
                      </Badge>
                    </div>
                    <div className="space-y-3 font-medium text-sm py-4">
                      {lyrics.map((line, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border transition-all ${
                            line.active
                              ? "bg-primary text-primary-foreground font-bold shadow-md scale-[1.02]"
                              : "bg-background/60 text-muted-foreground border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] opacity-80 mb-0.5">
                            <span>Line {idx + 1}</span>
                            <span className="font-mono">{line.time}</span>
                          </div>
                          <p>{line.text}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* VIEW MODE 3: BATTLE TRACKLIST LOG */}
                {viewMode === "tracklist" && (
                  <Card className="border-border p-6 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="font-bold text-sm">
                        Battle Kit Tracklist Log
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {battleKit.filter((t) => t.status === "played").length}{" "}
                        Played / {battleKit.length} Total
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {battleKit.map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-background/60 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <Music className="size-4 text-primary" />
                            <div>
                              <p className="font-bold">{track.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Duration: {track.duration}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              track.status === "played"
                                ? "secondary"
                                : (track.status === "queued"
                                  ? "default"
                                  : "outline")
                            }
                            className="text-[10px] uppercase font-bold"
                          >
                            {track.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Phase 1: Artist Battle Kit Track Selector Dropdown */}
                {battlePhase === "track_select" && perspective === "artist" && (
                  <Card className="border-primary bg-primary/10">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                          <Music className="size-4" /> Select Next Round Track
                          from Your Battle Kit
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="text-xs font-mono text-primary border-primary/40"
                        >
                          <Clock className="size-3 mr-1" /> 00:
                          {selectCountdown.toString().padStart(2, "0")}{" "}
                          auto-lock
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        Select a song from your pre-loaded Battle Kit for Round
                        2. BattleBot auto-selects if countdown reaches zero.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-3">
                      <Select
                        value={selectedTrackId}
                        onValueChange={setSelectedTrackId}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select track..." />
                        </SelectTrigger>
                        <SelectContent>
                          {battleKit.map((track) => (
                            <SelectItem
                              key={track.id}
                              value={track.id}
                              disabled={track.status === "played"}
                            >
                              {track.title} ({track.duration}) - [
                              {track.status.toUpperCase()}]
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleConfirmTrackSelection}
                        className="font-bold shrink-0"
                      >
                        Lock Track for Turn
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Phase 3: High-Contrast 2-Minute Voting Poll */}
                {battlePhase === "voting" && (
                  <Card className="border-rose-500/60 bg-rose-950/20">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2 text-rose-400 font-bold">
                          <Trophy className="size-4" /> RealtimeKit Round 2 Poll
                          (01:45 Remaining)
                        </CardTitle>
                        <Badge variant="destructive">MANDATORY VOTE</Badge>
                      </div>
                      <CardDescription className="text-xs text-rose-200/80">
                        Cast your vote for Round 2! Viewers who do not vote
                        within 2 minutes will be moved to the spectator waiting
                        room by BattleBot.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-2">
                      {perspective === "artist" ? (
                        <div className="p-3 rounded-lg bg-background/80 border text-xs text-amber-500 flex items-center gap-2 font-bold">
                          <Lock className="size-4 shrink-0" />
                          <span>
                            Contenders in this battle are restricted from
                            voting. Audience votes only.
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant={
                              selectedVote === "MetroFlow"
                                ? "default"
                                : "outline"
                            }
                            disabled={isSubmittingVote}
                            className="h-12 font-bold justify-between"
                            onClick={() => handleCastVote("MetroFlow")}
                          >
                            <span>Vote MetroFlow</span>
                            <Badge variant="secondary">58%</Badge>
                          </Button>
                          <Button
                            variant={
                              selectedVote === "ProducerKev"
                                ? "default"
                                : "outline"
                            }
                            disabled={isSubmittingVote}
                            className="h-12 font-bold justify-between"
                            onClick={() => handleCastVote("ProducerKev")}
                          >
                            <span>Vote ProducerKev</span>
                            <Badge variant="secondary">42%</Badge>
                          </Button>
                        </div>
                      )}
                      <Progress value={58} className="h-2" />
                    </CardContent>
                  </Card>
                )}

                {/* Phase 4: Post-Battle Grace Period & Email Recap */}
                {battlePhase === "grace_period" && (
                  <Card className="border-amber-500/50 bg-amber-500/10">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Clock className="size-6 text-amber-500 animate-spin shrink-0" />
                        <div>
                          <p className="font-bold text-sm text-foreground">
                            Post-Battle 2-Minute Grace Period
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Battle complete! BattleBot is saving recording
                            watermarks, downloading chat dumps, and sending
                            email summary receipts.
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-500 font-mono text-sm px-3 py-1 shrink-0"
                      >
                        01:45
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Column: OBS Ingest & Persistent Chat */}
            <div className="space-y-6">
              {perspective === "artist" && (
                <Card className="border-purple-500/30 bg-purple-500/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2 font-bold">
                        <Video className="size-4 text-purple-400" /> OBS /
                        Encoder Ingest
                      </CardTitle>
                      <Badge
                        variant={obsConnected ? "default" : "outline"}
                        className={obsConnected ? "bg-emerald-500" : ""}
                      >
                        {obsConnected ? "1080p 60fps" : "Offline"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground space-y-1 font-mono bg-background/60 p-2.5 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-foreground font-bold">
                          RTMP Ingest URL:
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5"
                          onClick={() =>
                            copyToClipboard(
                              "rtmp://ingest.mysoundkit.com/live",
                              "RTMP URL"
                            )
                          }
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                      <p className="truncate text-primary">
                        rtmp://ingest.mysoundkit.com/live
                      </p>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[10px] text-foreground font-bold">
                          Stream Key:
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5"
                          onClick={() =>
                            copyToClipboard("sk_live_obs_98765", "Stream Key")
                          }
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                      <p className="truncate">sk_live_obs_98765</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Persistent Live Chat Panel */}
              <Card className="flex flex-col h-[520px] border border-border">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2 font-bold">
                      <FileText className="size-4 text-primary" /> Persistent
                      Live Chat
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      Text Only
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">
                          {msg.sender}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {msg.time}
                        </span>
                      </div>
                      <p className="text-foreground bg-muted/40 p-2 rounded-md">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </CardContent>
                <form
                  onSubmit={handleSendChat}
                  className="p-3 border-t flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send text message..."
                    className="text-xs"
                  />
                  <Button type="submit" size="icon" className="shrink-0">
                    <Send className="size-4" />
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---------------- BATTLE REQUEST / CHALLENGE TAB CONTENT ---------------- */}
        <TabsContent value="challenge" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-3 font-[family-name:var(--font-playfair)] text-2xl font-bold">
                <Swords className="size-6 text-primary" />
                Issue Live Battle Challenge
              </h2>
              <p className="mt-1 max-w-2xl text-muted-foreground text-sm">
                Send a direct battle invitation to any artist on SoundKit.
                Preview the complete battle challenge workflow.
              </p>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-amber-500/40 text-amber-500"
            >
              Interactive Preview Mode
            </Badge>
          </div>

          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="border-b">
              <CardTitle>Challenge Details</CardTitle>
              <CardDescription>
                Select opponent, format, genre, and schedule mode.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <form
                className="flex flex-col gap-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  toast({
                    description: `Battle challenge successfully issued to ${challengeSearch || "@artist"}.`,
                    title: "Challenge sent!",
                  });
                }}
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="previewOpponentUsername">
                        Opponent Username
                      </Label>
                      <div className="relative">
                        <Input
                          className="pr-10"
                          id="previewOpponentUsername"
                          onChange={(event) =>
                            setChallengeSearch(event.target.value)
                          }
                          placeholder="Search or enter @username"
                          value={challengeSearch}
                        />
                        {challengeSearch ? (
                          <button
                            type="button"
                            onClick={() => setChallengeSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            X
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label>Battle Kit</Label>
                        <Select defaultValue="club-knockouts">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="club-knockouts">
                              Club Knockouts (5 tracks)
                            </SelectItem>
                            <SelectItem value="radio-singles">
                              Radio Singles (3 tracks)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label>Format</Label>
                        <Select defaultValue="best_of_5">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="best_of_3">Best of 3</SelectItem>
                            <SelectItem value="best_of_5">Best of 5</SelectItem>
                            <SelectItem value="best_of_7">Best of 7</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Genre</Label>
                      <Select defaultValue="hip-hop">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                          <SelectItem value="r-and-b">R&B</SelectItem>
                          <SelectItem value="electronic">Electronic</SelectItem>
                          <SelectItem value="pop">Pop</SelectItem>
                          <SelectItem value="trap">Trap</SelectItem>
                          <SelectItem value="afrobeats">Afrobeats</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Start Time</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setChallengeSchedule("asap")}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition text-left ${challengeSchedule === "asap" ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                        >
                          <div>
                            <span className="block font-medium text-sm">
                              ASAP
                            </span>
                            <span className="text-muted-foreground text-xs">
                              Start when accepted
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setChallengeSchedule("scheduled")}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition text-left ${challengeSchedule === "scheduled" ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                        >
                          <div>
                            <span className="block font-medium text-sm">
                              Schedule
                            </span>
                            <span className="text-muted-foreground text-xs">
                              Propose date &amp; time
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {challengeSchedule === "scheduled" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label>Proposed Date</Label>
                          <Input type="date" defaultValue="2026-07-25" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Proposed Time</Label>
                          <Input
                            placeholder="8:00 PM CT"
                            defaultValue="9:00 PM EST"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label>Challenge Message</Label>
                      <Input
                        placeholder="Add a message for your opponent..."
                        defaultValue="Let's get in the arena! Best of 5."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <Badge variant="outline">Live Battle Room</Badge>
                  <Button
                    type="submit"
                    size="lg"
                    className="px-8 bg-rose-600 hover:bg-rose-700 font-bold"
                  >
                    <Swords className="mr-2 size-4" />
                    Send Battle Challenge
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- LIVE STREAM TAB CONTENT ---------------- */}
        <TabsContent value="stream" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="relative rounded-2xl bg-black aspect-video border border-border flex items-center justify-center overflow-hidden shadow-2xl">
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <Badge
                    variant="destructive"
                    className="animate-pulse flex items-center gap-1.5 font-bold"
                  >
                    <Radio className="size-3" /> LIVE STREAM
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-mono">
                    <Users className="size-3 mr-1" /> 1,240 Viewers
                  </Badge>
                </div>
                <div className="text-center space-y-3 p-6">
                  <Avatar className="size-20 mx-auto border-2 border-primary ring-4 ring-primary/20">
                    <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300" />
                    <AvatarFallback>MF</AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold text-white">
                    Studio Session &amp; Album Cooking
                  </h2>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Streaming live via OBS Studio with RealtimeKit H.264
                    simulcast video engine and SoundKit logo watermark.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Card className="flex flex-col h-[420px] border border-border">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold">
                    Stream Chat
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-0.5">
                      <span className="font-bold text-purple-400">
                        {msg.sender}
                      </span>
                      <p className="text-foreground bg-muted/40 p-2 rounded-md">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---------------- LISTENING PARTY TAB CONTENT ---------------- */}
        <TabsContent value="party" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-emerald-500/30 bg-emerald-500/5 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
                  <div className="flex items-center gap-4">
                    <AppImage
                      src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300"
                      alt="Album Cover"
                      className="size-28 rounded-xl object-cover border shadow-md"
                    />
                    <div>
                      <Badge className="bg-emerald-500 text-white text-[10px] uppercase mb-2 font-bold">
                        Artist-Hosted Listening Party
                      </Badge>
                      <h2 className="text-2xl font-bold">
                        Midnight Mixtape Premiere
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        MetroFlow • Track 3 of 10 Playing
                      </p>
                    </div>
                  </div>

                  {/* Artist Host Controls & Camera Toggle */}
                  {perspective === "artist" && (
                    <div className="space-y-2 text-right">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={artistCameraActive ? "default" : "outline"}
                          onClick={() =>
                            setArtistCameraActive(!artistCameraActive)
                          }
                          className="text-xs"
                        >
                          <Camera className="size-3.5 mr-1" />{" "}
                          {artistCameraActive ? "Cam Active" : "Cam Off"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            toast({
                              description: "Track 3 replayed for audience.",
                              title: "Play That Back!",
                            })
                          }
                          className="text-xs font-bold"
                        >
                          <RotateCcw className="size-3.5 mr-1" /> Play That Back
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Host can replay or delay tracks without scrubbing
                      </p>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span>01:42</span>
                    <span>03:15</span>
                  </div>
                  <Progress value={52} className="h-2 bg-emerald-500/20" />
                </div>
              </Card>
            </div>

            <div>
              <Card className="flex flex-col h-[460px] border border-border">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold">
                    Listening Party Chat
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-0.5">
                      <span className="font-bold text-emerald-400">
                        {msg.sender}
                      </span>
                      <p className="text-foreground bg-muted/40 p-2 rounded-md">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
