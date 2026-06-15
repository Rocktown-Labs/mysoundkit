import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_V1_URL } from "@/lib/api";

export const Route = createFileRoute("/dashboard/finance")({
  component: FinanceDashboard,
});

interface SellerStatus {
  chargesEnabled: boolean;
  onboardingStatus: string;
  payoutsEnabled: boolean;
}

function FinanceDashboard() {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<SellerStatus | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch(`${API_V1_URL}/seller/status`, {
          credentials: "include",
        });
        setStatus((await response.json()) as SellerStatus);
      } catch {
        setStatus(null);
      }
    };

    void loadStatus();
  }, []);

  const startConnectOnboarding = async () => {
    const response = await fetch(`${API_V1_URL}/seller/account-link`, {
      body: JSON.stringify({
        refreshUrl: window.location.href,
        returnUrl: window.location.href,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as {
      accountLinkUrl?: string;
      message?: string;
    };

    if (payload.accountLinkUrl) {
      window.location.assign(payload.accountLinkUrl);
      return;
    }

    setMessage(payload.message ?? "Unable to open payout onboarding.");
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Artist Finance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Status
              label="Connect"
              value={status?.onboardingStatus ?? "Not started"}
            />
            <Status
              label="Charges"
              value={status?.chargesEnabled ? "Enabled" : "Disabled"}
            />
            <Status
              label="Payouts"
              value={status?.payoutsEnabled ? "Enabled" : "Disabled"}
            />
          </div>
          {message ? (
            <p className="text-sm text-destructive">{message}</p>
          ) : null}
          <Button onClick={() => void startConnectOnboarding()}>
            Set up or update Stripe Connect
          </Button>
          <p className="text-sm text-muted-foreground">
            SoundKit retains 10% on music sales and community subscriptions, and
            5% on tips.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function Status({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border p-4">
      <p className="text-xs font-bold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-black capitalize">{value.replaceAll("_", " ")}</p>
    </div>
  );
}
