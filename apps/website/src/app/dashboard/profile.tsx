import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AppImage } from "@/components/ui/app-image"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, CheckCircle2, Instagram, Twitter, Youtube, Share2, Settings, Grid3x3, Music, Play } from "lucide-react"
import { PostDetailModal } from "@/components/explore/post-detail-modal"
import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute('/dashboard/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const user = {
    username: "johndoe",
    name: "John Doe",
    avatar: "/diverse-user-avatars.png",
    coverImage: "/hip-hop-album-cover.png",
    bio: "Hip-hop producer and artist based in LA. Creating vibes since 2020.",
    genre: "Hip-Hop",
    location: "Los Angeles, CA",
    verified: false,
    followers: "5.2K",
    following: "342",
    tracks: 12,
    projects: 2,
    links: {
      instagram: "https://instagram.com",
      twitter: "https://twitter.com",
      youtube: "https://youtube.com",
    },
  }

  const allPosts = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `track-${i + 1}`,
      type: "track" as const,
      image:
        i % 3 === 0
          ? "/summer-music-album-cover.png"
          : i % 3 === 1
            ? "/night-music-album-cover.png"
            : "/hip-hop-album-cover.png",
      title: `Track ${i + 1}`,
      description: "Check out my latest track! 🎵",
      likes: Math.floor(Math.random() * 5000) + 500,
      comments: Math.floor(Math.random() * 200) + 20,
      artist: {
        name: user.name,
        avatar: user.avatar,
        username: user.username,
      },
    })),
  ]

  const tracks = allPosts.filter((p) => p.type === "track")

  const handlePostClick = (post: any, index: number) => {
    setSelectedPost(post)
    setSelectedIndex(index)
    setIsModalOpen(true)
  }

  const handleNavigate = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? selectedIndex - 1 : selectedIndex + 1
    setSelectedIndex(newIndex)
    setSelectedPost(allPosts[newIndex])
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Profile</h1>
          <p className="text-muted-foreground">Manage your public artist profile</p>
        </div>

        {/* Cover Image */}
        <div className="relative h-48 md:h-64 rounded-lg overflow-hidden">
          <AppImage
            src={user.coverImage || "/placeholder.svg"}
            alt="Cover"
            width={1600}
            height={640}
            layout="fullWidth"
            className="w-full h-full object-cover blur-sm scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>

        {/* Profile Info - Instagram Style */}
        <div className="relative -mt-16 md:-mt-20 mb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <Avatar className="size-32 md:size-40 ring-4 ring-background">
              <AvatarImage src={user.avatar || "/placeholder.svg"} />
              <AvatarFallback>{user.name[0]}</AvatarFallback>
            </Avatar>

            <div className="flex-1 md:pb-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold">{user.name}</h1>
                  {user.verified && <CheckCircle2 className="size-6 text-primary" />}
                </div>

                <div className="flex items-center gap-2 md:ml-auto">
                  <Link to="/dashboard/profile/edit">
                    <Button variant="outline">
                      <Settings className="size-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon">
                    <Share2 className="size-5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-6 mb-4 text-sm">
                <div>
                  <span className="font-semibold">{user.tracks}</span>{" "}
                  <span className="text-muted-foreground">tracks</span>
                </div>
                <div>
                  <span className="font-semibold">{user.followers}</span>{" "}
                  <span className="text-muted-foreground">followers</span>
                </div>
                <div>
                  <span className="font-semibold">{user.following}</span>{" "}
                  <span className="text-muted-foreground">following</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{user.genre}</Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-4" />
                    {user.location}
                  </span>
                </div>
                <p className="text-sm">{user.bio}</p>

                <div className="flex items-center gap-3 pt-2">
                  <a
                    href={user.links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Instagram className="size-5" />
                  </a>
                  <a
                    href={user.links.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Twitter className="size-5" />
                  </a>
                  <a
                    href={user.links.youtube}
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
          </TabsList>

          <TabsContent value="all" className="mt-1">
            <div className="grid grid-cols-3 gap-1">
              {allPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="relative aspect-square cursor-pointer group overflow-hidden"
                  onClick={() => handlePostClick(post, index)}
                >
                  <AppImage src={post.image || "/placeholder.svg"} alt={post.title} width={640} height={640} layout="constrained" className="w-full h-full object-cover" />
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
                  <AppImage src={post.image || "/placeholder.svg"} alt={post.title} width={640} height={640} layout="constrained" className="w-full h-full object-cover" />
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

      {/* Post detail modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allPosts={allPosts}
        currentIndex={selectedIndex}
        onNavigate={handleNavigate}
      />
    </>
  )
}
