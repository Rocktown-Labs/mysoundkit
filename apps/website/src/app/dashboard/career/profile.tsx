import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Music,
  Play,
  Download,
  ExternalLink,
  MapPin,
  Calendar,
} from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/career/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="space-y-6">
      {/* Profile Header - Instagram-like */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="flex justify-center md:justify-start">
              <Avatar className="size-32">
                <AvatarImage src="/diverse-user-avatars.png" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
                    John Doe
                  </h1>
                  <p className="text-muted-foreground">@johndoe</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/dashboard/career/settings">Edit Profile</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <a
                      href="https://mysoundkit.com/johndoe"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4 mr-2" />
                      View Public
                    </a>
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="font-bold text-xl">24</p>
                  <p className="text-sm text-muted-foreground">Tracks</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-xl">1.2K</p>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-xl">342</p>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <p className="text-sm">
                  Hip-hop producer and artist based in LA. Creating vibes since
                  2020. 🎵
                </p>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" />
                    Los Angeles, CA
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    Joined January 2024
                  </span>
                </div>
              </div>

              {/* Music Platform Links */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://spotify.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Spotify
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://music.apple.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apple Music
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    YouTube
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="tracks" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                    <Music className="size-12 text-white/50" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="size-6 text-white" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">Track Title {i}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Released Jan 2025
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Public</Badge>
                    <Button size="sm" variant="ghost">
                      <Download className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="size-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Music className="size-8 text-white/50" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Album Title {i}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        12 tracks • Released 2025
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Album</Badge>
                        <Badge variant="outline">Public</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="photos" className="mt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-square bg-muted rounded-lg overflow-hidden"
              >
                <AppImage
                  src={`/music-photo-.jpg?height=300&width=300&query=music photo ${i}`}
                  alt={`Photo ${i}`}
                  width={300}
                  height={300}
                  layout="constrained"
                  className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted rounded-t-lg overflow-hidden relative">
                    <AppImage
                      src={`/music-video-thumbnail.png?height=400&width=600&query=music video thumbnail ${i}`}
                      alt={`Video ${i}`}
                      width={600}
                      height={400}
                      layout="constrained"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Button size="icon" variant="ghost" className="size-16">
                        <Play className="size-8 text-white" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold mb-1">Video Title {i}</h3>
                    <p className="text-sm text-muted-foreground">
                      2.4K views • 2 days ago
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
