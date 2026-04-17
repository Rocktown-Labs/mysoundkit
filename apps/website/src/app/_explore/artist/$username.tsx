import { createFileRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import {
  MapPin,
  CheckCircle2,
  Instagram,
  Twitter,
  Youtube,
  Play,
  Share2,
  ArrowLeft,
  Grid3x3,
  Music,
} from "lucide-react";
import { useState } from "react";

import { PostDetailModal } from "@/components/explore/post-detail-modal";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_explore/artist/$username")({
  component: ArtistProfilePage,
});

function ArtistProfilePage() {
  const { username } = Route.useParams();
  const router = useRouter();

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const artist = {
    avatar: "/diverse-user-avatars.png",
    battles: 4,
    bio: "R&B/Soul artist from Los Angeles. Creating vibes for late nights and summer days. 🌙✨",
    coverImage: "/summer-music-album-cover.png",
    followers: "124K",
    following: "892",
    genre: "R&B/Soul",
    links: {
      apple: "https://music.apple.com",
      instagram: "https://instagram.com",
      spotify: "https://spotify.com",
      twitter: "https://twitter.com",
      youtube: "https://youtube.com",
    },
    location: "Los Angeles, CA",
    media: 6,
    name: "Luna Eclipse",
    projects: 3,
    tracks: 24,
    username,
    verified: true,
  };

  const allPosts = [
    ...Array.from({ length: 8 }, (_, i) => ({
      artist: {
        avatar: artist.avatar,
        name: artist.name,
        username: artist.username,
      },
      comments: Math.floor(Math.random() * 500) + 50,
      description: "New single out now! 🎵",
      id: `track-${i + 1}`,
      image:
        i % 2 === 0
          ? "/summer-music-album-cover.png"
          : "/night-music-album-cover.png",
      likes: Math.floor(Math.random() * 10_000) + 1000,
      title: `Summer Track ${i + 1}`,
      type: "track" as const,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      artist: {
        avatar: artist.avatar,
        name: artist.name,
        username: artist.username,
      },
      comments: Math.floor(Math.random() * 800) + 100,
      description: "New album available now!",
      id: `project-${i + 1}`,
      image: "/hip-hop-album-cover.png",
      likes: Math.floor(Math.random() * 15_000) + 2000,
      title: `Project ${i + 1}`,
      type: "project" as const,
    })),
  ];

  const tracks = allPosts.filter((p) => p.type === "track");
  const projects = allPosts.filter((p) => p.type === "project");

  const handlePostClick = (post: any, index: number) => {
    setSelectedPost(post);
    setSelectedIndex(index);
    setIsModalOpen(true);
  };

  const handleNavigate = (direction: "prev" | "next") => {
    const newIndex =
      direction === "prev" ? selectedIndex - 1 : selectedIndex + 1;
    setSelectedIndex(newIndex);
    setSelectedPost(allPosts[newIndex]);
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <div className="px-4 md:px-6 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.history.back()}
            className="shrink-0"
          >
            <ArrowLeft className="size-5" />
          </Button>
        </div>

        {/* Cover Image */}
        <div className="relative h-48 md:h-64 lg:h-80 overflow-hidden">
          <AppImage
            src={artist.coverImage || "/placeholder.svg"}
            alt="Cover"
            width={1600}
            height={640}
            layout="fullWidth"
            className="w-full h-full object-cover blur-sm scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>

        {/* Profile Info - Instagram Style */}
        <div className="px-4 md:px-6">
          <div className="relative -mt-16 md:-mt-20 mb-8">
            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <Avatar className="size-32 md:size-40 ring-4 ring-background">
                <AvatarImage src={artist.avatar || "/placeholder.svg"} />
                <AvatarFallback>{artist.name[0]}</AvatarFallback>
              </Avatar>

              <div className="flex-1 md:pb-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-bold">
                      {artist.name}
                    </h1>
                    {artist.verified && (
                      <CheckCircle2 className="size-6 text-primary" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 md:ml-auto">
                    <Button>Follow</Button>
                    <Button variant="outline">Message</Button>
                    <Button variant="ghost" size="icon">
                      <Share2 className="size-5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-6 mb-4 text-sm">
                  <div>
                    <span className="font-semibold">{artist.tracks}</span>{" "}
                    <span className="text-muted-foreground">tracks</span>
                  </div>
                  <div>
                    <span className="font-semibold">{artist.followers}</span>{" "}
                    <span className="text-muted-foreground">followers</span>
                  </div>
                  <div>
                    <span className="font-semibold">{artist.following}</span>{" "}
                    <span className="text-muted-foreground">following</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{artist.genre}</Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-4" />
                      {artist.location}
                    </span>
                  </div>
                  <p className="text-sm">{artist.bio}</p>

                  <div className="flex items-center gap-3 pt-2">
                    <a
                      href={artist.links.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Instagram className="size-5" />
                    </a>
                    <a
                      href={artist.links.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Twitter className="size-5" />
                    </a>
                    <a
                      href={artist.links.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Youtube className="size-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="all" className="pb-12">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger
                value="all"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent flex items-center gap-2"
              >
                <Grid3x3 className="size-4" />
                All
              </TabsTrigger>
              <TabsTrigger
                value="tracks"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent flex items-center gap-2"
              >
                <Music className="size-4" />
                Tracks
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Projects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-1">
              <div className="grid grid-cols-3 gap-1">
                {allPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="relative aspect-square cursor-pointer group overflow-hidden"
                    onClick={() => handlePostClick(post, index)}
                  >
                    <AppImage
                      src={post.image || "/placeholder.svg"}
                      alt={post.title}
                      width={640}
                      height={640}
                      layout="constrained"
                      className="w-full h-full object-cover"
                    />
                    {/* Hover overlay with stats */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                      <span className="flex items-center gap-1">
                        <Play className="size-5 fill-current" />
                        {post.likes.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tracks" className="mt-1">
              <div className="grid grid-cols-3 gap-1">
                {tracks.map((post, index) => (
                  <div
                    key={post.id}
                    className="relative aspect-square cursor-pointer group overflow-hidden"
                    onClick={() => handlePostClick(post, index)}
                  >
                    <AppImage
                      src={post.image || "/placeholder.svg"}
                      alt={post.title}
                      width={640}
                      height={640}
                      layout="constrained"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                      <span className="flex items-center gap-1">
                        <Play className="size-5 fill-current" />
                        {post.likes.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="projects" className="mt-1">
              <div className="grid grid-cols-3 gap-1">
                {projects.map((post, index) => (
                  <div
                    key={post.id}
                    className="relative aspect-square cursor-pointer group overflow-hidden"
                    onClick={() => handlePostClick(post, index)}
                  >
                    <AppImage
                      src={post.image || "/placeholder.svg"}
                      alt={post.title}
                      width={640}
                      height={640}
                      layout="constrained"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                      <span className="flex items-center gap-1">
                        <Play className="size-5 fill-current" />
                        {post.likes.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PostDetailModal
        post={selectedPost}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allPosts={allPosts}
        currentIndex={selectedIndex}
        onNavigate={handleNavigate}
      />
    </>
  );
}
