import { useEffect, useRef, useState } from "react";

import {
  getCurrentSessionUser,
  setBioAuthToken,
  SOUNDKIT_WEB_URL,
} from "@/lib/api";
import type { BioCurrentUser } from "@/lib/api";
import { isBioAuthHandoffMessage } from "@/lib/auth-handoff";

export function useBioAuthHandoff(onSignedIn: (user: BioCurrentUser) => void) {
  const onSignedInRef = useRef(onSignedIn),
    popupRef = useRef<Window | null>(null),
    [isPending, setIsPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    signIn = () => {
      setError(null);
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.focus();
        return;
      }
      const handoffUrl = new URL(
          `/auth/handoff?returnOrigin=${encodeURIComponent(window.location.origin)}`,
          SOUNDKIT_WEB_URL
        ),
        popup = window.open(
          handoffUrl.href,
          "soundkit-auth-handoff",
          "popup,width=480,height=760,resizable,scrollbars"
        );
      if (!popup) {
        setError("Allow popups for SoundKit Bio, then try signing in again.");
        return;
      }
      popupRef.current = popup;
      setIsPending(true);
    };

  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  useEffect(() => {
    let active = true;
    const receiveSession = async (event: MessageEvent<unknown>) => {
      if (
        !isBioAuthHandoffMessage(
          event,
          new URL(SOUNDKIT_WEB_URL).origin,
          popupRef.current
        )
      ) {
        return;
      }
      popupRef.current = null;
      const user = await getCurrentSessionUser(event.data.token);
      if (!active) {
        return;
      }
      setIsPending(false);
      if (user) {
        setBioAuthToken(event.data.token);
        onSignedInRef.current(user);
      } else {
        setError("Your session could not be verified. Please sign in again.");
      }
    };
    window.addEventListener("message", receiveSession);
    return () => {
      active = false;
      window.removeEventListener("message", receiveSession);
    };
  }, []);

  useEffect(() => {
    if (!isPending) {
      return;
    }
    const timer = window.setInterval(() => {
      if (popupRef.current?.closed) {
        popupRef.current = null;
        setIsPending(false);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [isPending]);

  return { error, isPending, signIn };
}
