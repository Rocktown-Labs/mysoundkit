import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AppImage } from "@/components/ui/app-image"
import { Clock, CheckCircle, Download, MoreHorizontal, Play } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Link } from "@tanstack/react-router"

const mockProjects = [
  {
    id: 1,
    name: "Summer Vibes",
    description: "Upbeat track for summer playlist",
    status: "complete",
    lastUpdated: "2 hours ago",
    progress: 100,
    files: {
      instrumental: true,
      vocals: true,
      adlibs: true,
      session: true,
      coverArt: true,
      reference: true,
    },
    mixed: true,
    mastered: true,
    coverArt: "/summer-music-album-cover.png",
  },
  {
    id: 2,
    name: "Late Night Sessions",
    description: "Moody R&B collaboration",
    status: "in-progress",
    lastUpdated: "1 day ago",
    progress: 70,
    files: {
      instrumental: true,
      vocals: true,
      adlibs: false,
      session: true,
      coverArt: false,
      reference: true,
    },
    mixed: false,
    mastered: false,
    coverArt: "/night-music-album-cover.png",
  },
  {
    id: 3,
    name: "Collaboration Track",
    description: "Hip-hop beat with guest vocals",
    status: "in-progress",
    lastUpdated: "3 days ago",
    progress: 45,
    files: {
      instrumental: true,
      vocals: false,
      adlibs: false,
      session: false,
      coverArt: true,
      reference: false,
    },
    mixed: false,
    mastered: false,
    coverArt: "/hip-hop-album-cover.png",
  },
  {
    id: 4,
    name: "Acoustic Demo",
    description: "Simple acoustic guitar and vocals",
    status: "draft",
    lastUpdated: "1 week ago",
    progress: 25,
    files: {
      instrumental: false,
      vocals: true,
      adlibs: false,
      session: false,
      coverArt: false,
      reference: false,
    },
    mixed: false,
    mastered: false,
    coverArt: "/acoustic-guitar-album.png",
  },
]

export function ProjectGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {mockProjects.map((project) => (
        <Card
          key={project.id}
          className="bg-card/50 backdrop-blur-sm border-border/40 hover:border-primary/40 transition-colors group"
        >
          <CardHeader className="pb-3">
            <div className="aspect-square relative mb-3 rounded-lg overflow-hidden bg-muted">
              <AppImage
                src={project.coverArt || "/placeholder.svg"}
                alt={`${project.name} cover`}
                width={640}
                height={640}
                layout="constrained"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button size="sm" variant="secondary" className="bg-white/20 backdrop-blur-sm">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg font-[family-name:var(--font-playfair)] truncate">
                  <Link to={`/dashboard/projects/${project.id}`} className="hover:text-primary transition-colors">
                    {project.name}
                  </Link>
                </CardTitle>
                <CardDescription className="text-sm mt-1">{project.description}</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit Project</DropdownMenuItem>
                  <DropdownMenuItem>Download All</DropdownMenuItem>
                  <DropdownMenuItem>Share</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status and Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    project.status === "complete"
                      ? "default"
                      : project.status === "in-progress"
                        ? "secondary"
                        : "outline"
                  }
                  className={
                    project.status === "complete"
                      ? "bg-primary/20 text-primary border-primary/30"
                      : project.status === "in-progress"
                        ? "bg-accent/20 text-accent border-accent/30"
                        : "bg-muted/20 text-muted-foreground border-muted/30"
                  }
                >
                  {project.status === "complete" ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </Badge>
                <span className="text-xs text-muted-foreground">{project.lastUpdated}</span>
              </div>
              <Progress value={project.progress} className="h-2" />
            </div>

            {/* File Status */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Files</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div
                  className={`flex items-center space-x-1 ${project.files.instrumental ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className={`w-2 h-2 rounded-full ${project.files.instrumental ? "bg-primary" : "bg-muted"}`} />
                  <span>Instrumental</span>
                </div>
                <div
                  className={`flex items-center space-x-1 ${project.files.vocals ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className={`w-2 h-2 rounded-full ${project.files.vocals ? "bg-primary" : "bg-muted"}`} />
                  <span>Vocals</span>
                </div>
                <div
                  className={`flex items-center space-x-1 ${project.files.adlibs ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className={`w-2 h-2 rounded-full ${project.files.adlibs ? "bg-primary" : "bg-muted"}`} />
                  <span>Adlibs</span>
                </div>
                <div
                  className={`flex items-center space-x-1 ${project.files.session ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className={`w-2 h-2 rounded-full ${project.files.session ? "bg-primary" : "bg-muted"}`} />
                  <span>Session</span>
                </div>
                <div
                  className={`flex items-center space-x-1 ${project.files.coverArt ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className={`w-2 h-2 rounded-full ${project.files.coverArt ? "bg-primary" : "bg-muted"}`} />
                  <span>Cover Art</span>
                </div>
                <div
                  className={`flex items-center space-x-1 ${project.files.reference ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className={`w-2 h-2 rounded-full ${project.files.reference ? "bg-primary" : "bg-muted"}`} />
                  <span>Reference</span>
                </div>
              </div>
            </div>

            {/* Mix/Master Status */}
            <div className="flex items-center space-x-4 text-xs">
              <div
                className={`flex items-center space-x-1 ${project.mixed ? "text-primary" : "text-muted-foreground"}`}
              >
                <CheckCircle className={`h-3 w-3 ${project.mixed ? "text-primary" : "text-muted"}`} />
                <span>Mixed</span>
              </div>
              <div
                className={`flex items-center space-x-1 ${project.mastered ? "text-primary" : "text-muted-foreground"}`}
              >
                <CheckCircle className={`h-3 w-3 ${project.mastered ? "text-primary" : "text-muted"}`} />
                <span>Mastered</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 pt-2">
              <Link to={`/dashboard/projects/${project.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  View Details
                </Button>
              </Link>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
