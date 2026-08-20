"use client";

import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, Trophy, Zap } from "lucide-react";

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

interface LiveExperienceAuthGuardProps {
  actionLabel?: string;
  children: React.ReactNode;
  featureTitle?: string;
  requiredEntitlement?:
    | "canCreateLiveBattles"
    | "canHostLiveStreams"
    | "isPremium";
}

export function LiveExperienceAuthGuard({
  actionLabel = "access live experience features",
  children,
  featureTitle = "SoundKit Live Studio",
  requiredEntitlement = "isPremium",
}: LiveExperienceAuthGuardProps) {
  const { data: session, isPending: isSessionLoading } =
      authClient.useSession(),
    entitlementsQuery = useMeEntitlementsQuery(),
    user = session?.user,
    entitlements = entitlementsQuery.data;

  // While loading session, show children or fallback
  if (isSessionLoading || entitlementsQuery.isLoading) {
    return <>{children}</>;
  }

  const isAuthenticated = Boolean(user),
    hasEntitlement = Boolean(
      entitlements && requiredEntitlement in entitlements
        ? entitlements[requiredEntitlement]
        : entitlements?.isPremium
    );

  // If authenticated and has entitlement, render children
  if (isAuthenticated && hasEntitlement) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-gradient-to-br from-card via-card/90 to-primary/5 shadow-lg">
        <CardHeader className="text-center sm:text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-3 sm:justify-start">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="size-5" />
              </div>
              <div>
                <Badge
                  variant="outline"
                  className="mb-1 border-primary/40 text-primary"
                >
                  <Sparkles className="mr-1 size-3" />
                  Premium Required
                </Badge>
                <CardTitle className="text-2xl font-bold">
                  Upgrade Account to Access {featureTitle}
                </CardTitle>
              </div>
            </div>
            <div className="flex justify-center sm:justify-end">
              <Button asChild size="lg" className="shadow-md">
                <Link to={isAuthenticated ? "/dashboard/billing" : "/signup"}>
                  <Zap className="mr-2 size-4" />
                  {isAuthenticated ? "Upgrade Account" : "Get Started"}
                </Link>
              </Button>
            </div>
          </div>
          <CardDescription className="mt-2 text-base">
            {isAuthenticated
              ? `A SoundKit Premium Artist subscription is required to ${actionLabel}.`
              : `You must be signed in with a SoundKit Premium Artist account to ${actionLabel}.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-3 pt-2">
          <div className="rounded-lg border bg-background/50 p-4">
            <Trophy className="mb-2 size-5 text-primary" />
            <h4 className="font-semibold text-sm">Ranked Live Battles</h4>
            <p className="mt-1 text-muted-foreground text-xs">
              Issue and accept battle requests, set battle kits, and compete for
              leaderboard ranks.
            </p>
          </div>
          <div className="rounded-lg border bg-background/50 p-4">
            <Sparkles className="mb-2 size-5 text-primary" />
            <h4 className="font-semibold text-sm">Project Release Parties</h4>
            <p className="mt-1 text-muted-foreground text-xs">
              Schedule interactive premiere rooms with synced lyrics, chat, and
              video hosting.
            </p>
          </div>
          <div className="rounded-lg border bg-background/50 p-4">
            <Zap className="mb-2 size-5 text-primary" />
            <h4 className="font-semibold text-sm">Control Room & Analytics</h4>
            <p className="mt-1 text-muted-foreground text-xs">
              Stream via OBS or browser camera with real-time viewer velocity
              and retention metrics.
            </p>
          </div>
        </CardContent>
      </Card>

      {!isAuthenticated && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Already have an account with SoundKit Premium?
          </p>
          <Button asChild variant="outline">
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      )}

      {/* Render existing preview content underneath so guests can still see the layout */}
      <div className="opacity-60 pointer-events-none filter blur-[0.5px]">
        {children}
      </div>
    </div>
  );
}
