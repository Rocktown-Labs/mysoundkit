"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { LogIn, Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export interface QueuedBattleNotice {
  battleId: string;
  startsAt: string | null;
  status: string;
  title: string;
}

const offerKeyForBattle = (battle: QueuedBattleNotice) =>
  `${battle.battleId}:${battle.status}`;

const fetchQueuedBattles = async (): Promise<QueuedBattleNotice[]> => {
  const response = await fetch(`${API_V1_URL}/live/rooms/queue`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Unable to load queued battles: ${response.status}`);
  }

  const payload = (await response.json()) as {
    battles: QueuedBattleNotice[];
  };
  return payload.battles;
};

export const isBattlePagePath = (pathname: string, battleId: string) =>
  pathname === `/live/battles/${battleId}`;

export function BattleQueueCta() {
  const router = useRouter(),
    pathname = useRouterState({ select: (state) => state.location.pathname }),
    { data: session, isPending: isSessionPending } = authClient.useSession(),
    userId = session?.user?.id,
    query = useQuery({
      enabled: Boolean(userId),
      queryFn: fetchQueuedBattles,
      queryKey: ["live", "rooms", "queue"],
      refetchInterval: 30_000,
    }),
    queuedBattles = query.data ?? [],
    liveQueuedBattles = queuedBattles.filter(
      (battle) => battle.status === "live"
    ),
    [singleLiveBattle] = liveQueuedBattles,
    isSingleBattleOnPage =
      liveQueuedBattles.length === 1 &&
      isBattlePagePath(pathname, singleLiveBattle?.battleId ?? ""),
    shouldShowModal = liveQueuedBattles.length > 0 && !isSingleBattleOnPage,
    offeredOffers = useRef<Set<string>>(new Set()),
    [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSessionPending || !userId) {
      return;
    }

    const remainingIds = new Set(liveQueuedBattles.map(({ battleId }) => battleId)),
      staleOffers = [...offeredOffers.current].filter((key) => {
        const [battleId] = key.split(":");
        return !remainingIds.has(battleId ?? "");
      });

    if (staleOffers.length > 0) {
      for (const key of staleOffers) {
        offeredOffers.current.delete(key);
      }
    }

    const newOffers = liveQueuedBattles.filter(
      (battle) => !offeredOffers.current.has(offerKeyForBattle(battle))
    );

    if (newOffers.length === 0) {
      return;
    }

    for (const battle of newOffers) {
      offeredOffers.current.add(offerKeyForBattle(battle));
    }

    if (!shouldShowModal) {
      return;
    }

    for (const battle of newOffers) {
      toast({
        description: `${battle.title} is live now.`,
        title: "The battle you queued for is live",
      });
    }
    setOpen(true);
  }, [isSessionPending, liveQueuedBattles, shouldShowModal, userId]);

  if (!shouldShowModal) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="size-5 text-primary" />
            A battle you queued for is live
          </DialogTitle>
          <DialogDescription>
            Join now to stop being on the sideline. You can hop right into the
            arena.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {liveQueuedBattles.map((battle) => (
            <Button
              key={battle.battleId}
              className="flex h-auto w-full items-center justify-between gap-3 py-3 text-left"
              onClick={() => {
                setOpen(false);
                void router.navigate({
                  params: { id: battle.battleId },
                  to: "/live/battles/$id",
                });
              }}
              variant="outline"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{battle.title}</p>
                <p className="text-xs text-muted-foreground">
                  {liveQueuedBattles.length > 1
                    ? "Choose this battle to enter"
                    : "The arena is open"}
                </p>
              </div>
              <LogIn className="size-4 shrink-0 text-primary" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}