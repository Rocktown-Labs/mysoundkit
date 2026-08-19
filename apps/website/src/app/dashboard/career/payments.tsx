import { env } from "@soundkit/env/web";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountManagement,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayouts,
} from "@stripe/react-connect-js";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Crown,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Lock,
  Music,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import { useArtistEarningsQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/payments")({
  component: CareerPaymentsPage,
});

interface SellerStatus {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingStatus:
    | "enabled"
    | "not_started"
    | "pending"
    | "rejected"
    | "restricted";
  payoutsEnabled: boolean;
  stripeAccountId: string | null;
}

const fetchSellerStatus = async (): Promise<SellerStatus> => {
  const response = await fetch(`${API_V1_URL}/seller/status`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Unable to load your payments status.");
  }
  return response.json() as Promise<SellerStatus>;
};

function CareerPaymentsPage() {
  const [activeTab, setActiveTab] = useState<
      "overview" | "statements" | "stripe_account"
    >("overview"),
    statusQuery = useQuery({
      queryFn: fetchSellerStatus,
      queryKey: ["seller", "status"],
      refetchInterval: 15_000,
    }),
    earningsQuery = useArtistEarningsQuery(),
    [isStartingOnboarding, setIsStartingOnboarding] = useState(false),
    [stripeConnect] = useState(() => {
      if (!env.VITE_STRIPE_PUBLISHABLE_KEY) {
        return null;
      }
      return loadConnectAndInitialize({
        appearance: {
          overlays: "dialog",
          variables: {
            colorBackground: "#09090b",
            colorPrimary: "#a798ff",
            colorText: "#fafafa",
          },
        },
        fetchClientSecret: async () => {
          const response = await fetch(`${API_V1_URL}/seller/account-session`, {
            credentials: "include",
            method: "POST",
          });
          if (!response.ok) {
            return;
          }
          const body = (await response.json()) as { clientSecret: string };
          return body.clientSecret;
        },
        publishableKey: env.VITE_STRIPE_PUBLISHABLE_KEY,
      });
    }),
    startOnboarding = async () => {
      setIsStartingOnboarding(true);
      try {
        const pageUrl = `${window.location.origin}/dashboard/career/payments`,
          response = await fetch(`${API_V1_URL}/seller/account-link`, {
            body: JSON.stringify({ refreshUrl: pageUrl, returnUrl: pageUrl }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }),
          body = (await response.json().catch(() => ({}))) as {
            accountLinkUrl?: string;
            message?: string;
          };
        if (!(response.ok && body.accountLinkUrl)) {
          throw new Error(body.message ?? "Unable to start Stripe onboarding.");
        }
        window.location.assign(body.accountLinkUrl);
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Try again shortly.",
          title: "Payments setup unavailable",
          variant: "destructive",
        });
        setIsStartingOnboarding(false);
      }
    },
    status = statusQuery.data,
    earnings = earningsQuery.data,
    paymentsReady = status?.onboardingStatus === "enabled";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <BadgeDollarSign className="size-3.5" />
            Creator Monetization
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mt-1">
            Artist Earnings & Payouts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly Creator Rewards pool settlement, direct music sales, and
            payout balance.
          </p>
        </div>

        {!paymentsReady && (
          <Button
            onClick={startOnboarding}
            disabled={isStartingOnboarding}
            className="gap-2 font-bold"
          >
            <ShieldCheck className="size-4" />
            {status?.onboardingStatus === "restricted"
              ? "Complete Verification"
              : "Connect Payout Bank Account"}
          </Button>
        )}
      </div>

      {/* Top 4 SoundKit Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Estimated This Month */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                This Month
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] py-0 px-1 border-primary/30 text-primary"
              >
                Estimated
              </Badge>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Sparkles className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-purple-400">
              ${((earnings?.estimatedThisMonthCents ?? 0) / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Updates daily until monthly settlement closes
            </p>
          </CardContent>
        </Card>

        {/* 2. Available Balance */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Available Balance
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Wallet className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-emerald-400">
              ${((earnings?.availableBalanceCents ?? 0) / 100).toFixed(2)}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Payout Threshold ($25.00)</span>
                <span className="font-mono">
                  ${((earnings?.availableBalanceCents ?? 0) / 100).toFixed(2)} /
                  $25.00
                </span>
              </div>
              <Progress
                value={earnings?.payoutProgressPercent ?? 0}
                className="h-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Pending (30-Day Reserve) */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Reserve
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-amber-400">
              ${((earnings?.pendingReserveCents ?? 0) / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Inside standard 30-day settlement reserve
            </p>
          </CardContent>
        </Card>

        {/* 4. Next Payout Schedule */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Next Payout
            </CardTitle>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Calendar className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {earnings?.nextEstimatedPayoutDate ?? "End of Month"}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {paymentsReady ? (
                <span className="text-emerald-400 font-medium">
                  ✓ Bank Account Connected
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  Setup required for payout
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          setActiveTab(val as "overview" | "statements" | "stripe_account")
        }
        className="space-y-6"
      >
        <TabsList className="bg-muted/60 h-10 p-1">
          <TabsTrigger
            value="overview"
            className="text-xs font-semibold gap-1.5 px-4"
          >
            <PiggyBank className="size-3.5" />
            Earnings Breakdown
          </TabsTrigger>
          <TabsTrigger
            value="statements"
            className="text-xs font-semibold gap-1.5 px-4"
          >
            <FileText className="size-3.5" />
            Monthly Statements
          </TabsTrigger>
          <TabsTrigger
            value="stripe_account"
            className="text-xs font-semibold gap-1.5 px-4"
          >
            <ShieldCheck className="size-3.5" />
            Payout Account (Stripe)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EARNINGS OVERVIEW & CATEGORIES */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Revenue Streams Breakdown */}
            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Earnings by Category
                </CardTitle>
                <CardDescription className="text-xs">
                  Persisted revenue categorized across SoundKit monetization
                  streams.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(earnings?.categories ?? []).map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {cat.category === "creator_rewards" ? (
                          <Crown className="size-4 text-amber-400" />
                        ) : (cat.category === "music_sales" ? (
                          <Music className="size-4 text-primary" />
                        ) : (
                          <CircleDollarSign className="size-4 text-emerald-400" />
                        ))}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground">
                          {cat.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {cat.category === "creator_rewards"
                            ? "User-centric pool allocation"
                            : (cat.category === "music_sales"
                              ? "WAV/MP3 track purchases"
                              : "Direct fan support")}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm text-foreground">
                      ${(cat.amountCents / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Creator Rewards Rules & Payout Policy */}
            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Info className="size-4 text-primary" />
                  Creator Rewards & Payout Rules
                </CardTitle>
                <CardDescription className="text-xs">
                  How SoundKit calculates and distributes earnings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <div className="p-3 rounded-xl border border-border/30 bg-muted/20 space-y-2">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Crown className="size-3.5 text-amber-400" />
                    User-Centric Creator Rewards Pool
                  </div>
                  <p>
                    SoundKit uses a user-centric funded pool model. Each
                    subscriber&apos;s subscription fee is allocated directly
                    among the artists they listen to each month. Effective
                    stream value varies based on individual subscriber listening
                    behavior.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg border border-border/30 bg-background/50">
                    <div className="font-semibold text-foreground">
                      Monthly Settlement
                    </div>
                    <div className="text-[11px] mt-0.5">
                      Calculated at calendar month close.
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border/30 bg-background/50">
                    <div className="font-semibold text-foreground">
                      30-Day Reserve
                    </div>
                    <div className="text-[11px] mt-0.5">
                      Clears chargeback/refund hold.
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border/30 bg-background/50">
                    <div className="font-semibold text-foreground">
                      $25 Payout Threshold
                    </div>
                    <div className="text-[11px] mt-0.5">
                      Transfers when balance ≥ $25.
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border/30 bg-background/50">
                    <div className="font-semibold text-foreground">
                      Currency
                    </div>
                    <div className="text-[11px] mt-0.5">
                      United States Dollar (USD).
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: MONTHLY STATEMENTS */}
        <TabsContent value="statements" className="space-y-6">
          <Card className="border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Accounting Statements History
              </CardTitle>
              <CardDescription className="text-xs">
                Historical monthly earnings settled from accounting periods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(earnings?.statements && earnings.statements.length > 0) ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground pb-2">
                        <th className="py-2.5 font-semibold">
                          Accounting Period
                        </th>
                        <th className="py-2.5 font-semibold text-right">
                          30s+ Plays
                        </th>
                        <th className="py-2.5 font-semibold text-right">
                          Qualified Streams
                        </th>
                        <th className="py-2.5 font-semibold text-right">
                          Creator Rewards
                        </th>
                        <th className="py-2.5 font-semibold text-right">
                          Music Sales
                        </th>
                        <th className="py-2.5 font-semibold text-right">
                          Fan Tips
                        </th>
                        <th className="py-2.5 font-semibold text-right">
                          Total Net
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {earnings.statements.map((stmt, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 pr-4 font-bold text-foreground">
                            {stmt.monthLabel}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold">
                            {stmt.plays.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-amber-400">
                            {stmt.qualifiedStreams.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-foreground">
                            ${(stmt.creatorRewardsCents / 100).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-foreground">
                            ${(stmt.musicSalesCents / 100).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-foreground">
                            ${(stmt.tipsCents / 100).toFixed(2)}
                          </td>
                          <td className="py-3 pl-3 text-right font-mono font-extrabold text-emerald-400">
                            ${(stmt.totalEarningsCents / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No finalized accounting statements yet. Statements generate at
                  monthly settlement close.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PAYOUT ACCOUNT (STRIPE CONNECT) */}
        <TabsContent value="stripe_account" className="space-y-6">
          {paymentsReady ? (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <AlertTitle className="text-emerald-400 font-bold text-xs">
                Payout Account Active & Verified
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                Your Stripe Connect bank account is fully connected. Qualified
                Creator Rewards and direct sales earnings above $25.00 transfer
                automatically.
              </AlertDescription>
            </Alert>
          ) : (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  Set up artist payout rail
                </CardTitle>
                <CardDescription className="text-xs">
                  Stripe securely verifies your identity and direct deposit bank
                  account.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <Badge variant="outline">
                  {status?.onboardingStatus === "restricted"
                    ? "Action required"
                    : "Setup incomplete"}
                </Badge>
                <Button
                  disabled={isStartingOnboarding}
                  onClick={startOnboarding}
                  size="sm"
                  className="font-bold gap-1.5"
                >
                  <ExternalLink className="size-3.5" />
                  {isStartingOnboarding
                    ? "Opening Stripe..."
                    : "Begin Stripe Verification"}
                </Button>
              </CardContent>
            </Card>
          )}

          {stripeConnect && (
            <ConnectComponentsProvider connectInstance={stripeConnect}>
              <div className="space-y-4">
                <ConnectNotificationBanner />
                <ConnectAccountManagement />
                <ConnectPayouts />
                <ConnectPayments />
              </div>
            </ConnectComponentsProvider>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
