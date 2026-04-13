import { createFileRoute, Link } from "@tanstack/react-router"
import { Clock, Heart, Music, ShoppingBag, ListMusic, Settings } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const libraryCategories = [
  {
    title: "Recently Played",
    description: "Your listening history",
    icon: Clock,
    href: "/library/recent",
    color: "text-blue-500",
  },
  {
    title: "Playlists",
    description: "Your custom playlists",
    icon: ListMusic,
    href: "/library/playlists",
    color: "text-purple-500",
  },
  {
    title: "Saved Tracks",
    description: "Songs you've favorited",
    icon: Heart,
    href: "/library/saved",
    color: "text-red-500",
  },
  {
    title: "Purchased",
    description: "Tracks you own",
    icon: ShoppingBag,
    href: "/library/purchased",
    color: "text-green-500",
  },
  {
    title: "Account",
    description: "Manage your settings",
    icon: Settings,
    href: "/library/settings",
    color: "text-orange-500",
  },
]

export const Route = createFileRoute('/_explore/library/')({
  component: LibraryPage,
})

function LibraryPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
          <Music className="size-8 text-primary" />
          My SoundKit
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Access your music collection, playlists, and listening history
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {libraryCategories.map((category) => {
          const Icon = category.icon
          return (
            <Link key={category.href} to={category.href}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className={`size-6 ${category.color}`} />
                    </div>
                    <CardTitle className="text-xl">{category.title}</CardTitle>
                  </div>
                  <CardDescription className="text-base">{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full justify-start text-primary">
                    View {category.title}
                    <Music className="ml-auto size-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
