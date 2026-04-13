import { Button } from "@/components/ui/button"
import { Plus, Music, FolderPlus } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Link } from "@tanstack/react-router"

export function QuickActions() {
  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link to="/dashboard/tracks/new" className="cursor-pointer">
              <Music className="mr-2 h-4 w-4" />
              <div>
                <p className="font-medium">New Track</p>
                <p className="text-xs text-muted-foreground">Create a single song</p>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard/projects/new" className="cursor-pointer">
              <FolderPlus className="mr-2 h-4 w-4" />
              <div>
                <p className="font-medium">New Project</p>
                <p className="text-xs text-muted-foreground">Create an Album or EP</p>
              </div>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
