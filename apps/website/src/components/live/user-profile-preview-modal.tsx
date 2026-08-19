"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary */

import {
  CheckCircle2,
  ExternalLink,
  Music,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useArtistQuery, useMeQuery } from "@/lib/soundkit-api-hooks";

export interface UserPreviewData {
  avatarUrl?: string | null;
  bio?: string | null;
  displayName: string;
  followersCount?: number;
  genre?: string | null;
  id?: string;
  role?: string;
  username: string;
  verified?: boolean;
}

interface UserProfilePreviewModalProps {
  onClose: () => void;
  open: boolean;
  user: UserPreviewData | null;
}

export function UserProfilePreviewModal({
  onClose,
  open,
  user,
}: UserProfilePreviewModalProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const meQuery = useMeQuery();
  const meUser = meQuery.data?.user;
  const meProfile = meUser;

  const isCurrentUser = Boolean(
    user &&
    (user.displayName.toLowerCase() === "you" ||
      user.id === meUser?.id ||
      (meProfile?.username &&
        user.username.toLowerCase() === meProfile.username.toLowerCase()))
  );

  const lookupKey = isCurrentUser
    ? meProfile?.username || meUser?.id || ""
    : user?.username || user?.displayName || user?.id || "";

  const artistQuery = useArtistQuery(lookupKey);
  const artistData = artistQuery.data;

  if (!user) {
    return null;
  }

  const displayName = isCurrentUser
    ? (artistData?.name ?? meProfile?.displayName ?? "You")
    : (artistData?.name ?? user.displayName);
  const username = isCurrentUser
    ? (artistData?.username ?? meProfile?.username ?? meUser?.username ?? "you")
    : (artistData?.username ?? user.username);
  const avatarUrl = isCurrentUser
    ? (artistData?.avatarUrl ??
      meProfile?.avatarUrl ??
      meUser?.avatarUrl ??
      "/diverse-user-avatars.png")
    : (artistData?.avatarUrl ?? user.avatarUrl ?? "/diverse-user-avatars.png");
  const bio = isCurrentUser
    ? (artistData?.bio ?? meProfile?.bio ?? "SoundKit artist & creator.")
    : (artistData?.bio ??
      user.bio ??
      "Music creator & community member on SoundKit.");
  const followersCount =
    (artistData?.followers ?? user.followersCount ?? 0) + (isFollowing ? 1 : 0);
  const genre = isCurrentUser
    ? (artistData?.genre ?? "SoundKit Creator")
    : (artistData?.genre ?? user.genre ?? "SoundKit Creator");
  const isVerified = isCurrentUser
    ? (artistData?.verified ?? true)
    : (artistData?.verified ?? user.verified ?? false);

  const handleToggleFollow = () => {
    setIsFollowing((prev) => !prev);
    toast({
      description: isFollowing
        ? `Unfollowed @${username}`
        : `You are now following ${displayName}!`,
      title: isFollowing ? "Unfollowed" : "Following",
    });
  };

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/80 bg-card/95 backdrop-blur-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{displayName}&apos;s Profile</DialogTitle>
        </DialogHeader>

        {/* Ambient Gradient Banner */}
        <div className="relative h-28 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/30 p-4 flex items-end justify-end">
          <Badge className="bg-black/90 text-white border border-white/20 backdrop-blur-md text-xs font-semibold px-2.5 py-1 shadow-md">
            {user.role ?? "SoundKit Member"}
          </Badge>
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 space-y-4">
          <div className="flex items-end justify-between -mt-12">
            <Avatar className="size-20 border-4 border-card ring-2 ring-primary/20 shadow-2xl">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex items-center gap-2">
              <Button
                className="gap-1.5 shadow-sm"
                onClick={handleToggleFollow}
                size="sm"
                variant={isFollowing ? "secondary" : "default"}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="size-3.5" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    Follow
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-lg text-foreground">
                {displayName}
              </h3>
              {isVerified && (
                <CheckCircle2 className="size-4 text-primary shrink-0" />
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground">
              @{username}
            </p>
          </div>

          {/* Followers & Genre Badges */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <Users className="size-3.5 text-primary" />
              <span className="font-semibold text-foreground">
                {followersCount.toLocaleString()}
              </span>
              <span>Followers</span>
            </div>
            <div className="flex items-center gap-1">
              <Music className="size-3.5 text-secondary-foreground" />
              <span>{genre}</span>
            </div>
          </div>

          {/* Bio Box */}
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3.5 text-xs text-muted-foreground leading-relaxed">
            {bio}
          </div>

          {/* Quick Actions Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
            <Button
              asChild
              className="gap-1.5 text-xs"
              size="sm"
              variant="outline"
            >
              <a
                href={`/artist/${encodeURIComponent(username)}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="size-3.5" />
                Full Profile
              </a>
            </Button>
            <Button
              className="gap-1.5 text-xs"
              onClick={onClose}
              size="sm"
              variant="secondary"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
