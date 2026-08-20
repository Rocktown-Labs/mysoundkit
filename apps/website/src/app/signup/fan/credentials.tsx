import { createFileRoute } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth/auth-shell";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { redirectAuthedSignupUser } from "@/lib/soundkit.functions";

export const Route = createFileRoute("/signup/fan/credentials")({
  beforeLoad: () => redirectAuthedSignupUser({ data: { accountType: "fan" } }),
  component: FanCredentialsPage,
});

function FanCredentialsPage() {
  return (
    <AuthShell
      subtitle="Create a listener account and make SoundKit yours."
      title="Create Fan Account"
    >
      <CredentialsForm accountType="fan" />
    </AuthShell>
  );
}
