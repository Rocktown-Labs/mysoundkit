import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageSquare, Search, UserRoundPlus, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriendsQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/collaborators")({
  component: FriendsPage,
});

function FriendsPage() {
  const [search, setSearch] = useState("");
  const friendsQuery = useFriendsQuery();
  const friends = friendsQuery.data ?? [];
  const filteredFriends = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) {
      return friends;
    }

    return friends.filter((friend) =>
      [friend.name, friend.email, friend.username, friend.role]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle))
    );
  }, [friends, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Friends
          </h1>
          <p className="mt-1 text-muted-foreground">
            People you follow, collaborate with, or have added from messaging.
          </p>
        </div>
        <Button>
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
            Search friends, collaborators, invited credits, and followed
            artists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="bg-background/50 pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, handle, email, or role"
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
                    {friend.relationship}
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
                  <p className="font-semibold">No people found</p>
                  <p className="text-sm text-muted-foreground">
                    Add collaborators to tracks or follow artists to build this
                    list.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
