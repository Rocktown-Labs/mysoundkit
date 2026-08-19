import { usePostHog } from "@posthog/react";
import { Link, useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { PasswordField } from "@/components/auth/password-field";
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
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

const accountLabel = (accountType: "artist" | "fan") =>
  accountType === "artist" ? "Artist" : "Fan";

export function CredentialsForm({
  accountType,
  mode = "signup",
  redirect = "/dashboard",
}: {
  accountType?: "artist" | "fan";
  mode?: "login" | "signup";
  redirect?: string;
}) {
  const posthog = usePostHog(),
    router = useRouter(),
    isSignup = mode === "signup",
    label = accountType ? accountLabel(accountType) : "SoundKit",
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [marketingOptIn, setMarketingOptIn] = useState(false),
    [errorMessage, setErrorMessage] = useState<string | null>(null),
    [isSubmitting, setIsSubmitting] = useState(false),
    siteOrigin = typeof window === "undefined" ? "" : window.location.origin,
    callbackURL = accountType
      ? `${siteOrigin}/signup/${accountType}/onboarding?intent=${accountType}`
      : `${siteOrigin}${redirect}`,
    persistSignupIntent = async () => {
      if (!accountType) {
        return;
      }

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
    },
    handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage(null);

      if (isSignup && password.length < 8) {
        setErrorMessage("Use at least 8 characters for your password.");
        return;
      }
      if (isSignup && password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Check both password fields.");
        return;
      }

      setIsSubmitting(true);
      posthog.capture(
        isSignup ? "signup_method_selected" : "login_method_selected",
        {
          account_type: accountType,
          auth_method: "email",
        }
      );
      try {
        const result = isSignup
          ? await authClient.signUp.email({
              email,
              name: accountType === "artist" ? "Artist" : "Fan",
              password,
            })
          : await authClient.signIn.email({ email, password });

        if (result.error) {
          setErrorMessage(
            result.error.message ??
              (isSignup
                ? "Unable to create your account."
                : "Unable to sign in.")
          );
          return;
        }

        if (isSignup) {
          await persistSignupIntent();
          posthog.capture("account_created", {
            account_type: accountType,
            auth_method: "email",
            marketing_opt_in: marketingOptIn,
          });
          await router.navigate({
            to: accountType ? `/signup/${accountType}/onboarding` : "/signup",
          });
          return;
        }

        if (result.data?.user?.id) {
          posthog.identify(result.data.user.id, { account_type: accountType });
        }
        posthog.capture("user_signed_in", { method: "email" });
        await router.navigate({ to: redirect });
      } catch (error) {
        posthog.captureException(error);
        setErrorMessage("Unable to reach SoundKit. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    };

  return (
    <Card className="border-border/60 bg-card/80 shadow-xl shadow-black/10">
      <CardHeader className="space-y-2">
        <CardTitle>
          {isSignup ? `Create ${label} account` : "Sign in"}
        </CardTitle>
        <CardDescription>
          {isSignup
            ? "Start with Google or create an account with email. Setup takes a few minutes."
            : "Use your SoundKit email and password to continue."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <GoogleAuthButton accountType={accountType} callbackURL={callbackURL} />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" />
          <span>or use email</span>
          <Separator className="flex-1" />
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-email`}>Email</Label>
            <Input
              autoComplete="email"
              className="h-12 bg-background"
              id={`${mode}-email`}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <PasswordField
            autoComplete={isSignup ? "new-password" : "current-password"}
            id={`${mode}-password`}
            minLength={isSignup ? 8 : undefined}
            onChange={setPassword}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            value={password}
          />
          {isSignup ? (
            <>
              <p className="-mt-3 text-xs text-muted-foreground">
                Use at least 8 characters. A passphrase is easiest to remember.
              </p>
              <PasswordField
                autoComplete="new-password"
                id="signup-confirm-password"
                minLength={8}
                label="Confirm password"
                onChange={setConfirmPassword}
                placeholder="Repeat your password"
                value={confirmPassword}
              />
              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  checked={marketingOptIn}
                  className="mt-1 size-4 accent-primary"
                  onChange={(event) => setMarketingOptIn(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Send me SoundKit product updates, onboarding tips, and
                  occasional offers.
                </span>
              </label>
            </>
          ) : null}
          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? (isSignup
                ? "Creating your account…"
                : "Signing in…")
              : (isSignup
                ? "Continue with email"
                : "Sign in")}
          </Button>
        </form>
        {isSignup ? null : (
          <div className="text-right">
            <Link
              className="text-sm text-primary hover:underline"
              to="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
