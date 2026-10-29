import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

function ResetPasswordPage() {
  const router = useRouter(),
    { token } = Route.useSearch(),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [error, setError] = useState<string | null>(null),
    [isSubmitting, setIsSubmitting] = useState(false),
    handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      if (!token) {
        setError("This reset link is missing or invalid. Request a new one.");
        return;
      }
      if (password.length < 8) {
        setError("Use at least 8 characters for your password.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Check both password fields.");
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (result.error) {
          setError(
            result.error.message ?? "That reset link is no longer valid."
          );
          return;
        }
        await router.navigate({
          search: { redirect: "/dashboard" },
          to: "/login",
        });
      } catch {
        setError("That reset link is no longer valid. Request a new one.");
      } finally {
        setIsSubmitting(false);
      }
    };

  return (
    <AuthShell
      backHref="/login"
      subtitle="Choose a new password for your SoundKit account."
      title="Create a new password"
    >
      <Card className="gap-5 rounded-2xl border-[#27272A] bg-[#09090B] py-5 text-[#FAFAFA] shadow-none">
        <CardContent className="px-5">
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <p className="text-sm text-muted-foreground">
              Use at least 8 characters.
            </p>
            <PasswordField
              autoComplete="new-password"
              id="reset-password"
              minLength={8}
              onChange={setPassword}
              placeholder="At least 8 characters"
              value={password}
            />
            <PasswordField
              autoComplete="new-password"
              id="reset-confirm-password"
              minLength={8}
              label="Confirm password"
              onChange={setConfirmPassword}
              placeholder="Repeat your password"
              value={confirmPassword}
            />
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              className="h-[46px] w-full rounded-[10px] bg-[#FAFAFA] text-sm font-bold text-[#09090B] hover:bg-white/90"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Updating password…" : "Update password"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Need a new link?{" "}
            <Link
              className="font-semibold text-[#B8A3FF] hover:underline"
              to="/forgot-password"
            >
              Start again
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
