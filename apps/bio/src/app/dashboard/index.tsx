/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/hook-use-state */
"use client";

import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  HandCoins,
  Sparkles,
} from "lucide-react";
import React, { useState } from "react";

import { buildSoundKitWebUrl, SOUNDKIT_BIO_URL } from "@/lib/api";

export const Route = createFileRoute("/dashboard/")({
  component: BioArtistDashboard,
});

function BioArtistDashboard() {
  const [username] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("soundkit_bio_artist_username") || "artist";
    }
    return "artist";
  });
  const [copied, setCopied] = useState(false);

  const bioUrl = `${SOUNDKIT_BIO_URL}/${encodeURIComponent(username)}`,
    copyBioLink = () => {
      if (typeof window !== "undefined") {
        navigator.clipboard.writeText(bioUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    },
    fullWebDashboardUrl = buildSoundKitWebUrl("/dashboard");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Artist Bio Hub
          </span>
          <h1 className="mt-2 font-playfair text-3xl sm:text-4xl font-medium text-foreground">
            Welcome to your Bio Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your link in bio, check tips, and monitor page performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-semibold text-foreground hover:bg-card hover:border-primary/40 transition-all shadow-sm"
            href={bioUrl}
          >
            <span>View Public Bio</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      {/* Primary SoundKit Web Onboarding Action Card */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/5 to-card p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
              <Sparkles className="size-4" />
              <span>Complete Profile Setup</span>
            </div>
            <h2 className="font-playfair text-2xl sm:text-3xl font-medium text-foreground">
              Finish setting up your account on SoundKit
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Your bio link is active! To upload your music catalog, connect
              Stripe for tip payouts, join regional leaderboards, and enter
              producer battles, finish setting up your account on SoundKit Web.
            </p>
          </div>

          <a
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 hover:scale-105 active:scale-95 transition-all shrink-0"
            href={fullWebDashboardUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>Go to mysoundkit.com/dashboard</span>
            <ArrowRight className="size-4" />
          </a>
        </div>
      </div>

      {/* Shareable Bio Link Card */}
      <div className="rounded-3xl border border-border/50 bg-card/40 p-6 sm:p-8 backdrop-blur-xl shadow-md space-y-4">
        <h3 className="font-semibold text-base text-foreground">
          Your Official Bio Link
        </h3>
        <p className="text-xs text-muted-foreground">
          Paste this link in your Instagram, TikTok, and X profiles.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex h-11 w-full items-center rounded-2xl border border-border/60 bg-white/5 px-4 font-mono text-sm text-primary">
            {bioUrl}
          </div>

          <button
            className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-white/10 px-6 font-semibold text-xs text-foreground hover:bg-white/15 transition-all shrink-0"
            onClick={copyBioLink}
            type="button"
          >
            {copied ? (
              <>
                <Check className="size-4 text-primary" />
                <span className="text-primary font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dialed-in Sub-Routes: Analytics & Payments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Analytics Card */}
        <div className="rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <BarChart3 className="size-5 text-primary" />
              <span>Bio Analytics</span>
            </div>
            <a
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              href="/dashboard/analytics"
            >
              <span>View Details</span>
              <ChevronRight className="size-3.5" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            Track visitors arriving from your social bios.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-2xl border border-border/40 bg-white/5 p-4 text-center">
              <p className="text-xs text-muted-foreground">Profile Views</p>
              <p className="font-playfair text-2xl font-bold text-foreground mt-1">
                0
              </p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-white/5 p-4 text-center">
              <p className="text-xs text-muted-foreground">Track Streams</p>
              <p className="font-playfair text-2xl font-bold text-foreground mt-1">
                0
              </p>
            </div>
          </div>
        </div>

        {/* Payments / Tips Card */}
        <div className="rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <HandCoins className="size-5 text-primary" />
              <span>Bio Tips & Payouts</span>
            </div>
            <a
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              href="/dashboard/payments"
            >
              <span>View Details</span>
              <ChevronRight className="size-3.5" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            Fan tips sent directly to your bio page.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-2xl border border-border/40 bg-white/5 p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Tips</p>
              <p className="font-playfair text-2xl font-bold text-foreground mt-1">
                $0.00
              </p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-white/5 p-4 text-center">
              <p className="text-xs text-muted-foreground">Supporters</p>
              <p className="font-playfair text-2xl font-bold text-foreground mt-1">
                0
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
