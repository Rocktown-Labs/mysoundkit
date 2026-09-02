/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, LoaderCircle, Mic2 } from "lucide-react";
import React, { useState } from "react";
import type { FormEvent } from "react";

import { API_BASE_URL, buildSoundKitWebUrl } from "@/lib/api";

export const Route = createFileRoute("/signup/artist")({
  component: ArtistSignupPage,
});

function ArtistSignupPage() {
  const navigate = useNavigate(),
    [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [genre, setGenre] = useState("Hip Hop"),
    [isSubmitting, setIsSubmitting] = useState(false),
    [errorMessage, setErrorMessage] = useState<string | null>(null),
    handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (
        !name.trim() ||
        !username.trim() ||
        !email.trim() ||
        password.length < 8
      ) {
        setErrorMessage(
          "Please complete all required fields (password min 8 characters)."
        );
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
          body: JSON.stringify({
            accountType: "artist",
            email: email.trim(),
            genre,
            name: name.trim(),
            password,
            username: username
              .trim()
              .toLowerCase()
              .replaceAll(/[^a-z0-9_-]/gu, ""),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        // Whether newly registered or claimed, route to the artist bio dashboard
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "soundkit_bio_artist_username",
            username.trim()
          );
        }
        navigate({ to: "/dashboard" });
      } catch {
        // Fallback redirection to dashboard
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "soundkit_bio_artist_username",
            username.trim()
          );
        }
        navigate({ to: "/dashboard" });
      } finally {
        setIsSubmitting(false);
      }
    },
    soundKitWebOnboarding = buildSoundKitWebUrl("/signup/artist/credentials");

  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="w-full">
        <a
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-6 group transition-colors"
          href="/signup"
        >
          <ArrowLeft className="size-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to selection</span>
        </a>

        <div className="rounded-3xl border border-border/50 bg-card/60 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
          <div className="space-y-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Mic2 className="size-5" />
            </div>
            <h1 className="font-playfair text-2xl sm:text-3xl font-medium text-foreground">
              Claim Your Artist Bio
            </h1>
            <p className="text-xs text-muted-foreground">
              Lock in your custom SoundKit link and start sharing your music.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="artist-name"
              >
                Artist / Band Name
              </label>
              <input
                className="mt-1.5 h-10 w-full rounded-xl border border-border/60 bg-white/5 px-3.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="artist-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alphamane"
                required
                type="text"
                value={name}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="artist-username"
              >
                Claim Username (soundkit.bio/...)
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-xs text-muted-foreground font-mono">
                  soundkit.bio/
                </span>
                <input
                  className="h-10 w-full rounded-xl border border-border/60 bg-white/5 pl-28 pr-3.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  id="artist-username"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourname"
                  required
                  type="text"
                  value={username}
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="artist-genre"
              >
                Primary Genre
              </label>
              <select
                className="mt-1.5 h-10 w-full rounded-xl border border-border/60 bg-card px-3.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="artist-genre"
                onChange={(e) => setGenre(e.target.value)}
                value={genre}
              >
                <option value="Hip Hop">Hip Hop</option>
                <option value="R&B">R&B</option>
                <option value="Electronic">Electronic</option>
                <option value="Pop">Pop</option>
                <option value="Rock">Rock</option>
                <option value="Afrobeats">Afrobeats</option>
                <option value="Latin">Latin</option>
                <option value="Country">Country</option>
                <option value="Jazz">Jazz</option>
                <option value="Classical">Classical</option>
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="artist-email"
              >
                Email Address
              </label>
              <input
                className="mt-1.5 h-10 w-full rounded-xl border border-border/60 bg-white/5 px-3.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="artist-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="artist@recordlabel.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="artist-password"
              >
                Password
              </label>
              <input
                className="mt-1.5 h-10 w-full rounded-xl border border-border/60 bg-white/5 px-3.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="artist-password"
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-sm text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Claiming bio...</span>
                </>
              ) : (
                <>
                  <span>Claim Account & View Dashboard</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-border/40 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account on SoundKit?{" "}
              <a
                className="font-semibold text-primary hover:underline"
                href={soundKitWebOnboarding}
                rel="noopener noreferrer"
                target="_blank"
              >
                Sign in to SoundKit
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
