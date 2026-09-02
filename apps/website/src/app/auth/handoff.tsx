/* eslint-disable one-var, sort-vars, react/todo */

import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { API_V1_URL } from "@/lib/api";

export const Route = createFileRoute("/auth/handoff")({
  component: AuthHandoffPage,
  validateSearch: (search: Record<string, unknown>) => ({
    returnOrigin:
      typeof search.returnOrigin === "string" ? search.returnOrigin : "",
  }),
});

type HandoffStatus = "checking" | "complete" | "failed" | "signed_out";

function HandoffStatusIcon({ status }: { status: HandoffStatus }) {
  if (status === "checking") {
    return <LoaderCircle className="size-7 animate-spin" />;
  }

  if (status === "complete") {
    return <CheckCircle2 className="size-7" />;
  }

  return <ShieldAlert className="size-7" />;
}

function AuthHandoffPage() {
  const { returnOrigin } = Route.useSearch(),
    [status, setStatus] = useState<HandoffStatus>("checking"),
    [message, setMessage] = useState("Preparing a secure sign-in handoff…");

  useEffect(() => {
    let cancelled = false;

    const sendHandoff = async () => {
      if (!returnOrigin) {
        setStatus("failed");
        setMessage("The sign-in handoff is missing its destination.");
        return;
      }

      try {
        const response = await fetch(`${API_V1_URL}/auth/handoff-token`, {
          body: JSON.stringify({ targetOrigin: returnOrigin }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (response.status === 401) {
          if (!cancelled) {
            setStatus("signed_out");
            setMessage("Sign in to SoundKit to continue.");
          }
          return;
        }

        if (!response.ok) {
          if (!cancelled) {
            setStatus("failed");
            setMessage("The handoff destination was not approved.");
          }
          return;
        }

        const payload: unknown = await response.json(),
          token =
            payload && typeof payload === "object" && "token" in payload
              ? payload.token
              : null;

        if (typeof token !== "string" || !window.opener) {
          if (!cancelled) {
            setStatus("failed");
            setMessage("Open this handoff from the SoundKit sign-in button.");
          }
          return;
        }

        window.opener.postMessage(
          { token, type: "soundkit-auth-handoff" },
          returnOrigin
        );
        setStatus("complete");
        setMessage("You are signed in. Return to your profile to continue.");
        window.setTimeout(() => window.close(), 700);
      } catch (error) {
        if (!cancelled) {
          setStatus("failed");
          setMessage(
            error instanceof Error
              ? error.message
              : "The sign-in handoff could not be completed."
          );
        }
      }
    };

    void sendHandoff();
    return () => {
      cancelled = true;
    };
  }, [returnOrigin]);

  const loginRedirect = `/auth/handoff?returnOrigin=${encodeURIComponent(returnOrigin)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <HandoffStatusIcon status={status} />
        </div>
        <p className="mt-6 font-notable text-xs uppercase tracking-[0.28em] text-muted-foreground">
          SoundKit sign-in
        </p>
        <h1 className="mt-3 font-bold text-2xl">Secure account handoff</h1>
        <p className="mt-3 text-muted-foreground text-sm">{message}</p>
        {status === "signed_out" ? (
          <Link
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground text-sm transition hover:opacity-90"
            search={{ redirect: loginRedirect }}
            to="/login"
          >
            Sign in to SoundKit
          </Link>
        ) : null}
        {status === "failed" ? (
          <Link
            className="mt-6 inline-flex rounded-full border border-border px-5 py-2.5 font-medium text-sm transition hover:bg-muted"
            to="/"
          >
            Return to SoundKit
          </Link>
        ) : null}
      </section>
    </main>
  );
}
