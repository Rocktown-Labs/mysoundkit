import { useRouter } from "@tanstack/react-router"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AppImage } from "@/components/ui/app-image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Heart,
  Share2,
  Download,
  Clock,
  Headphones,
  Music,
  CheckCircle2,
  ShoppingCart,
  ArrowLeft,
} from "lucide-react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { TrackCard } from "@/components/explore/track-card"

export const Route = createFileRoute('/_explore/tracks/$id')({
  component: TrackPage,
})

function TrackPage() {
  const { id } = Route.useParams()
  const router = useRouter()

  // Mock data
  const track = {
    id,
    title: "Summer Nights",
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    cover: "/summer-music-album-cover.png",
    genre: "R&B/Soul",
    duration: "3:24",
    releaseDate: "December 15, 2024",
    plays: "2.4M",
    likes: "89K",
    bpm: 128,
    key: "Am",
    description:
      "A smooth R&B track perfect for late-night drives and summer evenings. Featuring silky vocals and atmospheric production.",
    price: "$2.99",
    isFree: false,
    verified: true,
    variants: ["Clean", "Explicit", "Instrumental"],
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4">
        <Button variant="ghost" size="icon" onClick={() => router.history.back()} className="shrink-0">
          <ArrowLeft className="size-5" />
        </Button>
      </div>

      <div className="container px-4 md:px-6 py-8">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Main Content */}
          <div className="space-y-8">
            {/* Hero Section - Spotify/Apple Music Style */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              <div className="relative w-full md:w-64 aspect-square rounded-lg overflow-hidden shadow-2xl shrink-0">
                <AppImage src={track.cover || "/placeholder.svg"} alt={track.title} width={512} height={512} layout="constrained" className="w-full h-full object-cover" />
              </div>

              <div className="flex flex-col justify-end">
                <Badge variant="secondary" className="w-fit mb-4">
                  {track.genre}
                </Badge>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{track.title}</h1>

                <Link to={`/${track.artistSlug}`} className="flex items-center gap-3 mb-6 group w-fit">
                  <Avatar className="size-12">
                    <AvatarImage src="/diverse-user-avatars.png" />
                    <AvatarFallback>{track.artist[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg group-hover:text-primary">{track.artist}</span>
                      {track.verified && <CheckCircle2 className="size-4 text-primary" />}
                    </div>
                    <span className="text-sm text-muted-foreground">{track.releaseDate}</span>
                  </div>
                </Link>

                <div className="flex items-center gap-3 mb-6">
                  <Button size="lg" className="gap-2">
                    <Play className="size-5 fill-current" />
                    Play
                  </Button>
                  <Button size="lg" variant="outline" className="gap-2 bg-transparent">
                    <ShoppingCart className="size-5" />
                    Buy {track.price}
                  </Button>
                  <Button size="lg" variant="ghost">
                    <Heart className="size-5" />
                  </Button>
                  <Button size="lg" variant="ghost">
                    <Share2 className="size-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Headphones className="size-4" />
                    <span>{track.plays} plays</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="size-4" />
                    <span>{track.likes} likes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    <span>{track.duration}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Track Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">About This Track</h3>
                <p className="text-muted-foreground mb-6">{track.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Genre</p>
                    <p className="font-medium">{track.genre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">BPM</p>
                    <p className="font-medium">{track.bpm}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Key</p>
                    <p className="font-medium">{track.key}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Duration</p>
                    <p className="font-medium">{track.duration}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Available Variants */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Available Versions</h3>
                <div className="grid gap-3">
                  {track.variants.map((variant) => (
                    <div
                      key={variant}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Music className="size-5 text-muted-foreground" />
                        <span className="font-medium">{variant}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost">
                          <Play className="size-4 mr-2" />
                          Play
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* More from Artist */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">More from {track.artist}</h3>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/${track.artistSlug}`}>View Profile</Link>
                </Button>
              </div>

              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex gap-4 md:grid md:grid-cols-4 min-w-max md:min-w-0">
                  {[1, 2, 3, 4].map((i) => (
                    <TrackCard
                      key={i}
                      id={`track-${i}`}
                      title={`Track ${i}`}
                      artist={track.artist}
                      artistSlug={track.artistSlug}
                      cover={i % 2 === 0 ? "/night-music-album-cover.png" : "/hip-hop-album-cover.png"}
                      plays={`${i}.${i}M`}
                      duration="3:24"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Artist Card */}
            <Card>
              <CardContent className="p-6">
                <Link to={`/${track.artistSlug}`} className="block group">
                  <Avatar className="size-24 mx-auto mb-4">
                    <AvatarImage src="/diverse-user-avatars.png" />
                    <AvatarFallback>{track.artist[0]}</AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <h4 className="font-semibold text-lg group-hover:text-primary">{track.artist}</h4>
                      {track.verified && <CheckCircle2 className="size-4 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">124K followers</p>
                    <Button className="w-full">Follow</Button>
                  </div>
                </Link>
              </CardContent>
            </Card>

            {/* Similar Tracks */}
            <Card>
              <CardContent className="p-6">
                <h4 className="font-semibold mb-4">You Might Also Like</h4>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Link key={i} to={`/tracks/track-${i}`} className="flex gap-3 group">
                      <div className="relative size-16 rounded-md overflow-hidden shrink-0">
                        <AppImage src="/summer-music-album-cover.png" alt="Track" width={64} height={64} layout="fixed" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm mb-1 truncate group-hover:text-primary">
                          Similar Track {i}
                        </h5>
                        <p className="text-xs text-muted-foreground truncate">Artist Name</p>
                        <p className="text-xs text-muted-foreground">1.2M plays</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
