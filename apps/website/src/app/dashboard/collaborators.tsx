"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  Heart,
  MessageSquare,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { usePresence } from "@/lib/presence-context";
import {
  useCreateFriendRequestMutation,
  useNetworkQuery,
  useRespondFriendRequestMutation,
  useSearchQuery,
  useUnfollowArtistMutation,
} from "@/lib/soundkit-api-hooks";
import type { NetworkResponse } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/collaborators")({
  component: NetworkPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search.tab === "followers" ||
      search.tab === "following" ||
      search.tab === "requests"
        ? search.tab
        : "friends",
  }),
});

type NetworkTab = "followers" | "following" | "friends" | "requests";
type NetworkPerson = NetworkResponse["friends"][number];

const personLabel = (person: NetworkPerson) =>
  person.accountType === "fan" ? "Fan" : "Artist";

function RelationshipBadges({
  person,
  direction,
}: {
  direction?: "follower" | "following";
  person: NetworkPerson;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline">{personLabel(person)}</Badge>
      {person.isFriend && (
        <Badge className="gap-1">
          <UserCheck className="size-3" />
          Friend
        </Badge>
      )}
      {person.followsYou && (
        <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-400">
          Follows You
        </Badge>
      )}
      {person.isFollowing && (
        <Badge className="border-violet-500/40 bg-violet-500/10 text-violet-400">
          Following
        </Badge>
      )}
      {direction === "follower" && !person.followsYou && (
        <Badge variant="secondary">Follower</Badge>
      )}
    </div>
  );
}

