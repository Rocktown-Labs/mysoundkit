"use client";
/* eslint-disable one-var, sort-vars */

import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import {
  BATTLE_RETURN_INTENT_EVENT,
  clearBattleReturnIntent,
  readBattleReturnIntent,
} from "@/lib/battle-return-intent";
import { useLiveRoom } from "@/lib/live-room";

const preStartPhases = new Set(["scheduled", "waiting_room"]);

export function BattleReturnMonitor() {
  const router = useRouter(),
    pathname = useRouterState({ select: (state) => state.location.pathname }),
    { data: session } = authClient.useSession(),
    [intent, setIntent] = useState(readBattleReturnIntent),
    activeIntent =
      intent && intent.userId === session?.user?.id ? intent : null,
    { query } = useLiveRoom(activeIntent?.battleId ?? "");

  useEffect(() => {
    const syncIntent = () => setIntent(readBattleReturnIntent());
    window.addEventListener("storage", syncIntent);
    window.addEventListener(BATTLE_RETURN_INTENT_EVENT, syncIntent);
    return () => {
      window.removeEventListener("storage", syncIntent);
      window.removeEventListener(BATTLE_RETURN_INTENT_EVENT, syncIntent);
    };
  }, []);

  useEffect(() => {
    const room = query.data,
      phase = room?.battle?.coordination?.phase,
      battleStarted = Boolean(
        phase && !preStartPhases.has(phase) && phase !== "ended"
      );

    if (!activeIntent || !room || !phase) {
      return;
    }

    if (room.status === "ended" || phase === "ended") {
      clearBattleReturnIntent(activeIntent.battleId);
      return;
    }

    if (!battleStarted) {
      return;
    }

    clearBattleReturnIntent(activeIntent.battleId);
    const targetPath = `/dashboard/live/battles/join/${encodeURIComponent(activeIntent.battleId)}/artistview`;
    if (pathname === targetPath) {
      return;
    }

    void router.navigate({
      params: { roomId: activeIntent.battleId },
      replace: true,
      to: "/dashboard/live/battles/join/$roomId/artistview",
    });
  }, [activeIntent, pathname, query.data, router]);

  return null;
}
