import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  ImageIcon,
  Video,
  Wand2,
  Download,
  Copy,
  Share2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useMeQuery, useTracksQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/ai-studio")({
  component: AIStudioPage,
});

function AIStudioPage() {
  const { toast } = useToast();
  const meQuery = useMeQuery();
  const tracksQuery = useTracksQuery();

  const user = meQuery.data?.user;
  const isPremium =
    user?.accountType === "artist" ||
    Boolean(meQuery.data?.entitlements?.canCreateLiveBattles);
  const tracks = useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);

  const [selectedTrackId, setSelectedTrackId] = useState<string>(
    tracks[0]?.id ?? ""
  );
  const [selectedStyle, setSelectedStyle] = useState("Cyberpunk / Neon Synth");
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiCredits, setAiCredits] = useState(48);
  const [generating, setGenerating] = useState(false);

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? tracks[0],
    [tracks, selectedTrackId]
  );

  const sampleLyrics = selectedTrack
    ? `[Verse 1]\nLate nights in the studio, lights glowing gold\nBuilding up the soundkit, stories untold\n[Chorus]\nWe turn the volume up, echoes in the dark\nSoundKit AI studio, leaving a mark...`
    : "No track lyrics available.";

  const handleGenerate = (type: "cover" | "video" | "social") => {
    if (!isPremium && aiCredits <= 0) {
      toast({
        description:
          "Upgrade to SoundKit Premium ($22.99/mo) for 500 AI credits every month.",
        title: "AI Credits Depleted",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setAiCredits((prev) => Math.max(0, prev - 2));
      toast({
        description: `Generated AI ${type} content using Google Gemini model based on "${selectedTrack?.title ?? "Song"}" lyrics!`,
        title: "AI Generation Complete ✨",
      });
    }, 2200);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-playfair)] flex items-center gap-2">
            <Sparkles className="size-7 text-emerald-400" />
            AI Creative Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            Smart song-tied AI generator powered by Google Gemini APIs. Create
            cover art, visualizers, and social media campaigns directly from
            your song lyrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono py-1.5 px-3"
          >
            <Zap className="size-3.5 mr-1 text-emerald-400" /> {aiCredits} AI
            Credits Left
          </Badge>
          {!isPremium && (
            <Button
              asChild
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Link to="/pricing">Upgrade ($22.99/mo)</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Song Selection Header Card */}
      <Card className="border-border/40 bg-card/40">
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Active Song / Track Context
              </Label>
              <Select
                value={selectedTrackId}
                onValueChange={setSelectedTrackId}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select a track from your catalog..." />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      🎵 {t.title} ({t.genre})
                    </SelectItem>
                  ))}
                  {tracks.length === 0 && (
                    <SelectItem value="demo">
                      🎵 Demo Track: Midnight Echoes
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">
                Visual & Aesthetic Style
              </Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cyberpunk / Neon Synth">
                    Cyberpunk / Neon Synth
                  </SelectItem>
                  <SelectItem value="Vintage Vinyl 90s Hip-Hop">
                    Vintage Vinyl 90s Hip-Hop
                  </SelectItem>
                  <SelectItem value="Minimalist Modern Typography">
                    Minimalist Modern Typography
                  </SelectItem>
                  <SelectItem value="Abstract Fluid Gradient">
                    Abstract Fluid Gradient
                  </SelectItem>
                  <SelectItem value="Gritty Cinematic Dark Mode">
                    Gritty Cinematic Dark Mode
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Song Lyrics Preview */}
          <div className="p-4 rounded-xl border border-border/30 bg-background/30 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Lyrics Context Feed to Gemini Agent:
            </p>
            <p className="text-xs text-muted-foreground font-mono whitespace-pre-line leading-relaxed">
              {sampleLyrics}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tab Workspaces */}
      <Tabs defaultValue="cover-art" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="cover-art" className="gap-2 font-bold">
            <ImageIcon className="size-4" /> Cover Art
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2 font-bold">
            <Video className="size-4" /> Video Storyboard
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2 font-bold">
            <Share2 className="size-4" /> Social Campaign
          </TabsTrigger>
        </TabsList>

        {/* COVER ART TAB */}
        <TabsContent value="cover-art" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border/40 bg-card/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="size-5 text-emerald-400" />
                  Generate Album Cover Art
                </CardTitle>
                <CardDescription>
                  Synthesizes your track lyrics into visual prompts for high-res
                  cover art.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Custom Art Prompt (Optional)</Label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe specific visual elements e.g. neon microphone in dark rain..."
                    className="bg-background/50 min-h-[100px]"
                  />
                </div>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  onClick={() => handleGenerate("cover")}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Wand2 className="size-4 mr-2 animate-spin" />
                      Gemini Agent Rendering...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      Generate Cover Art (-2 Credits)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/40">
              <CardHeader>
                <CardTitle>AI Output Gallery</CardTitle>
                <CardDescription>
                  High-fidelity 3000x3000px artwork ready for distribution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-border/40 bg-gradient-to-br from-emerald-950 via-zinc-900 to-black p-4 flex flex-col justify-end"
                    >
                      <div className="absolute inset-0 bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors" />
                      <p className="text-xs font-bold text-white relative z-10">
                        {selectedTrack?.title || "Track"} Cover v{i}
                      </p>
                      <p className="text-[10px] text-muted-foreground relative z-10">
                        {selectedStyle}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* VIDEO TAB */}
        <TabsContent value="video" className="space-y-6 mt-6">
          <Card className="border-border/40 bg-card/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="size-5 text-emerald-400" />
                AI Video & Visualizer Storyboard
              </CardTitle>
              <CardDescription>
                Generates scene-by-scene video storyboards synced to your track
                sections.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => handleGenerate("video")}
                disabled={generating}
              >
                <Sparkles className="size-4 mr-2" /> Generate Video Storyboard
              </Button>

              <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-border/20">
                {[
                  {
                    scene: "0:00 - Intro",
                    text: "Camera glides across neon studio gear as bassline kicks in.",
                  },
                  {
                    scene: "0:45 - Verse 1",
                    text: "Timed lyrics float across screen with glitch particles.",
                  },
                  {
                    scene: "1:30 - Chorus Drop",
                    text: "High-contrast battle stage spotlight with crowd energy FX.",
                  },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-border/40 bg-background/40 space-y-2"
                  >
                    <Badge
                      variant="outline"
                      className="text-emerald-400 border-emerald-400/30"
                    >
                      {s.scene}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{s.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOCIAL TAB */}
        <TabsContent value="social" className="space-y-6 mt-6">
          <Card className="border-border/40 bg-card/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="size-5 text-emerald-400" />
                AI Social Media Campaign Engine
              </CardTitle>
              <CardDescription>
                Generates viral captions, TikTok video scripts, and promo
                announcements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => handleGenerate("social")}
                disabled={generating}
              >
                <Sparkles className="size-4 mr-2" /> Generate Social Posts (-2
                Credits)
              </Button>

              <div className="space-y-3 pt-4 border-t border-border/20">
                {[
                  {
                    platform: "TikTok / Reels Script",
                    post: `🔥 "Late nights in the studio... lights glowing gold!" My new single '${selectedTrack?.title || "Track"}' is OUT NOW! Hit the link in bio to stream and battle me live on SoundKit! 🎙️ #SoundKit #NewMusic`,
                  },
                  {
                    platform: "X / Twitter Post",
                    post: `🚨 FRESH RELEASE ALERT: '${selectedTrack?.title || "Track"}' just dropped! Recorded this one for all the real music lovers. Tap in on @SoundKit: https://mysoundkit.com/tracks/${selectedTrackId}`,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-border/40 bg-background/40 flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-xs font-bold text-emerald-400 mb-1">
                        {item.platform}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.post}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(item.post);
                        toast({ title: "Copied to Clipboard" });
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
