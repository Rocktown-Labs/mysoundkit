import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { RequiredFieldLabel } from "@/components/onboarding/required-field-label";
import { API_V1_URL } from "@/lib/api";

export type UsernameAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "reserved"
  | "invalid"
  | "error";

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/u,
  normalizeUsername = (value: string) =>
    value.trim().replace(/^@/u, "").toLowerCase().replaceAll(/\s+/gu, "");

export function UsernameField({
  onChange,
  onStatusChange,
  value,
}: {
  onChange: (value: string) => void;
  onStatusChange?: (status: UsernameAvailabilityStatus) => void;
  value: string;
}) {
  const [status, setStatus] = useState<UsernameAvailabilityStatus>("idle"),
    [message, setMessage] = useState(""),
    requestIdRef = useRef(0),
    normalized = normalizeUsername(value),
    setAvailability = (
      nextStatus: UsernameAvailabilityStatus,
      nextMessage: string
    ) => {
      setStatus(nextStatus);
      setMessage(nextMessage);
      onStatusChange?.(nextStatus);
    },
    checkAvailability = useAsyncDebouncedCallback(
      async (username: string, requestId: number) => {
        try {
          const response = await fetch(
              `${API_V1_URL}/onboarding/username-availability?username=${encodeURIComponent(username)}`,
              { credentials: "include" }
            ),
            payload = (await response.json().catch(() => null)) as {
              available?: boolean;
              message?: string;
              reason?: "available" | "reserved" | "taken";
            } | null;
          if (requestId !== requestIdRef.current) {
            return;
          }
          if (!(response.ok && payload)) {
            setAvailability(
              "error",
              "Could not check that username right now."
            );
            return;
          }
          setAvailability(
            payload.available
              ? "available"
              : (payload.reason === "reserved"
                ? "reserved"
                : "taken"),
            payload.message ?? "That username is not available."
          );
        } catch {
          if (requestId === requestIdRef.current) {
            setAvailability(
              "error",
              "Could not check that username right now."
            );
          }
        }
      },
      { wait: 400 }
    );

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!normalized) {
      setAvailability("idle", "");
      return;
    }
    if (!USERNAME_PATTERN.test(normalized)) {
      setAvailability("invalid", "Use 3–32 letters, numbers, or underscores.");
      return;
    }
    setAvailability("checking", "Checking availability…");
    void checkAvailability(normalized, requestId);
  }, [checkAvailability, normalized]);

  const statusClass =
    status === "available"
      ? "text-emerald-400"
      : (status === "idle" || status === "checking"
        ? "text-muted-foreground"
        : "text-destructive");

  return (
    <div className="space-y-2">
      <RequiredFieldLabel htmlFor="onboarding-username">
        Username
      </RequiredFieldLabel>
      <Input
        aria-describedby="onboarding-username-status"
        aria-invalid={!["idle", "checking", "available"].includes(status)}
        autoComplete="username"
        className="h-12 bg-background"
        id="onboarding-username"
        onChange={(event) => onChange(normalizeUsername(event.target.value))}
        placeholder="yourartistname"
        required
        value={value}
      />
      <p className="text-xs text-muted-foreground">
        3–32 letters, numbers, or underscores. This is how people will find you.
      </p>
      <p className={`text-xs ${statusClass}`} id="onboarding-username-status">
        {message}
      </p>
    </div>
  );
}

export { normalizeUsername };
