import { useRouterState } from "@tanstack/react-router";
import { Flame, Headphones, Radio, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { LiveHero } from "@/components/explore/live-hero";
import { authClient } from "@/lib/auth-client";
import { useMeEntitlementsQuery } from "@/lib/soundkit-api-hooks";

interface LiveHeroConfig {
  badgeIcon: LucideIcon;
  badgeText: string;
  description: string;
  title: string;
}

const liveHeroImage =
  "/images/excited-audience-watching-confetti-fireworks-having-fun-music-festival-night-copy-space.jpg";

const isMainLiveIndexPage = (pathname: string): boolean => {
  const normalized = pathname.replace(/\/$/, "");
  return (
    normalized === "/live" ||
    normalized === "/live/battles" ||
    normalized === "/live/parties" ||
    normalized === "/live/streams"
  );
};

const getLiveHeroConfig = (pathname: string): LiveHeroConfig => {
  if (pathname.startsWith("/live/parties")) {
    return {
      badgeIcon: Headphones,
      badgeText: "Live Parties",
      description:
        "Jump into live listening parties for one album at a time or alternating album faceoffs with chat, likes, saves, and playlist actions after every track.",
      title: "Live Listening Parties",
    };
  }

  if (pathname.startsWith("/live/streams")) {
    return {
      badgeIcon: Radio,
      badgeText: "Live Streams",
      description:
        "Creator streams flex between live broadcasts, studio sessions, and replay states. Premium unlocks live video access while completed sessions stay ready for playback.",
      title: "Creator Streams",
    };
  }

  if (pathname.startsWith("/live/battles")) {
    return {
      badgeIcon: Zap,
      badgeText: "Live Battles",
      description:
        "Watch tracks go head to head in real time, vote live as a premium member, and come back for completed replays once the battle closes.",
      title: "Live Battles",
    };
  }

  return {
    badgeIcon: Flame,
    badgeText: "Live Hub",
    description:
      "Start at the live hub, then move into battles, listening parties, and creator streams as the session unfolds.",
    title: "The Pulse of SoundKit",
  };
};

export function LiveRouteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const { data: session } = authClient.useSession();
  const entitlementsQuery = useMeEntitlementsQuery();
  const entitlements = entitlementsQuery.data;

  const showHeroHeader = isMainLiveIndexPage(pathname);
  const hero = getLiveHeroConfig(pathname);

  const isPremiumArtist = Boolean(
    entitlements?.canCreateLiveBattles || entitlements?.canHostLiveStreams
  );
  const isPremium = Boolean(
    entitlements?.isPremium ||
    entitlements?.canWatchCreatorStreams ||
    isPremiumArtist
  );
  const isPremiumFan = isPremium && !isPremiumArtist;

  return (
    <section className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
        {showHeroHeader && (
          <LiveHero
            badgeIcon={hero.badgeIcon}
            badgeText={hero.badgeText}
            description={hero.description}
            imageAlt={hero.badgeText}
            imageSrc={liveHeroImage}
            isPremium={isPremium}
            isPremiumArtist={isPremiumArtist}
            isPremiumFan={isPremiumFan}
            title={hero.title}
          />
        )}
        {children}
      </div>
    </section>
  );
}
