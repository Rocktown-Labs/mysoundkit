import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

const plans = [
  {
    audience: "For listeners",
    code: "fan_free",
    features: ["Stream music", "Explore public artist content"],
    name: "Fan Free",
    price: "Free",
  },
  {
    audience: "For listeners",
    code: "soundkit_premium_fan",
    featured: true,
    features: [
      "Watch live streams, battles, and listening parties",
      "Vote in live battles and join premium chat",
      "Your Premium listening funds Creator Rewards",
      "Keep Premium if you later convert to artist",
    ],
    name: "SoundKit Premium Fan",
    price: "$22.99/month",
  },
  {
    audience: "For listeners",
    code: "fan_family",
    features: ["SoundKit Premium Fan for up to 5 accounts"],
    name: "Fan Family",
    price: "$24.99/month",
  },
  {
    audience: "For artists",
    code: "artist_free",
    features: ["Upload music", "Maintain your artist profile"],
    name: "Artist Free",
    price: "Free",
  },
  {
    audience: "For artists",
    code: "soundkit_premium_artist",
    featured: true,
    features: [
      "Upload as an artist and host live experiences",
      "$5 monthly fan-to-creator reward allocation model",
      "Sell music, receive tips, and run paid communities",
      "Analytics, statements, and payout readiness",
    ],
    name: "SoundKit Premium Artist",
    price: "$22.99/month",
  },
  {
    audience: "For artists",
    code: "artist_team",
    features: ["SoundKit Premium Artist workspace for up to 5 seats"],
    name: "Artist Team",
    price: "$24.99/month",
  },
] as const;

function PricingPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <Badge variant="outline">Simple plans. Direct artist support.</Badge>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
          Choose how you experience SoundKit
        </h1>
        <p className="mt-5 text-muted-foreground">
          Platform subscriptions unlock SoundKit features. Paid artist
          communities are separate subscriptions set by each artist.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            className={plan.featured ? "border-primary shadow-lg" : ""}
            key={plan.code}
          >
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {plan.audience}
              </p>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <p className="text-xl font-black">{plan.price}</p>
              <p className="text-sm text-muted-foreground">
                Annual option coming later
              </p>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-6">
              <ul className="space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li className="flex gap-2" key={feature}>
                    <Check className="size-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-auto"
                variant={plan.featured ? "default" : "outline"}
              >
                <Link to="/signup">Choose {plan.name}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
