import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function EmailVerificationNotice() {
  const { data: session } = authClient.useSession(),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    handleSendVerification = async () => {
      if (!session?.user.email || pending) {
        return;
      }
      setPending(true);
      try {
        const result = await authClient.sendVerificationEmail({
          callbackURL: `${window.location.origin}/library/settings`,
          email: session.user.email,
        });
        setMessage(
          result.error
            ? "Unable to send verification email. Try again shortly."
            : "Check your inbox for your verification link."
        );
      } catch {
        setMessage("Unable to send verification email. Try again shortly.");
      }
      setPending(false);
    };

  if (!session?.user || session.user.emailVerified) {
    return null;
  }
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p>Verify your email to confirm account ownership.</p>
      <Button disabled={pending} onClick={handleSendVerification} type="button">
        {pending ? "Sending…" : "Send verification email"}
      </Button>
      <output aria-live="polite">{message}</output>
    </div>
  );
}
