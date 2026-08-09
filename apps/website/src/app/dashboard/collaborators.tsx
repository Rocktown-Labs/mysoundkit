"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Mail,
  MessageSquare,
  Search,
  UserPlus,
  UserRoundPlus,
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
import { toast } from "@/hooks/use-toast";
import {
  useCreateFriendRequestMutation,
  useFriendRequestsQuery,
  useFriendsQuery,
  useRespondFriendRequestMutation,
  useSearchQuery,
  useMeQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/collaborators")({
  component: FriendsPage,
});

const getRelationshipLabel = (relationship: string) => {
  switch (relationship) {
    case "collaborator": {
      return "Collaborator";
    }
    case "fan": {
      return "New Fan";
    }
    case "following": {
      return "Following";
    }
    default: {
      return "Artist Friend";
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
    await friendRequestMutation.mutateAsync({ username: artist.username });
    setIsPending(true);
    toast({
      description: `Friend request sent to @${artist.username}. Pending acceptance.`,
      title: "Friend request sent",
    });
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

function FriendsPage() {
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFriendHandle, setNewFriendHandle] = useState("");
  const friendsQuery = useFriendsQuery();
  const friendRequestsQuery = useFriendRequestsQuery();
  const createFriendRequestMutation = useCreateFriendRequestMutation();
  const respondFriendRequestMutation = useRespondFriendRequestMutation();
  const friends = useMemo(() => friendsQuery.data ?? [], [friendsQuery.data]);
  const friendRequests = friendRequestsQuery.data ?? [];

  const normalizedSearch = search.trim().replace(/^@/u, "");

  const peopleSearchQuery = useSearchQuery({
    limit: "8",
    q: normalizedSearch,
    type: "artists",
  });

  const searchedArtists = peopleSearchQuery.data?.artists ?? [];

  const meQuery = useMeQuery();
  const currentUserId = meQuery.data?.user?.id;

  const filteredFriends = useMemo(() => {
    const needle = normalizedSearch.toLowerCase();

    return friends.filter((friend) => {
      if (friend.id === currentUserId) {
        return false;
      }
      if (!needle) {
        return true;
      }

      return [friend.name, friend.email, friend.username, friend.role]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [friends, currentUserId, normalizedSearch]);

  const handleManualAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = newFriendHandle.trim().replace(/^@/u, "");
    if (!handle) {
      return;
    }

    await createFriendRequestMutation.mutateAsync({ username: handle });
    toast({
      description: `Sent friend request to @${handle}.`,
      title: "Friend request sent",
    });
    setNewFriendHandle("");
    setIsAddModalOpen(false);
  };

  const respondToRequest = async ({
    action,
    requestId,
  }: {
    action: "accept" | "cancel" | "decline";
    requestId: string;
  }) => {
    await respondFriendRequestMutation.mutateAsync({ action, requestId });
    toast({
      description:
        action === "accept"
          ? "You can now message this artist."
          : "Friend request updated.",
      title: action === "accept" ? "Friend added" : "Request updated",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Friends &amp; Collaborators
          </h1>
          <p className="mt-1 text-muted-foreground">
            People you follow, collaborate with, or have added from messaging.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <UserRoundPlus className="mr-2 size-4" />
          Add Friend
        </Button>
      </div>

      <Card className="border-border/40 bg-card/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Find People
          </CardTitle>
          <CardDescription>
            Search friends, collaborators, and artists (handles supported e.g.
            @username).
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

      {friendRequests.length > 0 && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-playfair)]">
              Friend Requests
            </CardTitle>
            <CardDescription>
              Artist requests that can become messaging connections.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {friendRequests.map((request) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 p-3"
                key={request.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{request.displayName}</p>
                  <p className="truncate text-muted-foreground text-sm">
                    {request.username ? `@${request.username}` : "Artist"}
                  </p>
                  <Badge className="mt-2 capitalize" variant="outline">
                    {request.direction} · {request.status}
                  </Badge>
                </div>
                {request.status === "pending" &&
                  request.direction === "incoming" && (
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
                  )}
                {request.status === "pending" &&
                  request.direction === "outgoing" && (
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
                  )}
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
            Friends are unavailable right now. Refresh and try again.
          </CardContent>
        </Card>
      )}

      {!friendsQuery.isLoading && !friendsQuery.error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredFriends.map((friend) => (
            <Card
              className="border-border/40 bg-card/40"
              key={`${friend.relationship}-${friend.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-12 border border-border/40">
                      <AvatarImage src={friend.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {friend.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{friend.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {friend.username ? `@${friend.username}` : friend.email}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {getRelationshipLabel(friend.relationship)}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/30 pt-4">
                  <div className="min-w-0 text-sm text-muted-foreground">
                    {friend.role ?? "Creator"}
                  </div>
                  <div className="flex items-center gap-2">
                    {friend.username && (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          params={{ username: friend.username }}
                          to="/artist/$username"
                        >
                          Profile
                        </Link>
                      </Button>
                    )}
                    {(friend.relationship === "friend" ||
                      friend.relationship === "collaborator") && (
                      <Button asChild={true} size="sm">
                        <Link to="/dashboard/messages">
                          <MessageSquare className="mr-2 size-4" />
                          Message
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredFriends.length === 0 && (
            <Card className="border-dashed border-border/50 bg-card/30 md:col-span-2">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <Mail className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-semibold">
                    {search ? "No saved friends matched" : "No friends found"}
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

      {normalizedSearch && (
        <Card className="border-border/40 bg-card/40">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-playfair)]">
              Public Artists Search Results
            </CardTitle>
            <CardDescription>
              Connect with artists matching {search}
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
              <Button type="submit">
                <UserPlus className="mr-2 size-4" /> Add Friend
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
