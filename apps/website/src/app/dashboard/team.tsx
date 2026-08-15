import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Mail,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { StatsGrid } from "@/components/dashboard/stats-grid";
import { InviteMemberDialog } from "@/components/dashboard/team/invite-member-dialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  useFriendsQuery,
  useMeQuery,
  useUpdateWorkspaceMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

interface PlanMember {
  email: string;
  id: string;
  name: string;
  role: string;
  status: "active" | "invited";
}

export function TeamPage() {
  const { toast } = useToast(),
   [isInviteOpen, setIsInviteOpen] = useState(false),
   [isRenameOpen, setIsRenameOpen] = useState(false),
   [newWorkspaceName, setNewWorkspaceName] = useState(""),
   [searchQuery, setSearchQuery] = useState(""),

   meQuery = useMeQuery(),
   friendsQuery = useFriendsQuery(),
   updateWorkspaceMutation = useUpdateWorkspaceMutation(),

   user = meQuery.data?.user,
   activeWorkspace = meQuery.data?.activeWorkspace,
   collaborators = friendsQuery.data ?? [],

  // Team Plan Seats state (5 total seats per subscription plan)
   [teamMembers, setTeamMembers] = useState<PlanMember[]>([
    {
      email: user?.email ?? "owner@mysoundkit.com",
      id: "member-owner",
      name: user?.displayName ?? "Workspace Owner",
      role: "Owner / Primary Account",
      status: "active",
    },
  ]),

   handleRenameWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      return;
    }
    try {
      await updateWorkspaceMutation.mutateAsync({ name: newWorkspaceName });
      setIsRenameOpen(false);
      toast({
        description: `Renamed workspace to "${newWorkspaceName}".`,
        title: "Workspace Updated",
      });
    } catch {
      toast({
        description: "Could not rename workspace.",
        title: "Error",
        variant: "destructive",
      });
    }
  },

   handleRevokeMember = (memberId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast({
      description: "Member access revoked.",
      title: "Plan Member Removed",
    });
  },

   filteredCollaborators = collaborators.filter((person) => {
    if (person.id === user?.id) {
      return false;
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [person.name, person.username, person.email, person.role]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(query));
  }),

   teamStats = [
    {
      description: activeWorkspace?.name ?? "My Workspace",
      icon: Users,
      title: "Active Workspace",
      value: "1",
    },
    {
      description: `${teamMembers.length} of 5 seats filled`,
      icon: UserPlus,
      title: "Plan Seats Used",
      value: `${teamMembers.length} / 5`,
    },
    {
      description: "People credited on your tracks & projects",
      icon: UserCheck,
      title: "Track Collaborators",
      value: String(collaborators.length),
    },
    {
      description: activeWorkspace?.role ?? "Owner",
      icon: ShieldCheck,
      title: "Your Role",
      value: activeWorkspace?.role ?? "Owner",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Team & Workspace
          </h1>
          <p className="text-muted-foreground">
            Manage your subscription plan seats, workspace details, and music
            collaborators.
          </p>
        </div>
        <Button
          onClick={() => setIsInviteOpen(true)}
          disabled={teamMembers.length >= 5}
        >
          <UserPlus className="mr-2 size-4" />
          Invite Plan Member ({teamMembers.length}/5)
        </Button>
      </div>

      <StatsGrid stats={teamStats} />

      {/* Workspace Management Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Workspace Configuration</CardTitle>
            <CardDescription>
              Your team name is tied to your SoundKit creator workspace &
              billing profile.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNewWorkspaceName(activeWorkspace?.name ?? "My Workspace");
              setIsRenameOpen(true);
            }}
          >
            <Pencil className="mr-2 size-3.5" />
            Rename Workspace
          </Button>
        </CardHeader>
        <CardContent>
          {activeWorkspace ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-base">
                  {activeWorkspace.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  /{activeWorkspace.slug} • {activeWorkspace.workspaceType}{" "}
                  workspace
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{activeWorkspace.role}</Badge>
                <Badge variant="outline">5 Plan Seats Included</Badge>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-semibold">Default Personal Workspace</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rename your workspace or invite team members below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Plan Members Card */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Team Members (5 Seats Included)</CardTitle>
          <CardDescription>
            Add managers, assistant engineers, or family members to share your
            plan access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y rounded-lg border">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      member.status === "active" ? "default" : "secondary"
                    }
                  >
                    {member.role}
                  </Badge>
                  {member.id !== "member-owner" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevokeMember(member.id)}
                    >
                      <Trash2 className="size-4 mr-1" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Track & Project Collaborators Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Track & Song Collaborators</CardTitle>
              <CardDescription>
                Artists, features, and producers credited on your songs and
                projects.
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search collaborators..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {friendsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading collaborators...
            </p>
          )}

          {!friendsQuery.isLoading && filteredCollaborators.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Mail className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-semibold">No track collaborators found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Credit features or producers on your uploaded tracks to list
                them here.
              </p>
            </div>
          )}

          {filteredCollaborators.length > 0 && (
            <div className="divide-y rounded-lg border">
              {filteredCollaborators.map((person) => (
                <div
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={person.id}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={person.avatarUrl ?? undefined} />
                      <AvatarFallback>{person.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{person.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {person.username ? `@${person.username}` : person.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {person.role && (
                      <Badge variant="outline">{person.role}</Badge>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link
                        search={{ friendId: person.id }}
                        to="/dashboard/messages"
                      >
                        Message
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename Workspace Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>
              Enter a new name for your SoundKit creator workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace Name</Label>
              <Input
                id="ws-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g. Apex Music Group"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameWorkspace}
              disabled={updateWorkspaceMutation.isPending}
            >
              Save Workspace Name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteMemberDialog
        isOpen={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        seatsUsed={teamMembers.length}
        totalSeats={5}
      />
    </div>
  );
}
