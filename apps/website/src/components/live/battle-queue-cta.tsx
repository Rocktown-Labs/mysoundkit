"use client";
/* eslint-disable one-var, sort-vars, react/set-state-in-effect */

import { useQuery } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { Headphones, LogIn, Swords } from "lucide-react";
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
import { useMyLiveExperiencesQuery } from "@/lib/soundkit-api-hooks";

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
  offerKeyForParty = (partyId: string, status: string) =>
    `party:${partyId}:${status}`,
  fetchBattleEntryNotices = async (): Promise<BattleEntryResponse> => {
    const response = await fetch(`${API_V1_URL}/live/rooms/queue`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Unable to load live battle notices: ${response.status}`);
    }

    return (await response.json()) as BattleEntryResponse;
  },
  getLiveRoomDialogCopy = ({
    hasArtistBattle,
    hasHostedParty,
  }: {
    hasArtistBattle: boolean;
    hasHostedParty: boolean;
  }) => {
    if (hasArtistBattle && hasHostedParty) {
      return {
        description:
          "Enter your artist room to compete, or open your hosted listening party.",
        title: "Your live rooms are ready",
      };
    }

    if (hasArtistBattle) {
      return {
        description: "Enter your artist room to compete.",
        title: "Your live battle is ready",
      };
    }

    if (hasHostedParty) {
      return {
        description:
          "Open your hosted listening party to join the live conversation.",
        title: "Your listening party is ready",
      };
    }

    return {
      description: "Join the live arena and watch the battle you queued for.",
      title: "A live battle is ready",
    };
  };

export const isBattlePagePath = (pathname: string, battleId: string) =>
  pathname === `/live/battles/${battleId}` ||
  pathname === `/dashboard/live/battles/join/${battleId}/artistview`;

export const isListeningPartyPagePath = (pathname: string, partyId: string) =>
  pathname === `/live/parties/${partyId}` ||
  pathname === `/dashboard/live/parties/join/${partyId}/artistview`;

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
    myExperiencesQuery = useMyLiveExperiencesQuery(Boolean(userId)),
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
    liveOwnedParties = useMemo(
      () =>
        (myExperiencesQuery.data ?? []).filter(
          (experience) =>
            experience.kind === "party" && experience.status === "live"
        ),
      [myExperiencesQuery.data]
    ),
    [singleLiveBattle] = liveBattleOffers,
    [singleLiveParty] = liveOwnedParties,
    isSingleBattleOnPage =
      liveBattleOffers.length === 1 &&
      isBattlePagePath(pathname, singleLiveBattle?.battleId ?? ""),
    isSinglePartyOnPage =
      liveOwnedParties.length === 1 &&
      isListeningPartyPagePath(pathname, singleLiveParty?.id ?? ""),
    shouldShowModal =
      (liveBattleOffers.length > 0 && !isSingleBattleOnPage) ||
      (liveOwnedParties.length > 0 && !isSinglePartyOnPage),
    offeredOffers = useRef<Set<string>>(new Set()),
    [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSessionPending || !userId) {
      return;
    }

    const liveOfferKeys = new Set([
        ...liveBattleOffers.map(offerKeyForBattle),
        ...liveOwnedParties.map((party) =>
          offerKeyForParty(party.id, party.status)
        ),
      ]),
      staleOffers = [...offeredOffers.current].filter(
        (key) => !liveOfferKeys.has(key)
      );

    for (const key of staleOffers) {
      offeredOffers.current.delete(key);
    }

    const newBattleOffers = liveBattleOffers.filter(
        (battle) => !offeredOffers.current.has(offerKeyForBattle(battle))
      ),
      newPartyOffers = liveOwnedParties.filter(
        (party) =>
          !offeredOffers.current.has(offerKeyForParty(party.id, party.status))
      ),
      newOffers = [...newBattleOffers, ...newPartyOffers];

    if (newOffers.length === 0) {
      return;
    }

    for (const battle of newBattleOffers) {
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
    for (const party of newPartyOffers) {
      offeredOffers.current.add(offerKeyForParty(party.id, party.status));
      toast({
        description: `${party.title} is live now.`,
        title: "Your listening party is live",
      });
    }

    if (shouldShowModal) {
      setOpen(true);
    }
  }, [
    isSessionPending,
    liveBattleOffers,
    liveOwnedParties,
    shouldShowModal,
    userId,
  ]);

  if (!shouldShowModal) {
    return null;
  }

  const hasArtistBattle = liveBattleOffers.some(
      (battle) => battle.entryKind === "artist"
    ),
    hasHostedParty = liveOwnedParties.length > 0,
    { description: dialogDescription, title: dialogTitle } =
      getLiveRoomDialogCopy({ hasArtistBattle, hasHostedParty });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="size-5 text-primary" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
          {liveOwnedParties.map((party) => (
            <Button
              key={offerKeyForParty(party.id, party.status)}
              className="flex h-auto w-full items-center justify-between gap-3 py-3 text-left"
              onClick={() => {
                setOpen(false);
                void router.navigate({
                  params: { roomId: party.id },
                  to: "/dashboard/live/parties/join/$roomId/artistview",
                });
              }}
              variant="outline"
            >
              <div className="flex min-w-0 items-start gap-2">
                <Headphones className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {party.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your listening party is live
                  </p>
                </div>
              </div>
              <LogIn className="size-4 shrink-0 text-primary" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
