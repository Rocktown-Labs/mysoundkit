/* eslint-disable no-use-before-define, react-perf/jsx-no-new-function-as-prop */
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { SoundKitBrand } from "@/components/soundkit-brand";
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
import { authClient } from "@/lib/auth-client";
import { redirectAuthedSignupUser } from "@/lib/soundkit.functions";

export const Route = createFileRoute("/signup/artist/credentials")({
  beforeLoad: () =>
    redirectAuthedSignupUser({ data: { accountType: "artist" } }),
  component: ArtistCredentialsPage,
});

function ArtistCredentialsPage() {
  const [authMethod, setAuthMethod] = useState<"email" | "oauth" | null>(null);
  const router = useRouter();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  const handleEmailSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.signUp.email({
        email,
        name: email.split("@")[0] ?? "Artist",
        password,
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? "Unable to create account.");
        return;
      }

      await router.navigate({ to: "/signup/artist/onboarding" });
    } catch {
      setErrorMessage("Unable to reach SoundKit. Check your API credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <SoundKitBrand
            className="mb-4"
            variant="wordmark"
            wordmarkClassName="h-12"
          />
          <h1 className="text-2xl font-bold mb-2">Create Artist Account</h1>
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
              {["Google", "Spotify", "Apple"].map((provider) => (
                <Button
                  key={provider}
                  variant="outline"
                  className="w-full justify-start h-12 bg-transparent"
                  size="lg"
                  disabled
                >
                  <AppImage
                    src="/placeholder.svg?height=24&width=24"
                    alt={provider}
                    width={24}
                    height={24}
                    layout="fixed"
                    className="mr-3"
                  />
                  {provider} setup required
                </Button>
              ))}
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
              <form className="space-y-4" onSubmit={handleEmailSignup}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    autoComplete="email"
                    type="email"
                    placeholder="artist@example.com"
                    className="bg-input/50 border-border/60 focus:border-primary"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    autoComplete="new-password"
                    type="password"
                    placeholder="Create a strong password"
                    className="bg-input/50 border-border/60 focus:border-primary"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    autoComplete="new-password"
                    type="password"
                    placeholder="Confirm your password"
                    className="bg-input/50 border-border/60 focus:border-primary"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
                {errorMessage && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </p>
                )}
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isSubmitting}
                  size="lg"
                  type="submit"
                >
                  {isSubmitting ? "Creating account..." : "Continue"}
                </Button>
              </form>
            )}

            <div className="text-center text-xs text-muted-foreground mt-4">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-primary hover:underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>
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
