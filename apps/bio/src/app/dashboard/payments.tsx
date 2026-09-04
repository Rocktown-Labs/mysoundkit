/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import React from "react";

import { buildSoundKitWebUrl } from "@/lib/api";

export const Route = createFileRoute("/dashboard/payments")({
  component: BioPaymentsPage,
});

function BioPaymentsPage() {
  const stripePayoutsUrl = buildSoundKitWebUrl("/dashboard/monetization");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Back Link */}
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground group transition-colors"
          to="/dashboard"
        >
          <ArrowLeft className="size-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-3xl sm:text-4xl font-medium text-foreground">
            Bio Tips & Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View tip receipts and manage your Stripe Connect payouts.
          </p>
        </div>

        <a
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition-all"
          href={stripePayoutsUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <CreditCard className="size-3.5" />
          <span>Manage Stripe Express Payouts</span>
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">Total Tips Collected</p>
          <p className="font-playfair text-3xl font-bold text-foreground mt-2">
            $45.00
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Processed via Stripe Connect
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">Supporter Count</p>
          <p className="font-playfair text-3xl font-bold text-foreground mt-2">
            3
          </p>
          <p className="text-[11px] text-primary mt-1 font-semibold">
            Avg. $15.00 per tip
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">Payout Status</p>
          <div className="flex items-center gap-1.5 mt-3 text-emerald-400 text-sm font-semibold">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Connected to Stripe</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Rolling 2-day payouts to bank
          </p>
        </div>
      </div>

      {/* Recent Tips List */}
      <div className="rounded-3xl border border-border/50 bg-card/40 p-6 sm:p-8 backdrop-blur-xl shadow-md space-y-6">
        <h2 className="font-semibold text-lg text-foreground">
          Recent Supporter Tips
        </h2>

        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-xs">
                M
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  Marcus V.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  &ldquo;Keep making heat! Best track on my playlist.&rdquo;
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-foreground">+$25.00</p>
              <p className="text-[11px] text-muted-foreground">2 days ago</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-xs">
                E
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  Elena R.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  &ldquo;Loved the live stream session!&rdquo;
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-foreground">+$10.00</p>
              <p className="text-[11px] text-muted-foreground">4 days ago</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-xs">
                J
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  Jordan K.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  &ldquo;Representing Arkansas sound!&rdquo;
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-foreground">+$10.00</p>
              <p className="text-[11px] text-muted-foreground">1 week ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
