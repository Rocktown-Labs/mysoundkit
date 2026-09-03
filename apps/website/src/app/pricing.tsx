import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PlanSelectionCard } from "@/components/billing/plan-selection-card";
import { Badge } from "@/components/ui/badge";
import {
  fallbackBillingPlans,
  premiumPlanCodeForAccount,
  premiumSuccessPathForAccount,
} from "@/lib/pricing-flow";
import {
  useBillingCheckoutMutation,
  useBillingPlansQuery,
  useMeQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

const descriptions = {
  artist_free: "Start your independent artist profile with one account.",
  fan_free: "Discover public releases and build your library.",
  soundkit_premium_artist:
    "Unlock creator rewards, live tools, and a five-seat workspace.",
  soundkit_premium_fan:
    "Unlock premium listening, live access, and a five-seat workspace.",
} as const;

function PricingPage() {
  const { data: me } = useMeQuery(),
    plansQuery = useBillingPlansQuery(),
    checkout = useBillingCheckoutMutation(),
    [message, setMessage] = useState(""),
    accountType = me?.user.accountType ?? "fan",
    plans = (
      plansQuery.data?.length ? plansQuery.data : fallbackBillingPlans
    ).filter((plan) =>
      [
        "artist_free",
        "fan_free",
        "soundkit_premium_artist",
        "soundkit_premium_fan",
      ].includes(plan.code)
    ),
    visiblePlans = [
      plans.find((plan) => plan.code === `${accountType}_free`),
      plans.find(
        (plan) => plan.code === premiumPlanCodeForAccount(accountType)
      ),
    ].filter((plan): plan is NonNullable<typeof plan> => Boolean(plan)),
    handlePlan = async (code: string) => {
      if (!me?.user) {
        window.location.assign("/signup");
        return;
      }
      if (!code.startsWith("soundkit_premium_")) {
        window.location.assign(accountType === "artist" ? "/dashboard" : "/");
        return;
      }
      try {
        const { origin } = window.location,
          result = await checkout.mutateAsync({
            cancelUrl: `${origin}/pricing`,
            customerType: "organization",
            planCode: code,
            successUrl: `${origin}${premiumSuccessPathForAccount(accountType)}?upgraded=1`,
          });
        if (result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
        setMessage(
          "Premium checkout is not configured yet. You can keep using Free."
        );
      } catch {
        setMessage("We could not open Premium checkout. Please try again.");
      }
    };

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 md:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <Badge variant="outline">Simple plans. Direct artist support.</Badge>
        <h1 className="mt-5 text-4xl font-black md:text-6xl">
          Choose your SoundKit plan
        </h1>
        <p className="mt-5 text-muted-foreground">
          Free gives you one account. Premium adds the full experience and up to
          five total accounts or seats.
        </p>
      </div>
      {plansQuery.isLoading ? (
        <p className="text-center text-sm text-muted-foreground">
          Loading current plans…
        </p>
      ) : (visiblePlans.length === 0 ? (
        <p className="text-center text-sm text-destructive">
          Plans are temporarily unavailable.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {visiblePlans.map((plan) => (
            <PlanSelectionCard
              description={
                descriptions[plan.code as keyof typeof descriptions] ??
                "SoundKit access for your account."
              }
              key={plan.code}
              onSelect={() => void handlePlan(plan.code)}
              plan={{ ...plan, maxSeats: plan.maxSeats ?? 1 }}
              selected={plan.code.startsWith("soundkit_premium_")}
            />
          ))}
        </div>
      ))}
      {message ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </main>
  );
}
