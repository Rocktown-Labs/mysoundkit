"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { Library, MapPin, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", icon: MapPin, label: "Discover" },
  { href: "/artist", icon: Users, label: "Artists" },
  { href: "/live", icon: Trophy, label: "Live" },
  {
    authRequired: true,
    href: "/library",
    icon: Library,
    label: "My SoundKit",
  },
];

export function ExploreMobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: session } = authClient.useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="grid grid-cols-4 h-16">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isLibrary = link.href.includes("/library");
          const href =
            link.authRequired && mounted && !session ? "/login" : link.href;
          const isActive =
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
    </nav>
  );
}
