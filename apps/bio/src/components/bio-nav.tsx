/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/set-state-in-effect */
"use client";

import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogIn, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BioSearchBar } from "@/components/bio-search-bar";
import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  setBioAuthToken,
  SOUNDKIT_WEB_URL,
} from "@/lib/api";
import type { BioCurrentUser } from "@/lib/api";

const getSoundKitWebOrigin = () => {
  try {
    return new URL(SOUNDKIT_WEB_URL).origin;
  } catch {
    return "https://mysoundkit.com";
  }
};
const SOUNDKIT_WEB_ORIGIN = getSoundKitWebOrigin();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

export function BioNav() {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null),
    handoffWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
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

    void checkSession();

    const handleMessage = async (event: MessageEvent<unknown>) => {
      if (
        event.origin !== SOUNDKIT_WEB_ORIGIN ||
        event.source !== handoffWindowRef.current ||
        !isRecord(event.data) ||
        event.data.type !== "soundkit-auth-handoff" ||
        typeof event.data.token !== "string"
      ) {
        return;
      }
      setBioAuthToken(event.data.token);
      const user = await getCurrentSessionUser();
      if (!cancelled) {
        setCurrentUser(user);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleSignIn = () => {
    if (typeof window === "undefined") {
      return;
    }
    const returnOrigin = window.location.origin,
      handoffUrl = `${SOUNDKIT_WEB_URL}/auth/handoff?returnOrigin=${encodeURIComponent(returnOrigin)}`,
      popup = window.open(
        handoffUrl,
        "soundkit-auth-handoff",
        "popup,width=480,height=760,resizable,scrollbars"
      );
    if (!popup) {
      window.location.href = `${SOUNDKIT_WEB_URL}/login?redirect=${encodeURIComponent(window.location.href)}`;
      return;
    }
    handoffWindowRef.current = popup;
  };

  return (
    <header className="sticky top-0 z-40 w-full overflow-x-clip border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0">
        {/* Left: Logo */}
        <div className="flex min-w-0 sm:w-56 items-center">
          <Link className="shrink-0 hover:opacity-85 transition-opacity" to="/">
            <span className="font-notable tracking-[0.2em] text-xs sm:text-sm">
              SOUNDKIT<span className="text-primary">.BIO</span>
            </span>
          </Link>
        </div>

        {/* Center: Truly Centered Search Bar */}
        <div className="order-3 basis-full sm:order-none sm:basis-auto sm:flex-1 sm:max-w-md sm:mx-auto">
          <BioSearchBar />
        </div>

        {/* Right CTAs */}
        <div className="flex shrink-0 sm:w-56 items-center justify-end gap-2 sm:gap-3">
          {currentUser?.accountType === "artist" ? (
            <Link
              className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-[background-color,border-color] hover:border-primary/60 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              to="/dashboard"
            >
              <LayoutDashboard aria-hidden="true" className="size-3.5" />
              <span>Dashboard</span>
            </Link>
          ) : currentUser ? (
            <a
              className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-[background-color,border-color] hover:border-primary/60 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={buildSoundKitWebUrl("/dashboard")}
            >
              <LayoutDashboard aria-hidden="true" className="size-3.5" />
              <span>Dashboard</span>
            </a>
          ) : (
            <>
              <button
                className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border border-border/40 bg-white/5 px-4 py-2 text-xs font-semibold text-foreground/85 transition-[border-color,color] hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={handleSignIn}
                type="button"
              >
                <LogIn aria-hidden="true" className="size-3.5 text-primary" />
                <span>Sign In</span>
              </button>

              <Link
                className="hidden min-h-11 touch-manipulation items-center gap-1.5 rounded-full border border-border/40 bg-white/5 px-4 py-2 text-xs font-semibold text-foreground/85 transition-[border-color,color] hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
                to="/signup/artist"
              >
                <Sparkles
                  aria-hidden="true"
                  className="size-3.5 text-primary"
                />
                <span>Claim Account</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
