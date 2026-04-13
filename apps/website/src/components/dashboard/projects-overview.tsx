import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Music, Clock, CheckCircle, Download, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const mockProjects = [
  {
    id: 1,
    name: "Summer Vibes",
    status: "complete",
    lastUpdated: "2 hours ago",
    files: {
      instrumental: true,
      vocals: true,
      adlibs: true,
      session: true,
      coverArt: true,
    },
    mixed: true,
    mastered: true,
  },
  {
    id: 2,
    name: "Late Night Sessions",
    status: "in-progress",
    lastUpdated: "1 day ago",
    files: {
      instrumental: true,
      vocals: true,
      adlibs: false,
      session: true,
      coverArt: false,
    },
    mixed: false,
    mastered: false,
  },
  {
    id: 3,
    name: "Collaboration Track",
    status: "in-progress",
    lastUpdated: "3 days ago",
    files: {
      instrumental: true,
      vocals: false,
      adlibs: false,
      session: false,
      coverArt: true,
    },
    mixed: false,
    mastered: false,
  },
]

export function ProjectsOverview() {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-[family-name:var(--font-playfair)]">Recent Projects</CardTitle>
            <CardDescription>Your latest music collaborations</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockProjects.map((project) => (
          <div
            key={project.id}
            className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-background/50"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{project.name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge
                    variant={project.status === "complete" ? "default" : "secondary"}
                    className={
                      project.status === "complete"
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-accent/20 text-accent border-accent/30"
                    }
                  >
                    {project.status === "complete" ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {project.status === "complete" ? "Complete" : "In Progress"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{project.lastUpdated}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* File Status Indicators */}
              <div className="hidden sm:flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {project.files.instrumental && <div className="w-2 h-2 bg-primary rounded-full" />}
                  {project.files.vocals && <div className="w-2 h-2 bg-primary rounded-full" />}
                  {project.files.adlibs && <div className="w-2 h-2 bg-primary rounded-full" />}
                  {project.files.session && <div className="w-2 h-2 bg-primary rounded-full" />}
                  {project.files.coverArt && <div className="w-2 h-2 bg-primary rounded-full" />}
                </div>
                <span className="text-xs text-muted-foreground">
                  {Object.values(project.files).filter(Boolean).length}/5 files
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit Project</DropdownMenuItem>
                    <DropdownMenuItem>Share</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
