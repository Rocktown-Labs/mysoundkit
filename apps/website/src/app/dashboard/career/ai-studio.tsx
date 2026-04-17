import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles,
  ImageIcon,
  Video,
  Wand2,
  Download,
  Copy,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/career/ai-studio")({
  component: AIStudioPage,
});

function AIStudioPage() {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)] flex items-center gap-2">
          <Sparkles className="size-6 text-primary" />
          AI Studio
        </h1>
        <p className="text-muted-foreground">
          Generate cover art, videos, and promotional content with AI
        </p>
      </div>

      <Tabs defaultValue="cover-art" className="w-full">
        <TabsList>
          <TabsTrigger value="cover-art">Cover Art</TabsTrigger>
          <TabsTrigger value="video">Video Content</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
        </TabsList>

        <TabsContent value="cover-art" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Generation Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="size-5" />
                  Generate Cover Art
                </CardTitle>
                <CardDescription>
                  Create unique album and track covers with AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="track-name">Track/Album Name</Label>
                  <Input id="track-name" placeholder="Summer Vibes" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="style">Art Style</Label>
                  <select
                    id="style"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option>Abstract</option>
                    <option>Minimalist</option>
                    <option>Vintage</option>
                    <option>Futuristic</option>
                    <option>Graffiti</option>
                    <option>Photography</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Description</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the mood, colors, and elements you want in your cover art..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="colors">Color Palette</Label>
                  <div className="flex gap-2">
                    <Input id="colors" placeholder="e.g., purple, pink, blue" />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Wand2 className="size-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      Generate Cover Art
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  <Badge variant="outline" className="mr-2">
                    Premium
                  </Badge>
                  3 generations remaining this month
                </p>
              </CardContent>
            </Card>

            {/* Generated Results */}
            <Card>
              <CardHeader>
                <CardTitle>Generated Results</CardTitle>
                <CardDescription>Your AI-generated cover art</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="relative group">
                      <div className="aspect-square bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-lg" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Button size="icon" variant="ghost">
                          <Download className="size-4 text-white" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <Copy className="size-4 text-white" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Generation History</h4>
                  <div className="space-y-2">
                    {[
                      "Summer Vibes - Abstract",
                      "Night Drive - Minimalist",
                      "City Lights - Futuristic",
                    ].map((title, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded hover:bg-accent"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded" />
                          <span className="text-sm">{title}</span>
                        </div>
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="video" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="size-5" />
                  Generate Video Content
                </CardTitle>
                <CardDescription>
                  Create music visualizers and promotional videos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="video-track">Select Track</Label>
                  <select
                    id="video-track"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option>Summer Vibes</option>
                    <option>Night Drive</option>
                    <option>City Lights</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-style">Video Style</Label>
                  <select
                    id="video-style"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option>Audio Visualizer</option>
                    <option>Lyric Video</option>
                    <option>Abstract Animation</option>
                    <option>Social Media Teaser</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-prompt">Video Description</Label>
                  <Textarea
                    id="video-prompt"
                    placeholder="Describe the visual style and mood for your video..."
                    rows={4}
                  />
                </div>

                <Button className="w-full" disabled>
                  <Sparkles className="size-4 mr-2" />
                  Generate Video
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  <Badge variant="outline" className="mr-2">
                    Premium
                  </Badge>
                  Video generation takes 5-10 minutes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Video Queue</CardTitle>
                <CardDescription>Your video generation queue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      progress: 100,
                      status: "completed",
                      title: "Summer Vibes - Visualizer",
                    },
                    {
                      progress: 67,
                      status: "processing",
                      title: "Night Drive - Lyric Video",
                    },
                    {
                      progress: 0,
                      status: "queued",
                      title: "City Lights - Teaser",
                    },
                  ].map((video, i) => (
                    <div key={i} className="space-y-2 p-3 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{video.title}</p>
                        <Badge
                          variant={
                            video.status === "completed" ? "default" : "outline"
                          }
                        >
                          {video.status}
                        </Badge>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${video.progress}%` }}
                        />
                      </div>
                      {video.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-transparent"
                        >
                          <Download className="size-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="social" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5" />
                Social Media Content
              </CardTitle>
              <CardDescription>
                Generate posts, captions, and promotional content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="social-track">Track/Project</Label>
                    <select
                      id="social-track"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option>Summer Vibes</option>
                      <option>Night Drive</option>
                      <option>City Lights</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <select
                      id="platform"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option>Instagram</option>
                      <option>Twitter/X</option>
                      <option>TikTok</option>
                      <option>Facebook</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-type">Content Type</Label>
                    <select
                      id="content-type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option>Release Announcement</option>
                      <option>Behind the Scenes</option>
                      <option>Promotional Post</option>
                      <option>Story/Reel</option>
                    </select>
                  </div>

                  <Button className="w-full">
                    <Sparkles className="size-4 mr-2" />
                    Generate Content
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <p className="text-sm font-semibold mb-2">
                      Generated Caption:
                    </p>
                    <p className="text-sm">
                      🎵 New track alert! "Summer Vibes" is out now on all
                      platforms. This one's been cooking for a while and I can't
                      wait for you to hear it. Link in bio! 🔥
                      <br />
                      <br />
                      #NewMusic #SummerVibes #IndieArtist #MusicProducer
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-4 bg-transparent"
                    >
                      <Copy className="size-4 mr-2" />
                      Copy Caption
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg border">
                    <p className="text-sm font-semibold mb-2">
                      Suggested Hashtags:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "#NewMusic",
                        "#IndieArtist",
                        "#MusicProducer",
                        "#SummerVibes",
                        "#NowPlaying",
                      ].map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
