import { createFileRoute } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth/auth-shell";
import { CredentialsForm } from "@/components/auth/credentials-form";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search) => ({
    redirect:
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
        ? search.redirect
        : "/dashboard",
  }),
});

function LoginPage() {
  const { redirect } = Route.useSearch();

  return (
    <AuthShell
      backHref="/"
      backLabel="Back to home"
      subtitle="Sign in to your SoundKit account."
      title="Welcome back"
    >
      <CredentialsForm mode="login" redirect={redirect} />
    </AuthShell>
  );
}
