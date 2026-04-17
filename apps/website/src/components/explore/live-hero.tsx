import { Link } from "@tanstack/react-router";
import { Play, Trophy } from "lucide-react";
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
  primaryActionText: string;
  primaryActionIcon?: LucideIcon;
  primaryActionLink: string;
  secondaryActionText?: string;
  secondaryActionIcon?: LucideIcon;
  secondaryActionLink?: string;
  isPremiumOnly?: boolean;
  isPremiumUser?: boolean;
}

export function LiveHero({
  title,
  description,
  badgeText,
  badgeIcon: BadgeIcon,
  imageSrc,
  imageAlt,
  primaryActionText,
  primaryActionIcon: PrimaryIcon = Play,
  primaryActionLink,
  secondaryActionText,
  secondaryActionIcon: SecondaryIcon,
  secondaryActionLink,
  isPremiumOnly = false,
  isPremiumUser = false,
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
            <Link to={primaryActionLink} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-12 md:h-14 hover:text-white"
              >
                <PrimaryIcon className="size-4 sm:size-5 mr-2" />
                {isPremiumOnly && !isPremiumUser
                  ? "Upgrade to Watch"
                  : primaryActionText}
              </Button>
            </Link>
            {secondaryActionText && secondaryActionLink && (
              <Link to={secondaryActionLink} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-black text-white border-white/20 hover:bg-black hover:text-primary text-sm sm:text-base h-10 sm:h-12 md:h-14"
                >
                  {SecondaryIcon && (
                    <SecondaryIcon className="size-4 sm:size-5 mr-2" />
                  )}
                  {isPremiumOnly && !isPremiumUser
                    ? "Upgrade to Battle"
                    : secondaryActionText}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
