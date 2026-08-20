"use client";

import { Link } from "@tanstack/react-router";
import { Lock, ShieldAlert, Sparkles } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useMeEntitlementsQuery } from "@/lib/soundkit-api-hooks";

interface LiveRoomAccessGuardProps {
  allowPublic?: boolean;
  children: React.ReactNode;
  roomTitle?: string;
}

export function LiveRoomAccessGuard({
  allowPublic = false,
  children,
  roomTitle = "Live Room",
}: LiveRoomAccessGuardProps) {
  if (allowPublic) {
    return children;
  }

  const { data: session, isPending: isAuthPending } = authClient.useSession(),
    entitlementsQuery = useMeEntitlementsQuery(),
    user = session?.user,
    isSignedIn = Boolean(user),
    isLoading = isAuthPending || (isSignedIn && entitlementsQuery.isLoading),
    entitlements = entitlementsQuery.data,
    isPremium = Boolean(
      entitlements?.isPremium ||
      entitlements?.canWatchCreatorStreams ||
      entitlements?.canCreateLiveBattles ||
      entitlements?.canHostLiveStreams
    );

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Verifying access...
      </div>
    );
  }

  // Grant access if user is authenticated and holds a Premium plan
  if (isSignedIn && isPremium) {
    return children;
  }

  return (
    <div className="relative min-h-[500px] w-full rounded-xl overflow-hidden border">
      {/* Blurred background view of room */}
      <div className="pointer-events-none select-none opacity-20 blur-md grayscale">
        {children}
      </div>

      {/* Access Gate Modal Overlay */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
        <Card className="max-w-lg w-full text-center border-primary/30 shadow-2xl bg-card/95">
          <CardHeader className="space-y-3 pb-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-6 text-primary" />
            </div>

            <Badge variant="destructive" className="mx-auto px-3 py-1 text-xs">
              <ShieldAlert className="size-3.5 mr-1" /> SoundKit Premium
              Required
            </Badge>

            <CardTitle className="text-2xl font-bold">
              Watch Live: {roomTitle}
            </CardTitle>
            <CardDescription className="text-sm">
              Only authenticated SoundKit Premium members can watch live
              streams, join listening rooms, and vote in battles.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <Button asChild size="lg" className="w-full">
              <Link to="/pricing">
                <Sparkles className="size-4 mr-2 text-yellow-400" />
                Upgrade to SoundKit Premium ($22.99/mo)
              </Link>
            </Button>

            {!isSignedIn && (
              <p className="text-xs text-muted-foreground pt-2">
                Already a member?{" "}
                <Link
                  className="font-semibold text-primary underline underline-offset-4"
                  search={{}}
                  to="/login"
                >
                  Sign In to Watch
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
