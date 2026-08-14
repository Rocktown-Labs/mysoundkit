"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Heart,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  useCreateFriendRequestMutation,
  useFriendRequestsQuery,
  useFriendsQuery,
  useMeQuery,
  useRespondFriendRequestMutation,
  useSearchQuery,
} from "@/lib/soundkit-api-hooks";
import type { FriendSummary } from "@/lib/soundkit-api-hooks";

type CollaboratorsTab =
  | "all"
  | "collaborators"
  | "friends"
  | "requests"
  | "following";

interface CollaboratorsSearch {
  tab?: CollaboratorsTab;
}

export const Route = createFileRoute("/dashboard/collaborators")({
  component: FriendsPage,
  validateSearch: (search: Record<string, unknown>): CollaboratorsSearch => ({
    tab:
      search.tab === "collaborators" ||
      search.tab === "friends" ||
      search.tab === "requests" ||
      search.tab === "following" ||
      search.tab === "all"
        ? search.tab
        : "all",
  }),
});

const getRelationshipBadge = (relationship: string) => {
  switch (relationship) {
    case "collaborator": {
      return (
        <Badge
          variant="outline"
          className="border-violet-500/40 bg-violet-500/10 text-violet-400 capitalize gap-1"
        >
          <Sparkles className="size-3" />
          Collaborator
        </Badge>
      );
    }
    case "friend": {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 capitalize gap-1"
        >
          <UserCheck className="size-3" />
          Friend
        </Badge>
      );
    }
    case "fan": {
      return (
        <Badge
          variant="outline"
          className="border-pink-500/40 bg-pink-500/10 text-pink-400 capitalize gap-1"
        >
          <Heart className="size-3" />
          Fan
        </Badge>
      );
    }
    case "following": {
      return (
        <Badge
          variant="outline"
          className="border-sky-500/40 bg-sky-500/10 text-sky-400 capitalize"
        >
          Following
        </Badge>
      );
    }
    default: {
      return (
        <Badge variant="secondary" className="capitalize">
          {relationship}
        </Badge>
      );
    }
  }
};

