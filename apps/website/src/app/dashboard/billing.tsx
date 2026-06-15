import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_V1_URL } from "@/lib/api";

export const Route = createFileRoute("/dashboard/billing")({
  component: BillingDashboard,
});

interface Subscription {
  activePlanCode: string | null;
  status: string | null;
}

function BillingDashboard() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const response = await fetch(`${API_V1_URL}/billing/subscription`, {
          credentials: "include",
        });
        setSubscription((await response.json()) as Subscription);
      } catch {
        setSubscription(null);
      }
    };

    void loadSubscription();
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-xl font-black">
              {subscription?.activePlanCode?.replaceAll("_", " ") ?? "Free"}
            </p>
            <p className="text-sm text-muted-foreground">
              Status: {subscription?.status ?? "No paid subscription"}
            </p>
          </div>
          <Button asChild>
            <Link to="/pricing">View plans and manage subscription</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Artist community memberships are billed separately from your
            SoundKit platform plan.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
