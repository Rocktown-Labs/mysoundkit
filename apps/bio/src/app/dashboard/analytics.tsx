/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Globe, Instagram, Music } from "lucide-react";
import React from "react";

import { buildSoundKitWebUrl } from "@/lib/api";

export const Route = createFileRoute("/dashboard/analytics")({
  component: BioAnalyticsPage,
});

function BioAnalyticsPage() {
  const fullAnalyticsUrl = buildSoundKitWebUrl("/dashboard/analytics");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Back Link */}
      <div>
        <a
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground group transition-colors"
          href="/dashboard"
        >
          <ArrowLeft className="size-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </a>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-3xl sm:text-4xl font-medium text-foreground">
            Bio Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor traffic, top referring platforms, and streaming
            click-throughs.
          </p>
        </div>

        <a
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-semibold text-foreground hover:bg-card transition-all"
          href={fullAnalyticsUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span>Advanced Web Analytics</span>
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">Profile Views (7d)</p>
          <p className="font-playfair text-3xl font-bold text-foreground mt-2">
            142
          </p>
          <p className="text-[11px] text-primary mt-1 font-semibold">
            +18% from last week
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">Audio Streams (7d)</p>
          <p className="font-playfair text-3xl font-bold text-foreground mt-2">
            89
          </p>
          <p className="text-[11px] text-primary mt-1 font-semibold">
            62% completion rate
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">Streaming Link Clicks</p>
          <p className="font-playfair text-3xl font-bold text-foreground mt-2">
            34
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Spotify, Apple, YouTube
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">Tip Conversion</p>
          <p className="font-playfair text-3xl font-bold text-foreground mt-2">
            3.5%
          </p>
          <p className="text-[11px] text-primary mt-1 font-semibold">
            5 supporters
          </p>
        </div>
      </div>

      {/* Traffic Sources Breakdown */}
      <div className="rounded-3xl border border-border/50 bg-card/40 p-6 sm:p-8 backdrop-blur-xl shadow-md space-y-6">
        <h2 className="font-semibold text-lg text-foreground">
          Top Referrer Platforms
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2 text-foreground">
                <Instagram className="size-4 text-[#E4405F]" />
                Instagram (Bio Link & Stories)
              </span>
              <span className="text-muted-foreground">58% (82 visitors)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "58%" }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2 text-foreground">
                <Music className="size-4 text-primary" />
                TikTok
              </span>
              <span className="text-muted-foreground">24% (34 visitors)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "24%" }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2 text-foreground">
                <Globe className="size-4 text-muted-foreground" />
                Direct / Other
              </span>
              <span className="text-muted-foreground">18% (26 visitors)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-muted rounded-full"
                style={{ width: "18%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
