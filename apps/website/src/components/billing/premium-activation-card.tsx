import { usePostHog } from "@posthog/react";
import { useEffect, useRef, useState } from "react";

import { PremiumWorkspaceInviteCard } from "@/components/billing/premium-workspace-invite-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMeEntitlementsQuery } from "@/lib/soundkit-api-hooks";

const MAX_ACTIVATION_ATTEMPTS = 8,
  ACTIVATION_DELAYS_MS = [1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000];

export function PremiumActivationCard({
  accountType,
}: {
  accountType: "artist" | "fan";
}) {
  const posthog = usePostHog(),
    entitlements = useMeEntitlementsQuery(),
    { refetch } = entitlements,
    [attempt, setAttempt] = useState(0),
    isPremium = entitlements.data?.isPremium === true,
    isSettled = isPremium || attempt >= MAX_ACTIVATION_ATTEMPTS,
    completionCaptured = useRef(false);

  useEffect(() => {
    if (isPremium && !completionCaptured.current) {
      completionCaptured.current = true;
      posthog.capture("premium_checkout_completed", {
        account_type: accountType,
      });
    }
  }, [accountType, isPremium, posthog]);

  useEffect(() => {
    if (isSettled) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setAttempt((current) => current + 1);
        void refetch();
      },
      ACTIVATION_DELAYS_MS[attempt] ?? ACTIVATION_DELAYS_MS.at(-1)
    );

    return () => window.clearTimeout(timeout);
  }, [attempt, isSettled, refetch]);

  if (isPremium) {
    return <PremiumWorkspaceInviteCard accountType={accountType} />;
  }

  if (isSettled) {
    return (
      <Alert className="border-amber-500/40 bg-amber-500/10">
        <AlertTitle>Premium activation is still processing</AlertTitle>
        <AlertDescription>
          Your checkout was received. Refresh this page in a moment to manage
          your Premium workspace and invitations.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle>Activating SoundKit Premium…</CardTitle>
        <CardDescription>
          We&apos;re waiting for the secure billing confirmation. You don&apos;t
          need to start checkout again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Once Premium is active, you can invite people to your workspace.
        </p>
      </CardContent>
    </Card>
  );
}
