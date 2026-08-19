import { usePostHog } from "@posthog/react";
import {
  createFileRoute,
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { ArrowLeft, Mic, Users } from "lucide-react";
import { useEffect } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signupRedirectForUser } from "@/lib/onboarding-flow";
import { useMeQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const router = useRouter(),
    posthog = usePostHog(),
    { data: me } = useMeQuery(),
    pathname = useRouterState({
      select: (state) => state.location.pathname,
    }),
    isSignupIndex =
      pathname === Route.fullPath || pathname === `${Route.fullPath}/`;

  useEffect(() => {
    if (!me?.user) {
      return;
    }

    void router.navigate({
      to: signupRedirectForUser({
        accountType: me.user.accountType,
        user: me.user,
      }),
    });
  }, [me, router]);

  if (!isSignupIndex) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to home</span>
          </Link>
          <h1 className="mb-4 text-3xl font-bold font-notable">
            Join SoundKit
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose how you want to use the platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            onClick={() =>
              posthog.capture("signup_type_selected", {
                account_type: "artist",
              })
            }
            to="/signup/artist/credentials"
            className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                  Continue as Artist
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link
            onClick={() =>
              posthog.capture("signup_type_selected", { account_type: "fan" })
            }
            to="/signup/fan/credentials"
            className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                  Continue as Fan
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              search={{ redirect: "/dashboard" }}
              to="/login"
              className="text-primary hover:text-primary/80 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
