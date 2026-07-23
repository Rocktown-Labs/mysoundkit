import { Link } from "@tanstack/react-router";
import { Play, Sparkles, Trophy, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React from "react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LiveHeroProps {
  title: string;
  description: string;
  badgeText: string;
  badgeIcon: LucideIcon;
  imageSrc: string;
  imageAlt: string;
  isPremium?: boolean;
  isPremiumArtist?: boolean;
  isPremiumFan?: boolean;
}

export function LiveHero({
  title,
  description,
  badgeText,
  badgeIcon: BadgeIcon,
  imageSrc,
  imageAlt,
  isPremium = false,
  isPremiumArtist = false,
  isPremiumFan = false,
}: LiveHeroProps) {
  return (
    <section className="mb-6 md:mb-8">
      <div className="relative overflow-hidden rounded-xl border">
        <div className="absolute inset-0">
          <AppImage
            src={imageSrc}
            alt={imageAlt}
            width={1600}
            height={900}
            layout="fullWidth"
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/70 to-background/90" />
        <div className="relative px-4 sm:px-6 md:px-12 py-8 sm:py-12 md:py-16 lg:py-20 text-center min-h-[280px] sm:min-h-[320px] md:min-h-[400px] flex flex-col items-center justify-center">
          <Badge className="mb-2 md:mb-4" variant="secondary">
            <BadgeIcon className="size-3 mr-1" />
            {badgeText}
          </Badge>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-3 md:mb-6 text-white leading-tight">
            {title}
          </h1>

          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/95 max-w-2xl mx-auto mb-4 sm:mb-6 md:mb-8 px-2 leading-relaxed">
            {description}
          </p>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center px-2 w-full max-w-md mx-auto sm:max-w-none">
            {/* If user is Premium Artist: Hide all upgrade CTAs */}
            {isPremiumArtist ? (
              <Badge
                variant="outline"
                className="bg-black/50 text-white border-white/20 px-4 py-2 text-sm"
              >
                <Sparkles className="size-4 mr-2 text-yellow-400" />
                Premium Artist Unlocked
              </Badge>
            ) : (isPremiumFan ? (
              /* If user is Premium Fan: Watch is unlocked. Show Upgrade to Artist only on Battles */
              <div className="flex flex-col sm:flex-row gap-3">
                <Badge
                  variant="outline"
                  className="bg-black/50 text-white border-white/20 px-4 py-2 text-sm"
                >
                  <Sparkles className="size-4 mr-2 text-primary" />
                  Premium Fan Member
                </Badge>
                <Link to="/pricing">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-black text-white border-white/20 hover:bg-black hover:text-primary text-sm sm:text-base h-10 sm:h-12"
                  >
                    <Trophy className="size-4 mr-2 text-yellow-400" />
                    Upgrade to Premium Artist ($14.99/mo)
                  </Button>
                </Link>
              </div>
            ) : (
              /* If user is NOT Premium: Show explicitly distinct CTAs for Premium Fan vs Premium Artist */
              <>
                <Link to="/pricing">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-12 md:h-14 hover:text-white"
                  >
                    <Play className="size-4 sm:size-5 mr-2" />
                    Upgrade to Premium Fan ($4.99/mo)
                  </Button>
                </Link>

                <Link to="/pricing">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-black text-white border-white/20 hover:bg-black hover:text-primary text-sm sm:text-base h-10 sm:h-12 md:h-14"
                  >
                    <Zap className="size-4 sm:size-5 mr-2 text-amber-400" />
                    Upgrade to Premium Artist ($14.99/mo)
                  </Button>
                </Link>
              </>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
