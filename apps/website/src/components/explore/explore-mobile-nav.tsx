"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import {
  Disc,
  Library,
  MapPin,
  Music,
  ShoppingBag,
  Tags,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navLinks = [
    { href: "/", icon: MapPin, label: "Discover" },
    { icon: Music, isMenu: true, label: "Music" },
    { href: "/artist", icon: Users, label: "Artists" },
    { href: "/live", icon: Trophy, label: "Live" },
    {
      authRequired: true,
      href: "/library",
      icon: Library,
      label: "My SoundKit",
    },
  ],
  musicLinks = [
    {
      description: "Songs, charts, and regional track discovery",
      href: "/tracks",
      icon: Music,
      label: "Songs",
    },
    {
      description: "Albums, EPs, mixtapes, and bundles",
      href: "/projects",
      icon: Disc,
      label: "Projects",
    },
    {
      description: "Music videos and visual releases",
      href: "/videos",
      icon: Video,
      label: "Videos",
    },
    {
      description: "Browse by sound, scene, and style",
      href: "/genres",
      icon: Tags,
      label: "Genres",
    },
    {
      description: "Paid drops and fan purchases",
      href: "/shop",
      icon: ShoppingBag,
      label: "Shop",
    },
  ] as const;

export function ExploreMobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }),
    { data: session } = authClient.useSession(),
    [mounted, setMounted] = useState(false),
    [musicOpen, setMusicOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMusicActive = musicLinks.some(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`)
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="grid h-16 grid-cols-5">
        {navLinks.map((link) => {
          const Icon = link.icon;
          if ("isMenu" in link) {
            return (
              <button
                key={link.label}
                aria-label="Open Music Menu"
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 transition-colors",
                  isMusicActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setMusicOpen(true)}
                type="button"
              >
                <Icon
                  className={cn("size-5", isMusicActive && "fill-primary/20")}
                />
                <span className="text-[10px] font-medium">{link.label}</span>
              </button>
            );
          }

          const isLibrary = link.href.includes("/library"),
            href =
              link.authRequired && mounted && !session ? "/login" : link.href,
            isActive =
              pathname === href ||
              (href !== "/" && !isLibrary && pathname.startsWith(href)) ||
              (isLibrary && pathname.startsWith("/library"));

          return (
            <Link
              key={link.href}
              to={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("size-5", isActive && "fill-primary/20")} />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>

      <Dialog open={musicOpen} onOpenChange={setMusicOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Music</DialogTitle>
            <DialogDescription>
              Jump into SoundKit catalog routes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            {musicLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  className="flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                  onClick={() => setMusicOpen(false)}
                  to={link.href}
                >
                  <Icon className="size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm">
                      {link.label}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {link.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
