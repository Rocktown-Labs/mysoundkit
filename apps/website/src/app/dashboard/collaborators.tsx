import { createFileRoute } from "@tanstack/react-router";
import { Mail, MoreVertical } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const mockCollaborators = [
  {
    avatar: "/diverse-user-avatars.png",
    email: "alex@soundkit.app",
    id: "1",
    joinedAt: "3 months ago",
    name: "Alex Johnson",
    projectCount: 8,
    role: "Producer",
    status: "active",
    trackCount: 15,
  },
  {
    avatar: "/diverse-user-avatars.png",
    email: "sam@soundkit.app",
    id: "2",
    joinedAt: "2 months ago",
    name: "Sam Rivera",
    projectCount: 5,
    role: "Artist",
    status: "active",
    trackCount: 12,
  },
];

export const Route = createFileRoute("/dashboard/collaborators")({
  component: CollaboratorsPage,
});

function CollaboratorsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
            Collaborators
          </h1>
          <p className="text-muted-foreground">
            Manage your team and invite new members
          </p>
        </div>
      </div>

      {/* Invite Section */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Invite Collaborator
          </CardTitle>
          <CardDescription>
            Send an invitation to collaborate on your music projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              className="bg-input/50 border-border/60"
            />
            <Button className="bg-primary hover:bg-primary/90">
              <Mail className="h-4 w-4 mr-2" />
              Send Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Collaborators List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockCollaborators.map((collaborator) => (
          <Card
            key={collaborator.id}
            className="bg-card/50 backdrop-blur-sm border-border/40"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={collaborator.avatar || "/placeholder.svg"}
                    />
                    <AvatarFallback>
                      {collaborator.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{collaborator.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {collaborator.email}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Profile</DropdownMenuItem>
                    <DropdownMenuItem>Send Message</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <Badge variant="secondary">{collaborator.role}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Projects</span>
                  <span>{collaborator.projectCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tracks</span>
                  <span>{collaborator.trackCount}</span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/40">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    {collaborator.status}
                  </Badge>
                  <span>Joined {collaborator.joinedAt}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
