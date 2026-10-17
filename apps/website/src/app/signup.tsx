/* oxlint-disable one-var, sort-vars, complexity */
import {
  createFileRoute,
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { ArrowLeft, Mic, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { SoundKitBrand } from "@/components/soundkit-brand";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { capture } from "@/lib/analytics";
import { API_V1_URL } from "@/lib/api";
import { completeBattleShareReferral } from "@/lib/battle-share";
import {
  completedSignupRouteForAccount,
  onboardingRouteForAccount,
} from "@/lib/onboarding-flow";
import type { SignupAccountType } from "@/lib/onboarding-flow";
import { useMeQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const router = useRouter(),
    { data: me, refetch } = useMeQuery(),
    [credentialsCompleted, setCredentialsCompleted] = useState(false),
    [marketingOptIn, setMarketingOptIn] = useState(false),
    [selectingPath, setSelectingPath] = useState<SignupAccountType | null>(
      null
    ),
    pathname = useRouterState({
      select: (state) => state.location.pathname,
    }),
    isSignupIndex =
      pathname === Route.fullPath || pathname === `${Route.fullPath}/`,
    showPathChooser = credentialsCompleted || Boolean(me?.user);

  useEffect(() => {
    if (!me?.user?.onboardingCompletedAt) {
      return;
    }

    void router.navigate({
      to: completedSignupRouteForAccount(me.user.accountType ?? "fan"),
    });
  }, [me, router]);

  if (!isSignupIndex) {
    return <Outlet />;
  }

  const handleChoosePath = async (accountType: SignupAccountType) => {
    setSelectingPath(accountType);
    capture("signup_type_selected", {
      account_type: accountType,
    });
    try {
      await fetch(`${API_V1_URL}/onboarding/state`, {
        body: JSON.stringify({
          currentStep: 1,
          intendedAccountType: accountType,
          marketingOptIn,
          marketingOptInSource: "credentials",
          marketingOptInVersion: "2026-01",
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (accountType === "fan") {
        await completeBattleShareReferral();
      }
    } catch {
      // Best-effort onboarding intent persistence.
    }
    await router.navigate({
      to: onboardingRouteForAccount(accountType),
    });
  };

  if (!showPathChooser) {
    return (
      <AuthShell
        backHref="/"
        backLabel="Back to home"
        subtitle="Create your free account first, then choose how you want to use SoundKit."
        title="Join SoundKit"
      >
        <CredentialsForm
          mode="signup"
          onSignupSuccess={(options) => {
            setMarketingOptIn(options.marketingOptIn);
            setCredentialsCompleted(true);
            void refetch();
          }}
        />
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              className="font-medium text-primary hover:text-primary/80"
              search={{ redirect: "/dashboard" }}
              to="/login"
            >
              Sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to home</span>
          </Link>
          <SoundKitBrand
            className="mx-auto mb-6 justify-center"
            variant="wordmark"
            wordmarkClassName="mx-auto h-11"
          />
          <h1 className="mb-4 text-3xl font-bold font-notable">
            Choose Your Path
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose how you want to use the platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            aria-label="Continue as Artist"
            disabled={selectingPath !== null}
            onClick={() => {
              void handleChoosePath("artist");
            }}
            type="button"
            className="group block w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card className="h-full hover:border-primary transition-all cursor-pointer">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Mic className="size-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">I&apos;m an Artist</CardTitle>
                <CardDescription className="text-base">
                  Release music, build your audience, perform live, battle other
                  artists, and earn directly on SoundKit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Upload and release your music
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Sell music and earn Creator
                    Rewards
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Battle and stream live
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Build a direct fan community
                  </li>
                  <li className="pt-2 text-xs text-muted-foreground">
                    Built for independent musicians and producers.
                  </li>
                </ul>
                <span
                  className={buttonVariants({
                    className: "w-full mt-6",
                    size: "lg",
                  })}
                >
                  {selectingPath === "artist"
                    ? "Continuing…"
                    : "Continue as Artist"}
                </span>
              </CardContent>
            </Card>
          </button>

          <button
            aria-label="Continue as Fan"
            disabled={selectingPath !== null}
            onClick={() => {
              void handleChoosePath("fan");
            }}
            type="button"
            className="group block w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card className="h-full hover:border-primary transition-all cursor-pointer">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Users className="size-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">I&apos;m a Fan</CardTitle>
                <CardDescription className="text-base">
                  Discover new music, support artists, and build your library
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Discover public SoundKit
                    releases
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Follow artists and build your
                    library
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Create playlists and save
                    tracks
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span>Purchase music and support
                    artists
                  </li>
                </ul>
                <span
                  className={buttonVariants({
                    className: "w-full mt-6",
                    size: "lg",
                  })}
                >
                  {selectingPath === "fan" ? "Continuing…" : "Continue as Fan"}
                </span>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}
