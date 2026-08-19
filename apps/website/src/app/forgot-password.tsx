import { createFileRoute, Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
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
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState(""),
    [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [isSubmitting, setIsSubmitting] = useState(false),
    handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage(null);
      setError(null);
      setIsSubmitting(true);

      try {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) {
          setError(result.error.message ?? "We could not send that email.");
          return;
        }
        setMessage(
          "If an account uses that email, we sent a password reset link. Check your inbox and spam folder."
        );
      } catch {
        setError("We could not send that email. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    };

  return (
    <AuthShell
      backHref="/login"
      subtitle="We’ll help you get back into your account."
      title="Reset your password"
    >
      <Card className="border-border/60 bg-card/80 shadow-xl shadow-black/10">
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>
            Enter your email and we’ll send a secure reset link if an account
            exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                autoComplete="email"
                className="h-12 bg-background"
                id="forgot-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            {message ? (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              className="h-12 w-full"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link
              className="text-primary hover:underline"
              search={{ redirect: "/dashboard" }}
              to="/login"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
