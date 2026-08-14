import { env } from "@soundkit/env/web";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountManagement,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayoutReconciliationReport,
  ConnectPayouts,
} from "@stripe/react-connect-js";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, ExternalLink, ShieldCheck } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";

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
  const statusQuery = useQuery({
      queryFn: fetchSellerStatus,
      queryKey: ["seller", "status"],
      refetchInterval: 15_000,
    }),
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
    paymentsReady = status?.onboardingStatus === "enabled";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <CircleDollarSign className="size-4" />
          My Career
        </div>
        <h1 className="mt-1 text-3xl font-bold">Payments</h1>
        <p className="mt-1 text-muted-foreground">
          Set up payouts and manage the money you earn from SoundKit.
        </p>
      </div>

      {paymentsReady ? null : (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Set up artist payments</CardTitle>
            <CardDescription>
              Stripe securely verifies your identity and payout account. You
              must finish setup before fans can purchase your music or send
              tips.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <Badge variant="outline">
              {status?.onboardingStatus === "restricted"
                ? "Action required"
                : "Setup incomplete"}
            </Badge>
            <Button
              disabled={isStartingOnboarding || statusQuery.isLoading}
              onClick={() => void startOnboarding()}
            >
              {isStartingOnboarding
                ? "Opening Stripe…"
                : "Continue with Stripe"}
              <ExternalLink className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {paymentsReady && stripeConnect ? (
        <ConnectComponentsProvider connectInstance={stripeConnect}>
          <div className="space-y-5">
            <ConnectNotificationBanner />
            <Tabs defaultValue="payments">
              <TabsList>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="payouts">Payouts</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>
              <TabsContent className="mt-5" value="payments">
                <ConnectPayments />
              </TabsContent>
              <TabsContent className="mt-5" value="payouts">
                <ConnectPayouts />
              </TabsContent>
              <TabsContent className="mt-5" value="reports">
                <ConnectPayoutReconciliationReport />
              </TabsContent>
              <TabsContent className="mt-5" value="account">
                <ConnectAccountManagement />
              </TabsContent>
            </Tabs>
          </div>
        </ConnectComponentsProvider>
      ) : null}

      {paymentsReady && !stripeConnect ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Payments are connected</AlertTitle>
          <AlertDescription>
            Add the Stripe publishable key to this deployment to load embedded
            payment and payout management.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
