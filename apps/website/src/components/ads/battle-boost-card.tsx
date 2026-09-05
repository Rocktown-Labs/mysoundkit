import { Link } from "@tanstack/react-router";
import { BellPlus, Crown, Play, Swords } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { API_V1_URL } from "@/lib/api";
import { useMeEntitlementsQuery } from "@/lib/soundkit-api-hooks";

export interface BattleBoostAd {
  battle: {
    artistA: string | null;
    artistB: string | null;
    battleId: string;
    genre: string | null;
    promoCopy: string;
    queueSize: number;
    startsAt: string | null;
    status: string;
    timingLabel: string;
    title: string;
  } | null;
  campaignId: string;
  clickthroughUrl: string;
  requiresPremium: boolean;
  title: string;
  upgradeUrl: string | null;
}

interface ServeResponse {
  ad: BattleBoostAd | null;
  hasAd: boolean;
}

const fetchBoost = async (contentType: "audio" | "video") => {
  const response = await fetch(
    `${API_V1_URL}/ads/serve?placement=battle_boost&contentType=${contentType}`,
    { credentials: "include" }
  );
  if (response.status === 204 || !response.ok) {
    return null;
  }
  const payload = (await response
    .json()
    .catch(() => null)) as ServeResponse | null;
  return payload?.hasAd && payload.ad?.battle ? payload.ad : null;
};

export const useBattleBoostAd = (enabled = true) => {
  const [ad, setAd] = useState<BattleBoostAd | null>(null),
    [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      const found =
        (await fetchBoost("video").catch(() => null)) ??
        (await fetchBoost("audio").catch(() => null));
      if (!cancelled) {
        setAd(found);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ad, isLoading };
};

export function BattleBoostCard() {
  const { ad, isLoading } = useBattleBoostAd(),
    entitlementsQuery = useMeEntitlementsQuery(),
    { toast } = useToast(),
    [queueState, setQueueState] = useState<"idle" | "joining" | "queued">(
      "idle"
    ),
    [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    if (ad?.battle) {
      setQueueSize(ad.battle.queueSize);
      setQueueState("idle");
    }
  }, [ad]);

  const joinQueue = useCallback(async () => {
    if (!ad?.battle || queueState !== "idle") {
      return;
    }
    setQueueState("joining");
    try {
      const response = await fetch(
        `${API_V1_URL}/live/rooms/${encodeURIComponent(ad.battle.battleId)}/queue`,
        { credentials: "include", method: "POST" }
      );
      if (!response.ok) {
        throw new Error("Could not join the queue.");
      }
      setQueueState("queued");
      setQueueSize((size) => size + 1);
      toast({
        description: "We'll hold your spot for this battle.",
        title: "Saved for later",
      });
    } catch {
      setQueueState("idle");
      toast({
        description: "Could not join the queue. Try again.",
        title: "Queue failed",
        variant: "destructive",
      });
    }
  }, [ad, queueState, toast]);

  if (isLoading || !ad?.battle) {
    return null;
  }

  const {battle} = ad,
    isPremium = entitlementsQuery.data?.isPremium === true,
    isLive = battle.status === "live",
    showUpgrade = ad.requiresPremium && !isPremium;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Sponsored battle</Badge>
            {battle.genre && <Badge variant="outline">{battle.genre}</Badge>}
          </div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Swords className="size-5 text-primary" />
            {battle.title}
          </CardTitle>
          <CardDescription>{ad.battle.promoCopy}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{battle.timingLabel}</Badge>
        <Badge variant="outline">{queueSize} in queue</Badge>
        {showUpgrade ? (
          <Button asChild size="sm">
            <a href={ad.upgradeUrl ?? "/pricing"}>
              <Crown className="mr-2 size-4" />
              Upgrade to watch
            </a>
          </Button>
        ) : (
          <>
            {isLive ? (
              <Button asChild size="sm">
                <Link params={{ id: battle.battleId }} to="/live/battles/$id">
                  <Play className="mr-2 size-4" />
                  Watch now
                </Link>
              </Button>
            ) : (
              <Button
                disabled={queueState !== "idle"}
                onClick={() => void joinQueue()}
                size="sm"
              >
                <BellPlus className="mr-2 size-4" />
                {queueState === "queued"
                  ? "Saved — see you there"
                  : (queueState === "joining"
                    ? "Saving…"
                    : "Save for later")}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
