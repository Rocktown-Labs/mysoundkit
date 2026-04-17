import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/signup/fan/credentials")({
  component: FanCredentialsPage,
});

function FanCredentialsPage() {
  const [authMethod, setAuthMethod] = useState<"email" | "oauth" | null>(null);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link
            to="/signup"
            className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Music className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold font-notable">SoundKit</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Create Fan Account</h1>
          <p className="text-muted-foreground">
            Choose how you want to sign up
          </p>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign Up Method</CardTitle>
            <CardDescription>
              Select your preferred authentication method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OAuth Options */}
            <div className="space-y-3">
              <Link to="/signup/fan/onboarding">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 bg-transparent"
                  size="lg"
                >
                  <AppImage
                    src="/placeholder.svg?height=24&width=24"
                    alt="Google"
                    width={24}
                    height={24}
                    layout="fixed"
                    className="mr-3"
                  />
                  Continue with Google
                </Button>
              </Link>
              <Link to="/signup/fan/onboarding">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 bg-transparent"
                  size="lg"
                >
                  <AppImage
                    src="/placeholder.svg?height=24&width=24"
                    alt="Spotify"
                    width={24}
                    height={24}
                    layout="fixed"
                    className="mr-3"
                  />
                  Continue with Spotify
                </Button>
              </Link>
              <Link to="/signup/fan/onboarding">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 bg-transparent"
                  size="lg"
                >
                  <AppImage
                    src="/placeholder.svg?height=24&width=24"
                    alt="Apple"
                    width={24}
                    height={24}
                    layout="fixed"
                    className="mr-3"
                  />
                  Continue with Apple
                </Button>
              </Link>
            </div>

            <Separator className="my-6">
              <span className="px-2 bg-card text-muted-foreground text-sm">
                or
              </span>
            </Separator>

            {/* Email/Password Form */}
            {!authMethod && (
              <Button
                onClick={() => setAuthMethod("email")}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Mail className="mr-2 size-5" />
                Sign up with Email
              </Button>
            )}

            {authMethod === "email" && (
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="fan@example.com"
                    className="bg-input/50 border-border/60 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    className="bg-input/50 border-border/60 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    className="bg-input/50 border-border/60 focus:border-primary"
                  />
                </div>
                <Link to="/signup/fan/onboarding">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    size="lg"
                  >
                    Continue
                  </Button>
                </Link>
              </form>
            )}

            <div className="text-center text-xs text-muted-foreground mt-4">
              By continuing, you agree to our{" "}
              <Link to="#" className="text-primary hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="#" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
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