function PersonCard({
  direction,
  person,
}: {
  direction?: "follower" | "following";
  person: NetworkPerson;
}) {
  const { isUserOnline, registerPresenceUsers } = usePresence(),
   friendRequestMutation = useCreateFriendRequestMutation(),
   unfollowMutation = useUnfollowArtistMutation(person.username ?? ""),
   isArtist = person.accountType === "artist",
   sendFriendRequest = async () => {
    if (!person.username) {return;}
    try {
      await friendRequestMutation.mutateAsync({ username: person.username });
      toast({
        description: `Friend request sent to @${person.username}.`,
        title: "Friend request sent",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Unable to send friend request.",
        title: "Request failed",
        variant: "destructive",
      });
    }
  };
  useEffect(
    () => registerPresenceUsers([person.id]),
    [person.id, registerPresenceUsers]
  );

  return (
    <Card className="border-border/40 bg-card/40">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <Avatar className="size-12">
                <AvatarImage src={person.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {person.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-background ${isUserOnline(person.id) ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{person.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {person.username ? `@${person.username}` : person.email}
              </p>
            </div>
          </div>
          <RelationshipBadges direction={direction} person={person} />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/30 pt-3">
          <Button asChild size="sm" variant="outline">
            <Link
              params={{ username: person.username ?? "" }}
              to="/artist/$username"
            >
              Profile
            </Link>
          </Button>
          {person.canMessage && (
            <Button asChild size="sm">
              <Link search={{ friendId: person.id }} to="/dashboard/messages">
                <MessageSquare className="mr-2 size-4" />
                Message
              </Link>
            </Button>
          )}
          {direction === "follower" && isArtist && !person.isFriend && (
            <Button
              disabled={friendRequestMutation.isPending}
              onClick={() => void sendFriendRequest()}
              size="sm"
              variant="outline"
            >
              <UserPlus className="mr-2 size-4" />
              Add Friend
            </Button>
          )}
          {direction === "following" && isArtist && person.isFollowing && (
            <Button
              disabled={unfollowMutation.isPending}
              onClick={() => void unfollowMutation.mutateAsync()}
              size="sm"
              variant="outline"
            >
              Unfollow
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="border-dashed border-border/50 bg-card/30">
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="font-semibold">No {label} yet</p>
        <p className="text-sm text-muted-foreground">
          Your real SoundKit relationships will appear here.
        </p>
      </CardContent>
    </Card>
  );
}

function RequestList({ requests }: { requests: NetworkResponse["requests"] }) {
  const respondMutation = useRespondFriendRequestMutation(),
   pending = requests.filter((request) => request.status === "pending"),
   respond = async (
    requestId: string,
    action: "accept" | "cancel" | "decline"
  ) => {
    try {
      await respondMutation.mutateAsync({ action, requestId });
      toast({
        description:
          action === "accept" ? "Friend request accepted." : "Request updated.",
        title: "Network updated",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Unable to update request.",
        title: "Request failed",
        variant: "destructive",
      });
    }
  };
  if (pending.length === 0) {return <EmptyState label="pending requests" />;}
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {pending.map((request) => (
        <Card key={request.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar>
                <AvatarImage src={request.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {request.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{request.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {request.direction === "incoming"
                    ? "Wants to connect"
                    : "Request pending"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {request.direction === "incoming" ? (
                <>
                  <Button
                    disabled={respondMutation.isPending}
                    onClick={() => void respond(request.id, "decline")}
                    size="sm"
                    variant="outline"
                  >
                    Decline
                  </Button>
                  <Button
                    disabled={respondMutation.isPending}
                    onClick={() => void respond(request.id, "accept")}
                    size="sm"
                  >
                    Accept
                  </Button>
                </>
              ) : (
                <Button
                  disabled={respondMutation.isPending}
                  onClick={() => void respond(request.id, "cancel")}
                  size="sm"
                  variant="outline"
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NetworkPage() {
  const search = Route.useSearch(),
   navigate = Route.useNavigate(),
   networkQuery = useNetworkQuery(),
   [query, setQuery] = useState(""),
   peopleQuery = useSearchQuery({ limit: "8", q: query, type: "artists" }),
   requestMutation = useCreateFriendRequestMutation(),
   [followerFilter, setFollowerFilter] = useState<
    "all" | "fans" | "artists"
  >("all"),
   activeTab = search.tab as NetworkTab,
   network = networkQuery.data,
   filteredSearchResults = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^@/u, "");
    if (!needle) {return [];}
    return (peopleQuery.data?.artists ?? []).filter(
      (person) =>
        person.username.toLowerCase().includes(needle) ||
        person.name.toLowerCase().includes(needle)
    );
  }, [peopleQuery.data?.artists, query]),
   followers = (network?.followers ?? []).filter(
    (person) =>
      followerFilter === "all" ||
      (followerFilter === "fans"
        ? person.accountType === "fan"
        : person.accountType === "artist")
  ),
   setTab = (tab: NetworkTab) => void navigate({ search: { tab } }),
   sendSearchRequest = async (username: string) => {
    try {
      await requestMutation.mutateAsync({ username });
      toast({
        description: `Friend request sent to @${username}.`,
        title: "Friend request sent",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Unable to send request.",
        title: "Request failed",
        variant: "destructive",
      });
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
          Network
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your artist relationships and audience.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Find People</CardTitle>
          <CardDescription>
            Discover artists and manage relationships without mixing social,
            music, or workspace access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search artists by name or @username"
              value={query}
            />
            {query && (
              <Button
                className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                onClick={() => setQuery("")}
                size="icon"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {filteredSearchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {filteredSearchResults.map((person) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  key={person.id}
                >
                  <div>
                    <p className="font-medium">{person.name}</p>
                    <p className="text-sm text-muted-foreground">
                      @{person.username} · Artist
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        params={{ username: person.username }}
                        to="/artist/$username"
                      >
                        Profile
                      </Link>
                    </Button>
                    <Button
                      disabled={requestMutation.isPending}
                      onClick={() => void sendSearchRequest(person.username)}
                      size="sm"
                    >
                      <UserPlus className="mr-2 size-4" />
                      Add Friend
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Tabs
        onValueChange={(value) => setTab(value as NetworkTab)}
        value={activeTab}
      >
        <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="friends">
            <UserCheck className="mr-2 size-4" />
            Friends{" "}
            <Badge className="ml-2" variant="secondary">
              {network?.counts.friends ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="followers">
            <Heart className="mr-2 size-4" />
            Followers{" "}
            <Badge className="ml-2" variant="secondary">
              {network?.counts.followers ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="following">
            <Users className="mr-2 size-4" />
            Following{" "}
            <Badge className="ml-2" variant="secondary">
              {network?.counts.following ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Clock className="mr-2 size-4" />
            Requests{" "}
            <Badge className="ml-2" variant="secondary">
              {network?.counts.pendingRequests ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent className="mt-6 space-y-4" value="friends">
          {network?.friends.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {network.friends.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          ) : (
            <EmptyState label="friends" />
          )}
        </TabsContent>
        <TabsContent className="mt-6 space-y-4" value="followers">
          <div className="flex gap-2">
            <Button
              onClick={() => setFollowerFilter("all")}
              size="sm"
              variant={followerFilter === "all" ? "default" : "outline"}
            >
              All {network?.counts.followers ?? 0}
            </Button>
            <Button
              onClick={() => setFollowerFilter("fans")}
              size="sm"
              variant={followerFilter === "fans" ? "default" : "outline"}
            >
              Fans {network?.counts.fanFollowers ?? 0}
            </Button>
            <Button
              onClick={() => setFollowerFilter("artists")}
              size="sm"
              variant={followerFilter === "artists" ? "default" : "outline"}
            >
              Artists {network?.counts.artistFollowers ?? 0}
            </Button>
          </div>
          {followers.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {followers.map((person) => (
                <PersonCard
                  direction="follower"
                  key={person.id}
                  person={person}
                />
              ))}
            </div>
          ) : (
            <EmptyState label="followers" />
          )}
        </TabsContent>
        <TabsContent className="mt-6" value="following">
          {network?.following.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {network.following.map((person) => (
                <PersonCard
                  direction="following"
                  key={person.id}
                  person={person}
                />
              ))}
            </div>
          ) : (
            <EmptyState label="following relationships" />
          )}
        </TabsContent>
        <TabsContent className="mt-6" value="requests">
          <RequestList requests={network?.requests ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
