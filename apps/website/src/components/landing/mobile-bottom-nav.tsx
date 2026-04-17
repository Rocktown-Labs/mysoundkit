import { Link } from "@tanstack/react-router";
import { Home, Zap, DollarSign, Compass } from "lucide-react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";

export function LandingMobileNav() {
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "features", "pricing"];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element =
          section === "home"
            ? document.body
            : document.querySelector(`#${section}`);
        if (element) {
          const offsetTop = section === "home" ? 0 : element.offsetTop;
          const offsetBottom =
            offsetTop + (section === "home" ? 500 : element.offsetHeight);

          if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    if (sectionId === "home") {
      window.scrollTo({ behavior: "smooth", top: 0 });
    } else {
      const element = document.querySelector(`#${sectionId}`);
      if (element) {
        const offsetTop = element.offsetTop - 80;
        window.scrollTo({ behavior: "smooth", top: offsetTop });
      }
    }
  };

  const navItems = [
    { icon: Home, id: "home", isScroll: true, label: "Home" },
    { icon: Zap, id: "features", isScroll: true, label: "Features" },
    {
      href: "/",
      icon: Compass,
      id: "explore",
      isScroll: false,
      label: "Explore",
    },
    { icon: DollarSign, id: "pricing", isScroll: true, label: "Pricing" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          if (!item.isScroll && item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors",
                  "text-muted-foreground hover:text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
