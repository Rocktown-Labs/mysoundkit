import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Key,
  Layers,
  Mic,
  MicOff,
  Music,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Video,
  Volume2,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

function LivePreviewShowcase() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"battle" | "stream" | "party">("battle");
  const [perspective, setPerspective] = useState<"viewer" | "artist">("artist");
  const [battlePhase, setBattlePhase] = useState<"track_select" | "round_active" | "voting" | "grace_period">("round_active");
  const [selectedRoundTrack, setSelectedRoundTrack] = useState("Nightfall Vibe (Master)");
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [obsConnected, setObsConnected] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "1", sender: "MetroFlow", text: "Beat switches in round 2 were insane 🔥", time: "10:12" },
    { id: "2", sender: "ProducerKev", text: "Mixing on track A is super clean", time: "10:13" },
    { id: "3", sender: "BattleBot", text: "🤖 Round 1 complete. 2-minute voting is now OPEN for active viewers!", time: "10:14" },
  ]);
  const [chatInput, setChatInput] = useState("");

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: perspective === "artist" ? "You (Artist)" : "You (Fan)", text: chatInput.trim(), time: "Now" },
    ]);
    setChatInput("");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-primary border-primary/40">
              Cloudflare RealtimeKit Engine
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest">
              Live Preview &amp; Layout Showcase
            </Badge>
          </div>
          <h1 className="text-3xl font-black font-[family-name:var(--font-playfair)] tracking-tight">
            SoundKit Live Experiences
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore live battles, streaming, and listening parties from both viewer and artist perspectives.
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
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "battle" | "stream" | "party")} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full md:w-[600px] h-12">
          <TabsTrigger value="battle" className="font-bold gap-2 text-xs md:text-sm">
            <Swords className="size-4 text-rose-500" /> Live Battle
          </TabsTrigger>
          <TabsTrigger value="stream" className="font-bold gap-2 text-xs md:text-sm">
            <Radio className="size-4 text-purple-500" /> Live Stream
          </TabsTrigger>
          <TabsTrigger value="party" className="font-bold gap-2 text-xs md:text-sm">
            <Music className="size-4 text-emerald-500" /> Listening Party
          </TabsTrigger>
        </TabsList>

        {/* ---------------- LIVE BATTLE TAB CONTENT ---------------- */}
        <TabsContent value="battle" className="space-y-6">
          {/* BattleBot Control Banner */}
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                  <Bot className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">BattleBot Automated Moderator</span>
                    <Badge variant="outline" className="text-[9px] uppercase border-rose-500/30 text-rose-400">
                      RealtimeKit Waiting Room Active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    BattleBot manages round setup, track playback, 2-min voting polls, and the 2-min post-battle kick countdown.
                  </p>
                </div>
              </div>

              {/* Phase Switcher for Testing */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <Button
                  size="sm"
                  variant={battlePhase === "track_select" ? "default" : "outline"}
                  onClick={() => setBattlePhase("track_select")}
                  className="text-[11px] h-8"
                >
                  1. Select Track
                </Button>
                <Button
                  size="sm"
                  variant={battlePhase === "round_active" ? "default" : "outline"}
                  onClick={() => setBattlePhase("round_active")}
                  className="text-[11px] h-8"
                >
                  2. Round Active
                </Button>
                <Button
                  size="sm"
                  variant={battlePhase === "voting" ? "default" : "outline"}
                  onClick={() => setBattlePhase("voting")}
                  className="text-[11px] h-8"
                >
                  3. 2-Min Vote Poll
                </Button>
                <Button
                  size="sm"
                  variant={battlePhase === "grace_period" ? "default" : "outline"}
                  onClick={() => setBattlePhase("grace_period")}
                  className="text-[11px] h-8"
                >
                  4. 2-Min Grace &amp; Kick
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Battle Room Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Battle Stage */}
            <div className="lg:col-span-2 space-y-6">
              {/* Battle Arena Stage */}
              <div className="relative rounded-2xl bg-card border border-border overflow-hidden p-6 space-y-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="animate-pulse flex items-center gap-1.5 px-3 py-1 text-xs">
                      <Radio className="size-3" /> LIVE BATTLE • ROUND 2 / 3
                    </Badge>
                    <Badge variant="outline" className="text-xs font-mono">
                      <Clock className="size-3 mr-1" /> 01:24 remaining
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    Session ID: #rtk_battle_8891
                  </span>
                </div>

                {/* Dual Artists Stage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Artist A */}
                  <Card className="border-2 border-primary bg-primary/5 relative overflow-hidden">
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-emerald-500 text-white text-[10px]">
                        <Mic className="size-3 mr-1" /> ON STAGE (LIVE)
                      </Badge>
                    </div>
                    <CardContent className="p-6 text-center space-y-4">
                      <Avatar className="size-24 mx-auto border-4 border-primary ring-4 ring-primary/20 shadow-xl">
                        <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300" />
                        <AvatarFallback>MF</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-lg flex items-center justify-center gap-1">
                          MetroFlow <CheckCircle2 className="size-4 text-emerald-500" />
                        </h3>
                        <p className="text-xs text-muted-foreground">Rank #4 • 12-2 Record</p>
                      </div>
                      <div className="bg-background/80 p-3 rounded-lg border text-left text-xs space-y-1">
                        <span className="font-semibold text-foreground text-[10px] uppercase tracking-wider block">Round 2 Track:</span>
                        <p className="font-bold truncate text-primary">🎵 {selectedRoundTrack}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Artist B */}
                  <Card className="border-border bg-card/40 relative overflow-hidden">
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
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
                        <p className="text-xs text-muted-foreground">Rank #9 • 8-4 Record</p>
                      </div>
                      <div className="bg-background/80 p-3 rounded-lg border text-left text-xs space-y-1 opacity-75">
                        <span className="font-semibold text-foreground text-[10px] uppercase tracking-wider block">Queued Response:</span>
                        <p className="font-bold truncate text-muted-foreground">🎵 Cyberpunk Anthem (WAV)</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Phase Specific Overlays */}
                {battlePhase === "track_select" && perspective === "artist" && (
                  <Card className="border-primary/40 bg-primary/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Music className="size-4 text-primary" /> Select Your Track for Next Round
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Artists can select or swap their round track up until their turn starts. BattleBot locks selection on turn start.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-3">
                      <Input
                        value={selectedRoundTrack}
                        onChange={(e) => setSelectedRoundTrack(e.target.value)}
                        placeholder="Enter track title..."
                        className="bg-background"
                      />
                      <Button onClick={() => toast({ title: "Track locked!", description: `${selectedRoundTrack} queued for round.` })}>
                        Confirm Track
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {battlePhase === "voting" && (
                  <Card className="border-rose-500/50 bg-rose-500/10">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2 text-rose-400">
                          <Trophy className="size-4" /> RealtimeKit Native Round 2 Poll (2:00 Remaining)
                        </CardTitle>
                        <Badge variant="destructive">MANDATORY VOTE</Badge>
                      </div>
                      <CardDescription className="text-xs">
                        Cast your vote now! Viewers who do not vote within 2 minutes will be moved to the spectator waiting room by BattleBot.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant={selectedVote === "MetroFlow" ? "default" : "outline"}
                          className="h-12 font-bold justify-between"
                          onClick={() => setSelectedVote("MetroFlow")}
                        >
                          <span>Vote MetroFlow</span>
                          <Badge variant="secondary">58%</Badge>
                        </Button>
                        <Button
                          variant={selectedVote === "ProducerKev" ? "default" : "outline"}
                          className="h-12 font-bold justify-between"
                          onClick={() => setSelectedVote("ProducerKev")}
                        >
                          <span>Vote ProducerKev</span>
                          <Badge variant="secondary">42%</Badge>
                        </Button>
                      </div>
                      <Progress value={58} className="h-2" />
                    </CardContent>
                  </Card>
                )}

                {battlePhase === "grace_period" && (
                  <Card className="border-amber-500/50 bg-amber-500/10">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Clock className="size-6 text-amber-500 animate-spin" />
                        <div>
                          <p className="font-bold text-sm text-foreground">Post-Battle 2-Minute Grace Period</p>
                          <p className="text-xs text-muted-foreground">
                            Battle complete! You have 2 minutes to talk in chat before BattleBot closes the room, downloads the chat dump, and generates the public replay recording.
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-amber-500/40 text-amber-500 font-mono text-sm px-3 py-1">
                        01:45
                      </Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Column: Persistent In-Stream Chat & OBS Controls */}
            <div className="space-y-6">
              {/* OBS & Software Connection Card for Artists */}
              {perspective === "artist" && (
                <Card className="border-purple-500/30 bg-purple-500/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Video className="size-4 text-purple-400" /> OBS / Encoder Connection
                      </CardTitle>
                      <Badge variant={obsConnected ? "default" : "outline"} className={obsConnected ? "bg-emerald-500" : ""}>
                        {obsConnected ? "1080p 60fps" : "Offline"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground space-y-1 font-mono bg-background/60 p-2.5 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-foreground font-bold">RTMP Ingest URL:</span>
                        <Button variant="ghost" size="icon" className="size-5" onClick={() => copyToClipboard("rtmp://ingest.mysoundkit.com/live", "RTMP URL")}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                      <p className="truncate text-primary">rtmp://ingest.mysoundkit.com/live</p>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[10px] text-foreground font-bold">Stream Key:</span>
                        <Button variant="ghost" size="icon" className="size-5" onClick={() => copyToClipboard("sk_live_obs_98765", "Stream Key")}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                      <p className="truncate">sk_live_obs_98765</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Persistent Live Chat Panel */}
              <Card className="flex flex-col h-[480px] border border-border">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="size-4 text-primary" /> Persistent Live Chat
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      Text Only (No Files)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{msg.sender}</span>
                        <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                      </div>
                      <p className="text-foreground bg-muted/40 p-2 rounded-md">{msg.text}</p>
                    </div>
                  ))}
                </CardContent>
                <form onSubmit={handleSendChat} className="p-3 border-t flex gap-2">
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

        {/* ---------------- LIVE STREAM TAB CONTENT ---------------- */}
        <TabsContent value="stream" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="relative rounded-2xl bg-black aspect-video border border-border flex items-center justify-center overflow-hidden shadow-2xl">
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <Badge variant="destructive" className="animate-pulse flex items-center gap-1.5">
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
                  <h2 className="text-xl font-bold text-white">Studio Session &amp; Album Cooking</h2>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Streaming live via OBS Studio with RealtimeKit H.264 simulcast video engine.
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Panel */}
            <div>
              <Card className="flex flex-col h-[420px] border border-border">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm">Stream Chat</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-0.5">
                      <span className="font-bold text-purple-400">{msg.sender}</span>
                      <p className="text-foreground bg-muted/40 p-2 rounded-md">{msg.text}</p>
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
                <div className="flex items-center gap-4">
                  <AppImage src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300" alt="Album Cover" className="size-28 rounded-xl object-cover border" />
                  <div>
                    <Badge className="bg-emerald-500 text-white text-[10px] uppercase mb-2">Listening Party</Badge>
                    <h2 className="text-2xl font-bold">Midnight Mixtape Premiere</h2>
                    <p className="text-xs text-muted-foreground">MetroFlow • Track 3 of 10 Playing</p>
                  </div>
                </div>
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
              <Card className="flex flex-col h-[420px] border border-border">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm">Listening Party Chat</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-0.5">
                      <span className="font-bold text-emerald-400">{msg.sender}</span>
                      <p className="text-foreground bg-muted/40 p-2 rounded-md">{msg.text}</p>
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
