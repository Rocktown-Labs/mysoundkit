import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones, MapPin, UserPlus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import { useMeQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/people/$username")({
  component: PublicUserProfilePage,
});

function PublicUserProfilePage() {
  const { username } = Route.useParams(),
   meQuery = useMeQuery(),
   profileQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(
        `${API_V1_URL}/social/profiles/${encodeURIComponent(username)}`,
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error("Profile not found.");
      }
      return (await response.json()) as {
        accountType: "artist" | "fan";
        avatarUrl: string | null;
        bio: string | null;
        displayName: string;
        followerCount: number;
        location: string | null;
        username: string;
      };
    },
    queryKey: ["public-profile", username],
  }),
   followMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${API_V1_URL}/social/profiles/${encodeURIComponent(username)}/follow`,
        { credentials: "include", method: "POST" }
      );
      if (!response.ok) {
        throw new Error("Sign in to follow this profile.");
      }
      return (await response.json()) as { followerCount: number };
    },
    onSuccess: async () => {
      await profileQuery.refetch();
      toast({
        description: `You now follow @${username}.`,
        title: "Following",
      });
    },
  }),
   profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading profile…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Profile not found.
      </div>
    );
  }

  if (profile.accountType === "artist") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="font-bold text-2xl">
            {profile.displayName} is an artist
          </h1>
          <p className="text-muted-foreground">
            Open their artist profile to hear releases and see live events.
          </p>
          <Button asChild>
            <Link
              params={{ username: profile.username }}
              to="/artist/$username"
            >
              Open Artist Profile
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isOwnProfile = meQuery.data?.user.username === profile.username;

  return (
    <Card className="mx-auto max-w-2xl overflow-hidden">
      <div className="h-32 bg-gradient-to-r from-primary/40 via-primary/10 to-background" />
      <CardContent className="-mt-12 space-y-5 p-8 text-center">
        <Avatar className="mx-auto size-24 border-4 border-background">
          <AvatarImage src={profile.avatarUrl ?? "/placeholder.svg"} />
          <AvatarFallback>
            {profile.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="font-bold text-3xl">{profile.displayName}</h1>
            <Badge variant="secondary">Fan</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">@{profile.username}</p>
        </div>
        {profile.bio ? (
          <p className="mx-auto max-w-lg text-muted-foreground">
            {profile.bio}
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-5 text-sm text-muted-foreground">
          <span>{profile.followerCount.toLocaleString()} followers</span>
          {profile.location ? (
            <span className="flex items-center gap-1">
              <MapPin className="size-4" />
              {profile.location}
            </span>
          ) : null}
        </div>
        {isOwnProfile ? (
          <Button asChild variant="outline">
            <Link to="/library/settings">
              <Headphones className="mr-2 size-4" />
              My SoundKit Settings
            </Link>
          </Button>
        ) : (
          <Button
            disabled={followMutation.isPending}
            onClick={() => followMutation.mutate()}
          >
            <UserPlus className="mr-2 size-4" />
            Follow
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
