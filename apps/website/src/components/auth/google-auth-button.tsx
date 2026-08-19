import { usePostHog } from "@posthog/react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

const googleCapabilityQueryKey = ["auth", "capabilities"] as const;

export function GoogleAuthButton({
  accountType,
  callbackURL,
}: {
  accountType?: "artist" | "fan";
  callbackURL: string;
}) {
  const posthog = usePostHog(),
    capabilityQuery = useQuery({
      queryFn: async () => {
        const response = await fetch(`${API_V1_URL}/auth/capabilities`, {
          credentials: "include",
        });
        if (!response.ok) {
          return { google: false };
        }
        return (await response.json()) as { google: boolean };
      },
      queryKey: googleCapabilityQueryKey,
      staleTime: 5 * 60_000,
    });

  if (capabilityQuery.isLoading) {
    return (
      <Button className="h-12 w-full" disabled variant="outline">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        Checking sign-in options…
      </Button>
    );
  }

  if (!capabilityQuery.data?.google) {
    return null;
  }

  return (
    <Button
      className="h-12 w-full border-border bg-background hover:bg-accent"
      onClick={() => {
        posthog.capture("signup_method_selected", {
          account_type: accountType,
          auth_method: "google",
        });
        void authClient.signIn.social({
          callbackURL,
          newUserCallbackURL: callbackURL,
          provider: "google",
          ...(accountType
            ? { errorCallbackURL: `${callbackURL}?auth_error=1` }
            : {}),
        });
      }}
      type="button"
      variant="outline"
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
      Continue with Google
    </Button>
  );
}
