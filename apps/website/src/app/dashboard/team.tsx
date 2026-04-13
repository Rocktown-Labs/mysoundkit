import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Mail, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const teamMembers = [
  {
    id: 1,
    name: "Jessica Martinez",
    email: "jessica@example.com",
    role: "Manager",
    avatar: "/diverse-user-avatars.png",
    status: "Active",
  },
  {
    id: 2,
    name: "David Kim",
    email: "david@example.com",
    role: "Social Media Manager",
    avatar: "/diverse-user-avatars.png",
    status: "Active",
  },
  {
    id: 3,
    name: "Emma Wilson",
    email: "emma@example.com",
    role: "Marketing",
    avatar: "/diverse-user-avatars.png",
    status: "Active",
  },
]

export const Route = createFileRoute('/dashboard/team')({
  component: TeamPage,
})

function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">Team</h1>
          <p className="text-muted-foreground">Manage your team members and their roles</p>
        </div>
        <Button>
          <UserPlus className="mr-2 size-4" />
          Invite Team Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Team members have access to help manage your music career (managers, social media, marketing, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                  <Avatar className="size-12">
                    <AvatarImage src={member.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{member.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="size-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{member.role}</Badge>
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    {member.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit Role</DropdownMenuItem>
                      <DropdownMenuItem>View Activity</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team vs Collaborators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">Team Members</h3>
            <p className="text-sm text-muted-foreground">
              Team members help manage your music career. They have broader access to your account and can help with
              management, marketing, social media, and other business aspects.
            </p>
          </div>
          <div className="p-4 rounded-lg border">
            <h3 className="font-semibold mb-2">Collaborators</h3>
            <p className="text-sm text-muted-foreground">
              Collaborators are artists you work with on specific tracks or projects. They only have access to the
              tracks/projects they're invited to, with read and write permissions (but cannot delete).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