function ArtistSearchResultRow({
  artist,
}: {
  artist: { genre?: string; id: string; name: string; username: string };
}) {
  const friendRequestMutation = useCreateFriendRequestMutation();
  const [isPending, setIsPending] = useState(false);

  const handleAdd = async () => {
    try {
      await friendRequestMutation.mutateAsync({ username: artist.username });
      setIsPending(true);
      toast({
        description: `Friend request sent to @${artist.username}. Pending acceptance.`,
        title: "Friend request sent",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Failed to send request",
        title: "Error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{artist.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          @{artist.username} {artist.genre ? `• ${artist.genre}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild={true} size="sm" variant="outline">
          <Link params={{ username: artist.username }} to="/artist/$username">
            Profile
          </Link>
        </Button>
        {isPending ? (
          <Badge
            variant="outline"
            className="text-amber-500 border-amber-500/40 px-3 py-1.5 font-bold gap-1 text-xs"
          >
            <Clock className="size-3" /> Pending Request
          </Badge>
        ) : (
          <Button
            disabled={friendRequestMutation.isPending}
            onClick={() => {
              void handleAdd();
            }}
            size="sm"
          >
            <UserPlus className="mr-1.5 size-4" /> Add Friend
          </Button>
        )}
      </div>
    </div>
  );
}

function PersonCard({ person }: { person: FriendSummary }) {
  return (
    <Card
      className="border-border/40 bg-card/40 transition-all hover:border-border/60 hover:bg-card/60"
      key={`${person.relationship}-${person.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <Avatar className="size-12 border border-border/40">
                <AvatarImage src={person.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {person.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {(person.relationship === "friend" ||
                person.relationship === "collaborator") && (
                <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{person.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {person.username ? `@${person.username}` : person.email}
              </p>
            </div>
          </div>
          {getRelationshipBadge(person.relationship)}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/30 pt-4">
          <div className="min-w-0 text-sm text-muted-foreground">
            {person.role ?? (person.relationship === "fan" ? "Fan" : "Artist")}
          </div>
          <div className="flex items-center gap-2">
            {person.username && (
              <Button asChild size="sm" variant="outline">
                <Link
                  params={{ username: person.username }}
                  to="/artist/$username"
                >
                  Profile
                </Link>
              </Button>
            )}
            {(person.relationship === "friend" ||
              person.relationship === "collaborator") && (
              <Button asChild={true} size="sm">
                <Link search={{ friendId: person.id }} to="/dashboard/messages">
                  <MessageSquare className="mr-2 size-4" />
                  Message
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FriendsPage() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab: CollaboratorsTab = searchParams.tab ?? "all";

  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFriendHandle, setNewFriendHandle] = useState("");

  const friendsQuery = useFriendsQuery();
  const friendRequestsQuery = useFriendRequestsQuery();
  const createFriendRequestMutation = useCreateFriendRequestMutation();
  const respondFriendRequestMutation = useRespondFriendRequestMutation();

  const allConnections = useMemo(
    () => (Array.isArray(friendsQuery.data) ? friendsQuery.data : []),
    [friendsQuery.data]
  );
  const friendRequests = useMemo(
    () =>
      Array.isArray(friendRequestsQuery.data) ? friendRequestsQuery.data : [],
    [friendRequestsQuery.data]
  );

  const meQuery = useMeQuery();
  const currentUserId = meQuery.data?.user?.id;

  const normalizedSearch = search.trim().replace(/^@/u, "");

  const peopleSearchQuery = useSearchQuery({
    limit: "8",
    q: normalizedSearch,
    type: "artists",
  });

  const searchedArtists = peopleSearchQuery.data?.artists ?? [];

  // Filter self out and search needle
  const filteredConnections = useMemo(() => {
    const needle = normalizedSearch.toLowerCase();

    return allConnections.filter((person) => {
      if (person.id === currentUserId) {
        return false;
      }
      if (!needle) {
        return true;
      }

      return [person.name, person.email, person.username, person.role]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [allConnections, currentUserId, normalizedSearch]);

  const collaborators = useMemo(
    () =>
      filteredConnections.filter(
        (person) => person.relationship === "collaborator"
      ),
    [filteredConnections]
  );

  const mutualFriends = useMemo(
    () =>
      filteredConnections.filter((person) => person.relationship === "friend"),
    [filteredConnections]
  );

  const followingAndFans = useMemo(
    () =>
      filteredConnections.filter(
        (person) =>
          person.relationship === "following" || person.relationship === "fan"
      ),
    [filteredConnections]
  );

  const pendingIncomingRequests = useMemo(
    () =>
      friendRequests.filter(
        (request) =>
          request.status === "pending" && request.direction === "incoming"
      ),
    [friendRequests]
  );

  const pendingOutgoingRequests = useMemo(
    () =>
      friendRequests.filter(
        (request) =>
          request.status === "pending" && request.direction === "outgoing"
      ),
    [friendRequests]
  );

  const totalPendingCount =
    pendingIncomingRequests.length + pendingOutgoingRequests.length;

  const handleTabChange = (newTab: string) => {
    void navigate({
      search: {
        tab: newTab as CollaboratorsTab,
      },
    });
  };

  const handleManualAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = newFriendHandle.trim().replace(/^@/u, "");
    if (!handle) {
      return;
    }

    try {
      await createFriendRequestMutation.mutateAsync({ username: handle });
      toast({
        description: `Sent friend request to @${handle}.`,
        title: "Friend request sent",
      });
      setNewFriendHandle("");
      setIsAddModalOpen(false);
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Unable to send friend request.",
        title: "Error",
        variant: "destructive",
      });
    }
  };

  const respondToRequest = async ({
    action,
    requestId,
  }: {
    action: "accept" | "cancel" | "decline";
    requestId: string;
  }) => {
    try {
      await respondFriendRequestMutation.mutateAsync({ action, requestId });
      toast({
        description:
          action === "accept"
            ? "Friend request accepted. You can now chat and collaborate."
            : (action === "cancel"
              ? "Friend request canceled."
              : "Friend request declined."),
        title: action === "accept" ? "Friend Added" : "Request Updated",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Could not update friend request.",
        title: "Error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Friends &amp; Collaborators
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your music collaborators, artist friends, requests, and
            followers.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <UserRoundPlus className="mr-2 size-4" />
          Add Friend
        </Button>
      </div>

      {/* Search Input Card */}
      <Card className="border-border/40 bg-card/40">
        <CardHeader className="pb-3">
          <CardTitle className="font-[family-name:var(--font-playfair)] text-lg">
            Find People
          </CardTitle>
          <CardDescription>
            Search by name, handle (@username), email, or musical role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="bg-background/50 pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, @username, handle, email, or role"
              value={search}
            />
            {search && (
              <Button
                className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                onClick={() => setSearch("")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <Tabs
        className="w-full space-y-6"
        onValueChange={handleTabChange}
        value={activeTab}
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-card/60 border border-border/40">
          <TabsTrigger value="all" className="gap-2 py-2 text-xs md:text-sm">
            <Users className="size-4" />
            All
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {filteredConnections.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="collaborators"
            className="gap-2 py-2 text-xs md:text-sm"
          >
            <Sparkles className="size-4" />
            Collaborators
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {collaborators.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="friends"
            className="gap-2 py-2 text-xs md:text-sm"
          >
            <UserCheck className="size-4" />
            Friends
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {mutualFriends.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="gap-2 py-2 text-xs md:text-sm relative"
          >
            <Clock className="size-4" />
            Requests
            {totalPendingCount > 0 ? (
              <Badge
                variant="default"
                className="bg-primary text-primary-foreground px-1.5 py-0 text-[10px] animate-pulse"
              >
                {totalPendingCount}
              </Badge>
            ) : (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                0
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="following"
            className="col-span-2 md:col-span-1 gap-2 py-2 text-xs md:text-sm"
          >
            <Heart className="size-4" />
            Following &amp; Fans
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {followingAndFans.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content: ALL */}
        <TabsContent value="all" className="space-y-6">
          {/* Pending incoming requests banner if any */}
          {pendingIncomingRequests.length > 0 && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Incoming Friend Requests ({pendingIncomingRequests.length})
                  </CardTitle>
                  <Button
                    onClick={() => handleTabChange("requests")}
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                  >
                    View all requests &rarr;
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {pendingIncomingRequests.map((request) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 p-3"
                    key={request.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {request.displayName}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {request.username ? `@${request.username}` : "Artist"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        disabled={respondFriendRequestMutation.isPending}
                        onClick={() => {
                          void respondToRequest({
                            action: "decline",
                            requestId: request.id,
                          });
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Decline
                      </Button>
                      <Button
                        disabled={respondFriendRequestMutation.isPending}
                        onClick={() => {
                          void respondToRequest({
                            action: "accept",
                            requestId: request.id,
                          });
                        }}
                        size="sm"
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {friendsQuery.isLoading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-36 rounded-xl" key={index} />
              ))}
            </div>
          )}

          {friendsQuery.error && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-6 text-sm text-destructive">
                Connections are unavailable right now. Refresh and try again.
              </CardContent>
            </Card>
          )}

          {!friendsQuery.isLoading && !friendsQuery.error && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredConnections.map((person) => (
                <PersonCard
                  key={`${person.relationship}-${person.id}`}
                  person={person}
                />
              ))}

              {filteredConnections.length === 0 && (
                <Card className="border-dashed border-border/50 bg-card/30 md:col-span-2">
                  <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                    <Mail className="size-8 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">
                        {search
                          ? "No connections matched"
                          : "No connections found"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {search
                          ? "Check public artist search results below."
                          : "Search for artists by handle or email to add them as friends."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab Content: COLLABORATORS */}
        <TabsContent value="collaborators" className="space-y-6">
          <div className="text-sm text-muted-foreground mb-2">
            Track and song collaborators credited or invited to your projects.
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {collaborators.map((person) => (
              <PersonCard
                key={`${person.relationship}-${person.id}`}
                person={person}
              />
            ))}

            {collaborators.length === 0 && (
              <Card className="border-dashed border-border/50 bg-card/30 md:col-span-2">
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <Sparkles className="size-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">
                      No track collaborators found
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Collaborators added to your uploaded songs and tracks will
                      appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab Content: FRIENDS */}
        <TabsContent value="friends" className="space-y-6">
          <div className="text-sm text-muted-foreground mb-2">
            Mutual accepted artist connections with direct messaging access.
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mutualFriends.map((person) => (
              <PersonCard
                key={`${person.relationship}-${person.id}`}
                person={person}
              />
            ))}

            {mutualFriends.length === 0 && (
              <Card className="border-dashed border-border/50 bg-card/30 md:col-span-2">
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <UserCheck className="size-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">No mutual friends yet</p>
                    <p className="text-sm text-muted-foreground">
                      Send a friend request to artists you want to chat and
                      collaborate with.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    size="sm"
                    variant="outline"
                  >
                    <UserRoundPlus className="mr-2 size-4" />
                    Add Friend
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab Content: REQUESTS */}
        <TabsContent value="requests" className="space-y-6">
          {/* Incoming Requests */}
          <Card className="border-border/40 bg-card/40">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-playfair)] flex items-center gap-2">
                <ArrowDownLeft className="size-5 text-emerald-400" />
                Incoming Requests ({pendingIncomingRequests.length})
              </CardTitle>
              <CardDescription>
                Artists requesting to connect and chat with you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingIncomingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No incoming friend requests right now.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {pendingIncomingRequests.map((request) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/50 p-3"
                      key={request.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {request.displayName}
                        </p>
                        <p className="truncate text-muted-foreground text-xs">
                          {request.username ? `@${request.username}` : "Artist"}
                        </p>
                        {request.message && (
                          <p className="mt-1 text-xs text-muted-foreground/80 italic line-clamp-1">
                            &ldquo;{request.message}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          disabled={respondFriendRequestMutation.isPending}
                          onClick={() => {
                            void respondToRequest({
                              action: "decline",
                              requestId: request.id,
                            });
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Decline
                        </Button>
                        <Button
                          disabled={respondFriendRequestMutation.isPending}
                          onClick={() => {
                            void respondToRequest({
                              action: "accept",
                              requestId: request.id,
                            });
                          }}
                          size="sm"
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outgoing Requests */}
          <Card className="border-border/40 bg-card/40">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-playfair)] flex items-center gap-2">
                <ArrowUpRight className="size-5 text-sky-400" />
                Sent Requests ({pendingOutgoingRequests.length})
              </CardTitle>
              <CardDescription>
                Friend requests you sent awaiting artist approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOutgoingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No pending sent requests.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {pendingOutgoingRequests.map((request) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/50 p-3"
                      key={request.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {request.displayName}
                        </p>
                        <p className="truncate text-muted-foreground text-xs">
                          {request.username ? `@${request.username}` : "Artist"}
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px] text-amber-400 border-amber-400/30"
                        >
                          Awaiting response
                        </Badge>
                      </div>
                      <Button
                        disabled={respondFriendRequestMutation.isPending}
                        onClick={() => {
                          void respondToRequest({
                            action: "cancel",
                            requestId: request.id,
                          });
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: FOLLOWING & FANS */}
        <TabsContent value="following" className="space-y-6">
          <div className="text-sm text-muted-foreground mb-2">
            Artists you follow across SoundKit and fans following your profile.
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {followingAndFans.map((person) => (
              <PersonCard
                key={`${person.relationship}-${person.id}`}
                person={person}
              />
            ))}

            {followingAndFans.length === 0 && (
              <Card className="border-dashed border-border/50 bg-card/30 md:col-span-2">
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <Heart className="size-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">
                      No followers or following yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Follow artists from their profile or explore feed to keep
                      up with their music.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Public Search Results Section (if search term entered) */}
      {normalizedSearch && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-playfair)]">
              Public Artists Search Results
            </CardTitle>
            <CardDescription>
              Connect with artists matching &ldquo;{search}&rdquo;
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {peopleSearchQuery.isLoading && (
              <p className="text-sm text-muted-foreground md:col-span-2">
                Searching artists...
              </p>
            )}
            {!peopleSearchQuery.isLoading && searchedArtists.length === 0 && (
              <p className="text-sm text-muted-foreground md:col-span-2">
                No public artists matched that search.
              </p>
            )}
            {searchedArtists.map((artist) => (
              <ArtistSearchResultRow key={artist.id} artist={artist} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add Friend Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Artist Friend</DialogTitle>
            <DialogDescription>
              Enter an artist username or handle (@username) to connect and
              start collaborating.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleManualAddFriend} className="space-y-4 py-2">
            <div className="space-y-2">
              <Input
                placeholder="e.g. @metro_flow or artist@soundkit.app"
                value={newFriendHandle}
                onChange={(e) => setNewFriendHandle(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  createFriendRequestMutation.isPending ||
                  !newFriendHandle.trim()
                }
                type="submit"
              >
                <UserPlus className="mr-2 size-4" /> Add Friend
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
