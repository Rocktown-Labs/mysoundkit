import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Check, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const pricingText = {
  checkoutAlreadySet: "Your account is already set for this plan.",
  checkoutOpening: "Opening Checkout...",
  checkoutSetupRequired:
    "Premium checkout is being connected. Your account can keep using Free while billing is finished.",
  checkoutUnavailable:
    "We could not open checkout right now. Please try again in a moment.",
  enterpriseAction: "Request Enterprise Access",
  heroBadge: "Simple plans. Direct artist support.",
  heroBody:
    "One free plan, one Premium plan, and an enterprise path for signed artists, labels, and larger teams.",
  heroTitle: "Choose how you experience SoundKit",
  premiumAction: "Upgrade to Premium",
  premiumDescription:
    "Premium follows you whether you listen as a fan or create as an artist, with three included accounts on one plan.",
  signedInAccount: (accountType: string | undefined) =>
    `Signed in as a ${accountType ?? "user"} account.`,
  startFree: "Start Free",
  startPremium: "Start Premium",
} as const,

 freeFeatures = [
  "Stream music and explore public SoundKit releases",
  "Save tracks, build playlists, and follow artists",
  "Artist accounts can upload music and maintain a public profile",
] as const,

 premiumFeatures = [
  "Watch live streams, battles, and listening parties",
  "Vote in live battles and join premium chat",
  "Host live experiences and sell music as an artist",
  `Add up to ${PREMIUM_INCLUDED_SEATS} accounts on one Premium plan`,
  "Keep Premium if you move between fan and artist accounts",
] as const,

 enterpriseFeatures = [
  "Label, signed artist, and large team onboarding",
  "Custom support for catalog migrations and releases",
  "Premium workspace planning before launch",
] as const,

 enterpriseHref =
  "mailto:enterprise@mysoundkit.com?subject=SoundKit%20Enterprise";

interface PlanCardContent {
  description: string;
  features: readonly string[];
  icon: LucideIcon;
  label: string;
  price: string;
  title: string;
}

const freePlan: PlanCardContent = {
  description: "Fan or artist accounts can start here.",
  features: freeFeatures,
  icon: Users,
  label: "Free",
  price: "Free",
  title: "SoundKit Free",
},

 premiumPlan: PlanCardContent = {
  description: pricingText.premiumDescription,
  features: premiumFeatures,
  icon: Sparkles,
  label: "Premium",
  price: "$22.99/month",
  title: "SoundKit Premium",
},

 enterprisePlan: PlanCardContent = {
  description:
    "A holding lane for major labels, signed artists, and larger teams.",
  features: enterpriseFeatures,
  icon: Building2,
  label: "Enterprise",
  price: "Contact us",
  title: "Labels & Signed Artists",
};

function PricingPage() {
  const { data: me } = useMeQuery(),
   checkout = useBillingCheckoutMutation(),
   [checkoutMessage, setCheckoutMessage] = useState(""),
   accountType = me?.user.accountType,
   isSignedIn = Boolean(me?.user),
   accountHomePath = accountHomePathForAccount(accountType),
   accountHomeLabel =
    accountType === "artist" ? "Go to Dashboard" : "Go to Library",

   startPremiumCheckout = async () => {
    if (!me?.user) {
      return;
    }

    try {
      setCheckoutMessage("");
      const { origin } = window.location,
       response = await checkout.mutateAsync({
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
          ? pricingText.checkoutSetupRequired
          : pricingText.checkoutAlreadySet
      );
    } catch {
      setCheckoutMessage(pricingText.checkoutUnavailable);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <Badge variant="outline">{pricingText.heroBadge}</Badge>
        <h1 className="mt-5 text-4xl font-black md:text-6xl">
          {pricingText.heroTitle}
        </h1>
        <p className="mt-5 text-muted-foreground">{pricingText.heroBody}</p>
        {isSignedIn ? (
          <p className="mt-4 text-sm text-primary">
            {pricingText.signedInAccount(accountType)}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <PlanCard plan={freePlan}>
          <Button asChild variant="outline">
            <Link to={isSignedIn ? accountHomePath : "/signup"}>
              {isSignedIn ? accountHomeLabel : pricingText.startFree}
            </Link>
          </Button>
        </PlanCard>

        <PlanCard featured plan={premiumPlan}>
          {isSignedIn ? (
            <Button
              disabled={checkout.isPending}
              onClick={startPremiumCheckout}
            >
              {checkout.isPending
                ? pricingText.checkoutOpening
                : pricingText.premiumAction}
            </Button>
          ) : (
            <Button asChild>
              <Link to="/signup">{pricingText.startPremium}</Link>
            </Button>
          )}
          {checkoutMessage ? (
            <p className="text-sm text-muted-foreground">{checkoutMessage}</p>
          ) : null}
        </PlanCard>

        <PlanCard plan={enterprisePlan}>
          <Button asChild variant="outline">
            <a href={enterpriseHref}>{pricingText.enterpriseAction}</a>
          </Button>
        </PlanCard>
      </div>
    </main>
  );
}

function PlanCard({
  children,
  featured = false,
  plan,
}: {
  children: React.ReactNode;
  featured?: boolean;
  plan: PlanCardContent;
}) {
  const Icon = plan.icon,
   cardClassName = featured
    ? "flex h-full flex-col rounded-lg border border-primary bg-card text-card-foreground shadow-lg"
    : "flex h-full flex-col rounded-lg border bg-card text-card-foreground shadow-sm";

  return (
    <section className={cardClassName}>
      <div className="p-6">
        <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon size={20} />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {plan.label}
        </p>
        <h2 className="text-2xl font-semibold leading-none tracking-tight">
          {plan.title}
        </h2>
        <p className="text-2xl font-black">{plan.price}</p>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </div>
      <div className="flex h-full flex-col gap-6 p-6 pt-0">
        <FeatureList features={plan.features} />
        <div className="mt-auto flex flex-col gap-3">{children}</div>
      </div>
    </section>
  );
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul className="space-y-3 text-sm">
      {features.map((feature) => (
        <li className="flex gap-2" key={feature}>
          <span className="shrink-0 text-primary">
            <Check size={16} />
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
