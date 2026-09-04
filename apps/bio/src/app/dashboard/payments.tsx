/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  HandCoins,
  LoaderCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  loadBioArtistEarnings,
  loadBioSellerStatus,
  loadBioTips,
  SOUNDKIT_WEB_URL,
} from "@/lib/api";
import type {
  BioArtistEarnings,
  BioCurrentUser,
  BioSellerStatus,
  BioTipsOverview,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard/payments")({
  component: BioPaymentsPage,
});

const formatDollars = (amountCents: number) =>
    `$${(amountCents / 100).toFixed(2)}`,
  formatTipDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(date);
  },
  sellerStatusLabel = (status: BioSellerStatus) => {
    if (status.chargesEnabled && status.payoutsEnabled) {
      return "Connected to Stripe";
    }
    if (status.onboardingStatus === "restricted") {
      return "Verification required";
    }
    if (status.onboardingStatus === "pending") {
      return "Verification pending";
    }
    return "Connect a payout account";
  };

function BioPaymentsPage() {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null);
  const [earnings, setEarnings] = useState<BioArtistEarnings | null>(null);
  const [tips, setTips] = useState<BioTipsOverview | null>(null);
  const [sellerStatus, setSellerStatus] = useState<BioSellerStatus | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPayments = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const user = await getCurrentSessionUser();
        if (cancelled) {
          return;
        }
        setCurrentUser(user);
        if (!user || user.accountType !== "artist") {
          return;
        }

        const [earningsData, tipsData, sellerData] = await Promise.all([
          loadBioArtistEarnings(),
          loadBioTips(50),
          loadBioSellerStatus(),
        ]);
        if (!cancelled) {
          setEarnings(earningsData);
          setTips(tipsData);
          setSellerStatus(sellerData);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We could not load your payment data."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchPayments();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <DashboardLoading label="Loading your payments…" />;
  }

  if (!currentUser || currentUser.accountType !== "artist") {
    return (
      <DashboardMessage description="Sign in with an artist account to view tips and payouts." />
    );
  }

  const stripePayoutsUrl = buildSoundKitWebUrl("/dashboard/career/payments"),
    tipOverview = tips ?? {
      averageTipCents: 0,
      supporterCount: 0,
      tips: [],
      totalTipCount: 0,
      totalTipsCents: 0,
    },
    payoutReady = Boolean(
      sellerStatus?.chargesEnabled && sellerStatus.payoutsEnabled
    );

  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl overflow-x-clip px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      <div>
        <Link
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          to="/dashboard"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-playfair text-3xl font-medium text-foreground sm:text-4xl">
            Bio Tips & Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fan tips and payout balances from your SoundKit account.
          </p>
        </div>

        <a
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:opacity-90"
          href={stripePayoutsUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <CreditCard className="size-3.5" />
          <span>Manage payouts</span>
          <ExternalLink className="size-3" />
        </a>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PaymentStat
          description="Gross fan support received"
          label="Total Tips"
          value={formatDollars(tipOverview.totalTipsCents)}
        />
        <PaymentStat
          description={`${formatDollars(tipOverview.averageTipCents)} average tip`}
          label="Supporters"
          value={tipOverview.supporterCount.toLocaleString()}
        />
        <PaymentStat
          description="Estimated creator earnings this month"
          label="This Month"
          value={formatDollars(earnings?.estimatedThisMonthCents ?? 0)}
        />
        <PaymentStat
          description={`${formatDollars(earnings?.availableBalanceCents ?? 0)} available for payout`}
          label="Available Balance"
          value={formatDollars(earnings?.availableBalanceCents ?? 0)}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <section className="min-w-0 rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-lg text-foreground">
                Recent Supporter Tips
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Successful tips received by your artist account.
              </p>
            </div>
            <HandCoins className="size-5 shrink-0 text-primary" />
          </div>

          {tipOverview.tips.length > 0 ? (
            <div className="divide-y divide-border/40">
              {tipOverview.tips.map((tip) => (
                <div
                  className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  key={tip.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {tip.fanDisplayName[0]?.toUpperCase() ?? "F"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {tip.fanDisplayName}
                      </p>
                      {tip.message ? (
                        <p className="break-words text-xs italic text-muted-foreground">
                          &ldquo;{tip.message}&rdquo;
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        {formatTipDate(tip.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-left text-sm font-bold text-foreground sm:text-right">
                    +{formatDollars(tip.amountCents)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-white/[0.02] p-10 text-center text-xs text-muted-foreground">
              Your successful fan tips will appear here.
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl sm:p-8 space-y-5">
          <div className="flex items-center gap-2">
            {payoutReady ? (
              <CheckCircle2 className="size-5 text-emerald-400" />
            ) : (
              <Clock3 className="size-5 text-amber-400" />
            )}
            <h2 className="font-semibold text-lg text-foreground">
              Payout status
            </h2>
          </div>
          <p className={payoutReady ? "text-emerald-400" : "text-amber-400"}>
            {sellerStatus
              ? sellerStatusLabel(sellerStatus)
              : "Payout status unavailable"}
          </p>
          <div className="space-y-3 rounded-2xl border border-border/40 bg-white/5 p-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pending reserve</span>
              <span className="font-mono font-semibold text-foreground">
                {formatDollars(earnings?.pendingReserveCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Paid lifetime</span>
              <span className="font-mono font-semibold text-foreground">
                {formatDollars(earnings?.paidLifetimeCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Next estimate</span>
              <span className="text-right font-semibold text-foreground">
                {earnings?.nextEstimatedPayoutDate ?? "End of month"}
              </span>
            </div>
          </div>
          <a
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            href={SOUNDKIT_WEB_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>Open full payments dashboard</span>
            <ExternalLink className="size-3" />
          </a>
        </section>
      </div>

      <section className="min-w-0 rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl sm:p-8 space-y-5">
        <div>
          <h2 className="font-semibold text-lg text-foreground">
            Monthly statements
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Historical statements from SoundKit accounting periods.
          </p>
        </div>
        {earnings?.statements.length ? (
          <div className="space-y-3">
            {earnings.statements.map((statement) => (
              <div
                className="grid min-w-0 grid-cols-2 gap-3 rounded-2xl border border-border/40 bg-white/5 p-4 sm:grid-cols-5 sm:items-center"
                key={`${statement.periodStartsAt}-${statement.periodEndsAt}`}
              >
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {statement.monthLabel}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {statement.plays.toLocaleString()} verified plays
                  </p>
                </div>
                <StatementValue
                  label="Rewards"
                  value={formatDollars(statement.creatorRewardsCents)}
                />
                <StatementValue
                  label="Sales"
                  value={formatDollars(statement.musicSalesCents)}
                />
                <StatementValue
                  label="Tips"
                  value={formatDollars(statement.tipsCents)}
                />
                <StatementValue
                  label="Total"
                  value={formatDollars(statement.totalEarningsCents)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-white/[0.02] p-8 text-center text-xs text-muted-foreground">
            Finalized accounting statements will appear here.
          </div>
        )}
      </section>
    </div>
  );
}

function PaymentStat({
  description,
  label,
  value,
}: {
  description: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-md backdrop-blur-xl">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 truncate font-playfair text-3xl font-bold text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function StatementValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function DashboardLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
      <LoaderCircle className="mr-2 size-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

function DashboardMessage({ description }: { description: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <HandCoins className="size-7" />
      </div>
      <h1 className="mt-5 font-playfair text-3xl font-medium text-foreground">
        Payments unavailable
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
