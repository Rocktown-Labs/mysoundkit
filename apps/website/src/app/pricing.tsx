import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Check, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PREMIUM_INCLUDED_SEATS,
  accountHomePathForAccount,
  premiumPlanCodeForAccount,
  premiumSuccessPathForAccount,
} from "@/lib/pricing-flow";
import {
  useBillingCheckoutMutation,
  useMeQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

const freeFeatures = [
  "Stream music and explore public SoundKit releases",
  "Save tracks, build playlists, and follow artists",
  "Artist accounts can upload music and maintain a public profile",
] as const;

const premiumFeatures = [
  "Watch live streams, battles, and listening parties",
  "Vote in live battles and join premium chat",
  "Host live experiences and sell music as an artist",
  `Add up to ${PREMIUM_INCLUDED_SEATS} accounts on one Premium plan`,
  "Keep Premium if you move between fan and artist accounts",
] as const;

const enterpriseFeatures = [
  "Label, signed artist, and large team onboarding",
  "Custom support for catalog migrations and releases",
  "Premium workspace planning before launch",
] as const;

const enterpriseHref =
  "mailto:enterprise@mysoundkit.com?subject=SoundKit%20Enterprise";
const premiumDescription =
  "Premium follows you whether you listen as a fan or create as an artist, with three included accounts on one plan.";

function PricingPage() {
  const { data: me } = useMeQuery();
  const checkout = useBillingCheckoutMutation();
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const accountType = me?.user.accountType;
  const isSignedIn = Boolean(me?.user);
  const accountHomePath = accountHomePathForAccount(accountType);
  const accountHomeLabel =
    accountType === "artist" ? "Go to Dashboard" : "Go to Library";

  const startPremiumCheckout = async () => {
    if (!me?.user) {
      return;
    }

    try {
      setCheckoutMessage("");
      const { origin } = window.location;
      const response = await checkout.mutateAsync({
        cancelUrl: `${origin}/pricing`,
        planCode: premiumPlanCodeForAccount(me.user.accountType),
        successUrl: `${origin}${premiumSuccessPathForAccount(
          me.user.accountType
        )}?upgraded=1`,
      });

      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }

      setCheckoutMessage(
        response.setupRequired
          ? "Premium checkout is being connected. Your account can keep using Free while billing is finished."
          : "Your account is already set for this plan."
      );
    } catch {
      setCheckoutMessage(
        "We could not open checkout right now. Please try again in a moment."
      );
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <Badge variant="outline">Simple plans. Direct artist support.</Badge>
        <h1 className="mt-5 text-4xl font-black md:text-6xl">
          Choose how you experience SoundKit
        </h1>
        <p className="mt-5 text-muted-foreground">
          One free plan, one Premium plan, and an enterprise path for signed
          artists, labels, and larger teams.
        </p>
        {isSignedIn ? (
          <p className="mt-4 text-sm text-primary">
            Signed in as a {accountType} account.
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Free
            </p>
            <CardTitle className="text-2xl">SoundKit Free</CardTitle>
            <p className="text-2xl font-black">Free</p>
            <p className="text-sm text-muted-foreground">
              Fan or artist accounts can start here.
            </p>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-6">
            <FeatureList features={freeFeatures} />
            <Button asChild className="mt-auto" variant="outline">
              <Link to={isSignedIn ? accountHomePath : "/signup"}>
                {isSignedIn ? accountHomeLabel : "Start Free"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary shadow-lg">
          <CardHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Premium
            </p>
            <CardTitle className="text-2xl">SoundKit Premium</CardTitle>
            <p className="text-2xl font-black">$22.99/month</p>
            <p className="text-sm text-muted-foreground">
              {premiumDescription}
            </p>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-6">
            <FeatureList features={premiumFeatures} />
            {isSignedIn ? (
              <Button
                className="mt-auto"
                disabled={checkout.isPending}
                onClick={startPremiumCheckout}
              >
                {checkout.isPending
                  ? "Opening Checkout..."
                  : "Upgrade to Premium"}
              </Button>
            ) : (
              <Button asChild className="mt-auto">
                <Link to="/signup">Start Premium</Link>
              </Button>
            )}
            {checkoutMessage ? (
              <p className="text-sm text-muted-foreground">{checkoutMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Enterprise
            </p>
            <CardTitle className="text-2xl">Labels & Signed Artists</CardTitle>
            <p className="text-2xl font-black">Contact us</p>
            <p className="text-sm text-muted-foreground">
              A holding lane for major labels, signed artists, and larger teams.
            </p>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-6">
            <FeatureList features={enterpriseFeatures} />
            <Button asChild className="mt-auto" variant="outline">
              <a href={enterpriseHref}>Request Enterprise Access</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul className="space-y-3 text-sm">
      {features.map((feature) => (
        <li className="flex gap-2" key={feature}>
          <Check className="size-4 shrink-0 text-primary" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
