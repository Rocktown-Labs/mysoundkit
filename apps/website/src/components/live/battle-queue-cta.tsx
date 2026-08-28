"use client";
/* eslint-disable one-var, sort-vars, react/set-state-in-effect */

import { useQuery } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { LogIn, Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

interface ParticipatingBattleNotice extends QueuedBattleNotice {
  role: "artist_a" | "artist_b";
}

interface BattleEntryResponse {
  battles?: QueuedBattleNotice[];
  participatingBattles?: ParticipatingBattleNotice[];
}

type BattleEntryKind = "artist" | "viewer";

interface BattleEntryOffer extends QueuedBattleNotice {
  entryKind: BattleEntryKind;
}

const emptyParticipatingBattles: ParticipatingBattleNotice[] = [],
  emptyQueuedBattles: QueuedBattleNotice[] = [],
  offerKeyForBattle = (battle: BattleEntryOffer) =>
    `${battle.entryKind}:${battle.battleId}:${battle.status}`,
  fetchBattleEntryNotices = async (): Promise<BattleEntryResponse> => {
    const response = await fetch(`${API_V1_URL}/live/rooms/queue`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Unable to load live battle notices: ${response.status}`);
    }

    return (await response.json()) as BattleEntryResponse;
  };

export const isBattlePagePath = (pathname: string, battleId: string) =>
  pathname === `/live/battles/${battleId}` ||
  pathname === `/dashboard/live/battles/join/${battleId}/artistview`;

export function BattleQueueCta() {
  const router = useRouter(),
    pathname = useRouterState({ select: (state) => state.location.pathname }),
    { data: session, isPending: isSessionPending } = authClient.useSession(),
    userId = session?.user?.id,
    query = useQuery({
      enabled: Boolean(userId),
      queryFn: fetchBattleEntryNotices,
      queryKey: ["live", "rooms", "queue"],
      refetchInterval: 30_000,
    }),
    battleEntryResponse = query.data,
    queuedBattles = battleEntryResponse?.battles ?? emptyQueuedBattles,
    participatingBattles =
      battleEntryResponse?.participatingBattles ?? emptyParticipatingBattles,
    liveBattleOffers = useMemo(
      () => [
        ...participatingBattles
          .filter((battle) => battle.status === "live")
          .map((battle) => ({ ...battle, entryKind: "artist" as const })),
        ...queuedBattles
          .filter((battle) => battle.status === "live")
          .map((battle) => ({ ...battle, entryKind: "viewer" as const })),
      ],
      [participatingBattles, queuedBattles]
    ),
    [singleLiveBattle] = liveBattleOffers,
    isSingleBattleOnPage =
      liveBattleOffers.length === 1 &&
      isBattlePagePath(pathname, singleLiveBattle?.battleId ?? ""),
    shouldShowModal = liveBattleOffers.length > 0 && !isSingleBattleOnPage,
    offeredOffers = useRef<Set<string>>(new Set()),
    [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSessionPending || !userId) {
      return;
    }

    const remainingIds = new Set(
        liveBattleOffers.map(({ battleId }) => battleId)
      ),
      staleOffers = [...offeredOffers.current].filter((key) => {
        const [, battleId] = key.split(":");
        return !remainingIds.has(battleId ?? "");
      });

    for (const key of staleOffers) {
      offeredOffers.current.delete(key);
    }

    const newOffers = liveBattleOffers.filter(
      (battle) => !offeredOffers.current.has(offerKeyForBattle(battle))
    );

    if (newOffers.length === 0) {
      return;
    }

    for (const battle of newOffers) {
      offeredOffers.current.add(offerKeyForBattle(battle));
      toast({
        description:
          battle.entryKind === "artist"
            ? `${battle.title} is live. Enter the artist room to compete.`
            : `${battle.title} is live now. Join the audience queue.`,
        title:
          battle.entryKind === "artist"
            ? "Your battle is live"
            : "The battle you queued for is live",
      });
    }

    if (shouldShowModal) {
      setOpen(true);
    }
  }, [isSessionPending, liveBattleOffers, shouldShowModal, userId]);

  if (!shouldShowModal) {
    return null;
  }

  const hasArtistBattle = liveBattleOffers.some(
    (battle) => battle.entryKind === "artist"
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="size-5 text-primary" />
            {hasArtistBattle
              ? "Your live battle is ready"
              : "A live battle is ready"}
          </DialogTitle>
          <DialogDescription>
            {hasArtistBattle
              ? "Enter your artist room to compete, or join another battle as a viewer."
              : "Join the live arena and watch the battle you queued for."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {liveBattleOffers.map((battle) => (
            <Button
              key={offerKeyForBattle(battle)}
              className="flex h-auto w-full items-center justify-between gap-3 py-3 text-left"
              onClick={() => {
                setOpen(false);
                if (battle.entryKind === "artist") {
                  void router.navigate({
                    params: { roomId: battle.battleId },
                    to: "/dashboard/live/battles/join/$roomId/artistview",
                  });
                  return;
                }

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
                  {battle.entryKind === "artist"
                    ? "Enter artist room"
                    : "Join as viewer"}
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
