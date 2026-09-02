/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Headphones, LoaderCircle } from "lucide-react";
import React, { useState } from "react";
import type { FormEvent } from "react";

import { API_BASE_URL, buildSoundKitWebUrl } from "@/lib/api";

export const Route = createFileRoute("/signup/fan")({
  component: FanSignupPage,
});

function FanSignupPage() {
  const navigate = useNavigate(),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [isSubmitting, setIsSubmitting] = useState(false),
    [errorMessage, setErrorMessage] = useState<string | null>(null),
    handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!name.trim() || !email.trim() || password.length < 8) {
        setErrorMessage(
          "Please fill in all fields (password must be at least 8 characters)."
        );
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim(),
            password,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null),
            msg =
              data &&
              typeof data === "object" &&
              typeof data.message === "string"
                ? data.message
                : "Sign up could not be completed. You can also sign up on SoundKit web.";
          throw new Error(msg);
        }

        // Fan onboarding completes and redirects to /
        navigate({ to: "/" });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Sign up could not be completed at this time."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    soundKitWebSignup = buildSoundKitWebUrl("/signup/fan/credentials");

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
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-primary">
              <Headphones className="size-5" />
            </div>
            <h1 className="font-playfair text-2xl sm:text-3xl font-medium text-foreground">
              Create Fan Account
            </h1>
            <p className="text-xs text-muted-foreground">
              Join SoundKit to bookmark artists, track plays, and tip creators.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="fan-name"
              >
                Your Name
              </label>
              <input
                className="mt-1.5 h-10 w-full rounded-xl border border-border/60 bg-white/5 px-3.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="fan-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Carter"
                required
                type="text"
                value={name}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="fan-email"
              >
                Email Address
              </label>
              <input
                className="mt-1.5 h-10 w-full rounded-xl border border-border/60 bg-white/5 px-3.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="fan-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-muted-foreground"
                htmlFor="fan-password"
              >
                Password
              </label>
              <input
                className="mt-1.5 h-10 w-full rounded-xl border border-border/60 bg-white/5 px-3.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="fan-password"
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
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Join as Fan</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-border/40 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Prefer signing up on the full web app?{" "}
              <a
                className="font-semibold text-primary hover:underline"
                href={soundKitWebSignup}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open SoundKit Web
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
