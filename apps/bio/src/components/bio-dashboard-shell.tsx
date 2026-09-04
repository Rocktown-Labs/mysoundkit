"use client";

import { Link } from "@tanstack/react-router";
import { BarChart3, Home, LayoutDashboard, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { BioSearchBar } from "@/components/bio-search-bar";
import { getCurrentSessionUser } from "@/lib/api";
import type { BioCurrentUser } from "@/lib/api";

const dashboardItems = [
  { icon: Home, label: "Home", to: "/dashboard" as const },
  { icon: BarChart3, label: "Analytics", to: "/dashboard/analytics" as const },
  { icon: WalletCards, label: "Payments", to: "/dashboard/payments" as const },
];

function DashboardNavItem({
  mobile = false,
  to,
  icon: Icon,
  label,
}: {
  icon: (typeof dashboardItems)[number]["icon"];
  label: string;
  mobile?: boolean;
  to: (typeof dashboardItems)[number]["to"];
}) {
  return (
    <Link
      activeOptions={{ exact: to === "/dashboard" }}
      activeProps={{ "aria-current": "page" }}
      className={
        mobile
          ? "group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold text-muted-foreground transition-colors data-[status=active]:bg-primary/12 data-[status=active]:text-primary"
          : "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground data-[status=active]:bg-primary/12 data-[status=active]:text-primary"
      }
      to={to}
    >
      <Icon
        className={
          mobile
            ? "size-5 transition-transform group-data-[status=active]:scale-105"
            : "size-[18px] shrink-0 transition-transform group-hover:translate-x-0.5"
        }
      />
      <span className={mobile ? "truncate" : "truncate"}>{label}</span>
    </Link>
  );
}

function DashboardNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      aria-label="Bio dashboard"
      className={mobile ? "flex w-full items-stretch gap-1" : "space-y-1"}
    >
      {dashboardItems.map((item) => (
        <DashboardNavItem key={item.to} mobile={mobile} {...item} />
      ))}
    </nav>
  );
}

export function BioDashboardShell({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null),
    bioHref = currentUser?.username ? `/${currentUser.username}` : "/";

  useEffect(() => {
    let cancelled = false;
    const fetchUser = async () => {
      try {
        const user = await getCurrentSessionUser();
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      }
    };
    void fetchUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bio-dashboard-shell relative flex min-h-screen w-full min-w-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/50 bg-background lg:flex">
        <div className="flex h-20 shrink-0 items-center border-b border-border/50 px-7">
          <Link
            aria-label="SoundKit Bio home"
            className="font-notable text-sm tracking-[0.2em] transition-opacity hover:opacity-80"
            to="/"
          >
            SOUNDKIT<span className="text-primary">.BIO</span>
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
          <div className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
            Creator studio
          </div>
          <DashboardNavigation />

          <div className="mt-auto border-t border-border/50 pt-5">
            <Link
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              to="/"
            >
              <LayoutDashboard className="size-[18px]" />
              <span>Discover Bio</span>
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/50 bg-background/95 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="flex items-center gap-4">
            <Link
              aria-label="SoundKit Bio home"
              className="font-notable text-xs tracking-[0.18em] lg:hidden"
              to="/"
            >
              SOUNDKIT<span className="text-primary">.BIO</span>
            </Link>
            <div className="hidden text-sm font-semibold text-foreground lg:block">
              Creator studio
            </div>
          </div>

          <div className="hidden flex-1 max-w-sm mx-6 md:block">
            <BioSearchBar className="w-full" />
          </div>

          <div className="flex items-center gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/5 px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              to={bioHref}
            >
              <span>View Bio</span>
            </Link>
          </div>
        </header>

        <div className="min-w-0 flex-1 pb-36 lg:pb-12">{children}</div>
      </div>

      <div className="bio-dashboard-mobile-tabs fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-border/60 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        <DashboardNavigation mobile />
      </div>
    </div>
  );
}
