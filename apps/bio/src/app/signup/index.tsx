/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Headphones, Mic2, Sparkles } from "lucide-react";
import React from "react";

export const Route = createFileRoute("/signup/")({
  component: SignupSelectionPage,
});

function SignupSelectionPage() {
  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary mb-6">
        <Sparkles className="size-3.5" />
        <span>Join SoundKit</span>
      </div>

      <h1 className="font-playfair text-3xl sm:text-5xl font-medium tracking-tight text-foreground">
        Choose your account type
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Whether you are producing music or supporting independent talent,
        SoundKit has you covered.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fan Choice */}
        <a
          className="group flex flex-col items-center rounded-3xl border border-border/50 bg-card/40 p-6 text-center backdrop-blur-xl hover:border-primary/50 hover:bg-card/70 transition-all shadow-lg"
          href="/signup/fan"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
            <Headphones className="size-7" />
          </div>
          <h2 className="mt-4 font-bold text-lg text-foreground">
            I&apos;m a Fan / Listener
          </h2>
          <p className="mt-1 text-xs text-muted-foreground flex-1">
            Discover underground artists, save tracks, and support creators with
            tips.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline">
            <span>Continue as Fan</span>
            <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </a>

        {/* Artist Choice */}
        <a
          className="group flex flex-col items-center rounded-3xl border border-primary/40 bg-primary/5 p-6 text-center backdrop-blur-xl hover:border-primary hover:bg-primary/10 transition-all shadow-lg ring-1 ring-primary/20"
          href="/signup/artist"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Mic2 className="size-7" />
          </div>
          <h2 className="mt-4 font-bold text-lg text-foreground">
            I&apos;m an Artist
          </h2>
          <p className="mt-1 text-xs text-muted-foreground flex-1">
            Claim your custom{" "}
            <span className="font-semibold text-foreground">
              soundkit.bio/username
            </span>{" "}
            link, stream music, and receive fan tips.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline">
            <span>Claim Artist Bio</span>
            <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </a>
      </div>
    </div>
  );
}
