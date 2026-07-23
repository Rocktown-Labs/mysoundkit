"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Mail,
  MessageSquare,
  Search,
  UserCheck,
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
  useFollowArtistMutation,
  useFriendsQuery,
  useSearchQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/collaborators")({
  component: FriendsPage,
});

function ArtistSearchResultRow({
  artist,
}: {
  artist: { genre?: string; id: string; name: string; username: string };
}) {
  const followMutation = useFollowArtistMutation(artist.username);
  const [isPending, setIsPending] = useState(false);

  const handleAdd = async () => {
    await followMutation.mutateAsync();
    setIsPending(true);
    toast({
      description: `Friend request sent to @${artist.username}. Pending acceptance.`,
      title: "Friend Request Sent ⏳",
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
            disabled={followMutation.isPending}
            onClick={() => void handleAdd()}
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
  const friends = useMemo(() => friendsQuery.data ?? [], [friendsQuery.data]);

  const normalizedSearch = search.trim().replace(/^@/, "");

  const peopleSearchQuery = useSearchQuery({
    limit: "8",
    q: normalizedSearch,
    type: "artists",
  });

  const searchedArtists = peopleSearchQuery.data?.artists ?? [];

  const filteredFriends = useMemo(() => {
    const needle = normalizedSearch.toLowerCase();

    if (!needle) {
      return friends;
    }

    return friends.filter((friend) =>
      [friend.name, friend.email, friend.username, friend.role]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle))
    );
  }, [friends, normalizedSearch]);

  const handleManualAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = newFriendHandle.trim().replace(/^@/, "");
    if (!handle) {
      return;
    }

    toast({
      description: `Sent friend request / follow connection to @${handle}.`,
      title: "Friend Request Sent",
    });
    setNewFriendHandle("");
    setIsAddModalOpen(false);
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
                    {friend.relationship === "fan"
                      ? "New Fan"
                      : "Artist Friend"}
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
                    <Button size="sm">
                      <MessageSquare className="mr-2 size-4" />
                      Message
                    </Button>
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
              Connect with artists matching "{search}"
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
