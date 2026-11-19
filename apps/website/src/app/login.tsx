import { createFileRoute } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth/auth-shell";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { sanitizeAuthRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search) => ({
    redirect: sanitizeAuthRedirect(search.redirect),
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
