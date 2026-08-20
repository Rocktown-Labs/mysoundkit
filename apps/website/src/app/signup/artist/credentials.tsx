import { createFileRoute } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth/auth-shell";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { redirectAuthedSignupUser } from "@/lib/soundkit.functions";

export const Route = createFileRoute("/signup/artist/credentials")({
  beforeLoad: () =>
    redirectAuthedSignupUser({ data: { accountType: "artist" } }),
  component: ArtistCredentialsPage,
});

function ArtistCredentialsPage() {
  return (
    <AuthShell
      subtitle="Create an independent creator account and finish your profile."
      title="Create Artist Account"
    >
      <CredentialsForm accountType="artist" />
    </AuthShell>
  );
}
