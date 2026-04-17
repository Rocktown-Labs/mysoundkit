import { Link } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { MapPin, Users, Trophy, Library } from "lucide-react";

import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", icon: MapPin, label: "Discover" },
  { href: "/artist", icon: Users, label: "Artists" },
  { href: "/live", icon: Trophy, label: "Live" },
  { href: "/library", icon: Library, label: "My SoundKit" },
];

export function ExploreMobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="grid grid-cols-4 h-16">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== "/" &&
              !link.href.includes("/library") &&
              pathname.startsWith(link.href)) ||
            (link.href.includes("/library") && pathname.startsWith("/library"));

          return (
            <Link
              key={link.href}
              to={link.href}
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
