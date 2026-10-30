import { useEffect, useState } from "react";

import { useBioAuthHandoff } from "@/hooks/use-bio-auth-handoff";
import { API_V1_URL } from "@/lib/api";
import type { BioCurrentUser } from "@/lib/api";

export function BioGoogleAuthButton({
  onSignedIn,
}: {
  onSignedIn: (user: BioCurrentUser) => void;
}) {
  const { error, isPending, signIn } = useBioAuthHandoff(onSignedIn),
    [available, setAvailable] = useState(false);

  useEffect(() => {
    const checkAvailability = async () => {
        try {
          const response = await fetch(`${API_V1_URL}/auth/capabilities`, {
            signal: controller.signal,
          });
          if (response.ok) {
            const data: unknown = await response.json();
            if (
              !controller.signal.aborted &&
              typeof data === "object" &&
              data !== null &&
              "google" in data
            ) {
              setAvailable(data.google === true);
            }
          }
        } catch {
          // Email signup remains available when provider discovery is unavailable.
        }
      },
      controller = new AbortController();
    void checkAvailability();
    return () => controller.abort();
  }, []);

  if (!available) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        disabled={isPending}
        onClick={signIn}
        type="button"
      >
        <svg aria-hidden="true" className="mr-3 size-5" viewBox="0 0 24 24">
          <path
            d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z"
            fill="#4285F4"
          />
          <path
            d="M12 21.63c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.63Z"
            fill="#34A853"
          />
          <path
            d="M6.53 13.71a5.86 5.86 0 0 1 0-3.42V7.76H3.28a9.75 9.75 0 0 0 0 8.48l3.25-2.53Z"
            fill="#FBBC05"
          />
          <path
            d="M12 6.26c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.36 14.63 2.37 12 2.37a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 7.98 9.46 6.26 12 6.26Z"
            fill="#EA4335"
          />
        </svg>
        {isPending ? "Finish signing in in the popup…" : "Continue with Google"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
