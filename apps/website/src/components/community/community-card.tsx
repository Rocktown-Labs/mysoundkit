import { Link } from "@tanstack/react-router";
import { LockKeyhole, MessageCircle, Users } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DbCommunity } from "@/lib/data-db";

const formatPrice = (monthlyPriceCents: number) =>
  monthlyPriceCents === 0
    ? "Free"
    : `${new Intl.NumberFormat("en-US", {
        currency: "USD",
        style: "currency",
      }).format(monthlyPriceCents / 100)}/mo`;

export function CommunityCard({ community }: { community: DbCommunity }) {
  return (
    <Card className="group w-[280px] shrink-0 overflow-hidden border-border/50 bg-card/70 transition-colors hover:border-primary/50">
      <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-primary/25 via-accent/15 to-background">
        {community.coverImageUrl ? (
          <AppImage
            alt={`${community.name} community cover`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={community.coverImageUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <MessageCircle className="size-12 text-primary/60" />
          </div>
        )}
        <Badge className="absolute left-3 top-3" variant="secondary">
          {formatPrice(community.monthlyPriceCents)}
        </Badge>
      </div>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 border">
            <AvatarImage src={community.artist.avatarUrl ?? undefined} />
            <AvatarFallback>
              {community.artist.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link
              className="block truncate font-semibold transition-colors hover:text-primary"
              params={{ communityId: community.id }}
              to="/communities/$communityId"
            >
              {community.name}
            </Link>
            <p className="truncate text-muted-foreground text-xs">
              by {community.artist.name}
            </p>
          </div>
        </div>
        <p className="line-clamp-2 min-h-10 text-muted-foreground text-sm">
          {community.description ??
            "An artist-led space for updates, conversation, and community."}
        </p>
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {community.memberCount.toLocaleString()} members
          </span>
          <span className="flex items-center gap-1">
            {community.monthlyPriceCents > 0 ? (
              <LockKeyhole className="size-3.5" />
            ) : null}
            {community.genre?.name ?? "All genres"}
          </span>
        </div>
        <Button
          asChild
          className="w-full"
          variant={community.isMember ? "secondary" : "default"}
        >
          <Link
            params={{ communityId: community.id }}
            to="/communities/$communityId"
          >
            {community.isMember ? "Open Community" : "View Community"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
