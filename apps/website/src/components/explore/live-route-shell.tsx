import { useRouterState } from "@tanstack/react-router";
import { Flame, Headphones, Radio, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { LiveHero } from "@/components/explore/live-hero";

interface LiveHeroConfig {
  badgeIcon: LucideIcon;
  badgeText: string;
  description: string;
  isPremiumOnly?: boolean;
  primaryActionLink: string;
  primaryActionText: string;
  secondaryActionLink?: string;
  secondaryActionText?: string;
  title: string;
}

const liveHeroImage =
  "/images/excited-audience-watching-confetti-fireworks-having-fun-music-festival-night-copy-space.jpg";

const getLiveHeroConfig = (pathname: string): LiveHeroConfig => {
  if (pathname.startsWith("/live/parties")) {
    return {
      badgeIcon: Headphones,
      badgeText: "Live Parties",
      description:
        "Jump into live listening parties for one album at a time or alternating album faceoffs with chat, likes, saves, and playlist actions after every track.",
      primaryActionLink: "/live/parties",
      primaryActionText: "Join A Party",
      secondaryActionLink: "/live",
      secondaryActionText: "Back To Live Hub",
      title: "Live Listening Parties",
    };
  }

  if (pathname.startsWith("/live/streams")) {
    return {
      badgeIcon: Radio,
      badgeText: "Live Streams",
      description:
        "Creator streams flex between live broadcasts, studio sessions, and replay states. Premium unlocks live video access while completed sessions stay ready for playback.",
      isPremiumOnly: true,
      primaryActionLink: "/live/streams",
      primaryActionText: "Watch Live Streams",
      secondaryActionLink: "/pricing",
      secondaryActionText: "Upgrade To Watch",
      title: "Creator Streams",
    };
  }

  if (pathname.startsWith("/live/battles")) {
    return {
      badgeIcon: Zap,
      badgeText: "Live Battles",
      description:
        "Watch tracks go head to head in real time, vote live as a premium member, and come back for completed replays once the battle closes.",
      isPremiumOnly: true,
      primaryActionLink: "/pricing",
      primaryActionText: "Watch Live Battles",
      secondaryActionLink: "/pricing",
      secondaryActionText: "See Premium Plans",
      title: "Live Battles",
    };
  }

  return {
    badgeIcon: Flame,
    badgeText: "Live Hub",
    description:
      "Start at the live hub, then move into battles, listening parties, and creator streams as the session unfolds.",
    isPremiumOnly: true,
    primaryActionLink: "/pricing",
    primaryActionText: "Watch Live Battles",
    secondaryActionLink: "/pricing",
    secondaryActionText: "See Premium Plans",
    title: "The Pulse of SoundKit",
  };
};

export function LiveRouteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const hero = getLiveHeroConfig(pathname);

  return (
    <section className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
        <LiveHero
          badgeIcon={hero.badgeIcon}
          badgeText={hero.badgeText}
          description={hero.description}
          imageAlt={hero.badgeText}
          imageSrc={liveHeroImage}
          isPremiumOnly={hero.isPremiumOnly}
          isPremiumUser={false}
          primaryActionLink={hero.primaryActionLink}
          primaryActionText={hero.primaryActionText}
          secondaryActionLink={hero.secondaryActionLink}
          secondaryActionText={hero.secondaryActionText}
          title={hero.title}
        />
        {children}
      </div>
    </section>
  );
}
