import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Mail,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
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
import { Input } from "@/components/ui/input";
import { useFriendsQuery, useMeQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

function TeamPage() {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const meQuery = useMeQuery();
  const friendsQuery = useFriendsQuery();
  const activeWorkspace = meQuery.data?.activeWorkspace;
  const people = friendsQuery.data ?? [];
  const filteredPeople = people.filter((person) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [person.name, person.username, person.email, person.role]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(query));
  });

  const teamStats = [
    {
      description: activeWorkspace?.name ?? "No active workspace selected",
      icon: Users,
      title: "Workspace",
      value: activeWorkspace ? "1" : "0",
    },
    {
      description: "People from messaging, credits, and follows",
      icon: UserCheck,
      title: "Collaborators",
      value: String(people.length),
    },
    {
      description: activeWorkspace?.role ?? "No role available",
      icon: ShieldCheck,
      title: "Your Role",
      value: activeWorkspace?.role ?? "Solo",
    },
    {
      description: "Pending invites require an organization API",
      icon: Clock,
      title: "Pending Invites",
      value: "0",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Team
          </h1>
          <p className="text-muted-foreground">
            Your active workspace and real collaborators from SoundKit.
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="mr-2 size-4" />
          Invite Member
        </Button>
      </div>

      <StatsGrid stats={teamStats} />

      <Card>
        <CardHeader>
          <CardTitle>Active Workspace</CardTitle>
          <CardDescription>
            Team data is tied to the workspace selected in your session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeWorkspace ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{activeWorkspace.name}</p>
                <p className="text-sm text-muted-foreground">
                  /{activeWorkspace.slug} - {activeWorkspace.workspaceType}
                </p>
              </div>
              <Badge variant="secondary">{activeWorkspace.role}</Badge>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-semibold">No workspace yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Finish onboarding or create an artist team plan to add members.
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link to="/dashboard/career/settings">Review Settings</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Collaborators</CardTitle>
              <CardDescription>
                Real people you follow, message, or credit.
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search people"
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

          {!friendsQuery.isLoading && filteredPeople.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Mail className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-semibold">No collaborators found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a message or credit someone on a track to build this list.
              </p>
            </div>
          )}

          {filteredPeople.length > 0 && (
            <div className="divide-y rounded-lg border">
              {filteredPeople.map((person) => (
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
                      <p className="font-semibold">{person.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {person.username ? `@${person.username}` : person.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {person.role && (
                      <Badge variant="outline">{person.role}</Badge>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link to="/dashboard/messages">Message</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog
        isOpen={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        seatsUsed={activeWorkspace ? 1 : 0}
        totalSeats={10}
      />
    </div>
  );
}
