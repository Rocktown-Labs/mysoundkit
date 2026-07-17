/* eslint-disable react-perf/jsx-no-new-function-as-prop */
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Search, ShoppingCart, UserRound } from "lucide-react";
import { Suspense } from "react";

import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useMeQuery } from "@/lib/soundkit-api-hooks";

export function ExploreHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cart, setIsCartOpen } = useCart();
  const meQuery = useMeQuery();
  const me = meQuery.data;
  const isSignedIn = Boolean(me);
  const canOpenDashboard =
    me?.user.accountType === "artist" || me?.user.role === "admin";

  const getSearchPlaceholder = () => {
    if (pathname.startsWith("/artist")) {
      return "Search artists...";
    } else if (pathname.startsWith("/live")) {
      return "Search battles...";
    } else if (pathname.startsWith("/tracks")) {
      return "Search songs...";
    } else if (pathname.startsWith("/genres")) {
      return "Search genres...";
    }
    return "Search artists, tracks, battles...";
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="shrink-0" />

      <div className="flex-1 flex items-center justify-center max-w-3xl mx-auto">
        <div className="relative w-full max-w-md md:max-w-lg">
          <Suspense fallback={<div>Loading...</div>}>
            <Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={getSearchPlaceholder()}
              className="pl-8 md:pl-10 w-full h-9 md:h-10 text-sm"
            />
          </Suspense>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingCart className="size-4" />
          <span className="sr-only">Open cart</span>
          {cart.itemCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
              {cart.itemCount}
            </span>
          )}
        </Button>
        {isSignedIn ? (
          <>
            {canOpenDashboard ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link to="/library/settings">
                <UserRound className="size-4" />
                Account
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Sign Up</Button>
            </Link>
          </>
        )}
      </div>
      <CartDrawer />
    </header>
  );
}
