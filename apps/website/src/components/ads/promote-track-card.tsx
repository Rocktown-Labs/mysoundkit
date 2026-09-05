import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useCreateAdCampaignMutation, useSubmitAdCampaignMutation, useTracksQuery } from '@/lib/soundkit-api-hooks';
import type { AdPlacement } from '@/lib/soundkit-api-hooks';

const PROMOTE_PLACEMENTS: AdPlacement[] = ["audio_preroll", "sponsored_queue"];

/**
 * Two-click artist promotion: pick one of your tracks, set a daily
 * budget, launch. Creative derives from the track itself (already
 * normalized), targeting defaults to US-wide, review auto-approves.
 */
export function PromoteTrackCard() {
  const tracksQuery = useTracksQuery(),
    createCampaign = useCreateAdCampaignMutation(),
    submitCampaign = useSubmitAdCampaignMutation(),
    { toast } = useToast(),
    [budgetDollars, setBudgetDollars] = useState(5),
    [placement, setPlacement] = useState<AdPlacement>("audio_preroll"),
    [launchingId, setLaunchingId] = useState<string | null>(null),
    tracks = (tracksQuery.data ?? []).slice(0, 20),

   launch = (trackId: string, title: string, streamUrl: string | null) => {
    if (!streamUrl) {
      toast({
        description:
          "This track has no playable stream yet — try once processing finishes.",
        title: "Not promotable yet",
        variant: "destructive",
      });
      return;
    }
    setLaunchingId(trackId);
    createCampaign.mutate(
      {
        allowConquest: false,
        billingType: "prepaid_wallet",
        clickthroughUrl: `${window.location.origin}/tracks/${trackId}`,
        creativeFormat: "audio",
        creativeUrl: streamUrl,
        dailyBudgetCents: Math.max(1, Math.round(budgetDollars * 100)),
        dailyImpressionCap: 1000,
        entityId: trackId,
        entityType: "track",
        name: `Promote: ${title}`,
        placement,
        targets: [{ targetCode: "US", targetType: "country" }],
      },
      {
        onError: () => {
          setLaunchingId(null);
          toast({
            description: "Could not create the promotion.",
            title: "Launch failed",
            variant: "destructive",
          });
        },
        onSuccess: (campaign) => {
          submitCampaign.mutate(campaign.id, {
            onError: () => {
              setLaunchingId(null);
              toast({
                description:
                  "Created, but submit needs another try from the campaigns list.",
                title: "Created — submit pending",
                variant: "destructive",
              });
            },
            onSuccess: (submitted) => {
              setLaunchingId(null);
              toast({
                description:
                  submitted.status === "active"
                    ? "Approved automatically — now serving."
                    : "Sent for review.",
                title: `Promoting ${title}`,
              });
            },
          });
        },
      }
    );
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>Promote your music</CardTitle>
        <CardDescription>
          Two clicks: pick a track, set a daily budget. Your track is the ad —
          no upload needed. US-wide to start.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="promote-budget">Daily budget ($)</Label>
            <Input
              id="promote-budget"
              min="1"
              onChange={(event) => setBudgetDollars(Number(event.target.value))}
              type="number"
              value={budgetDollars}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="promote-placement">Placement</Label>
            <select
              aria-label="Placement"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              id="promote-placement"
              onChange={(event) =>
                setPlacement(event.target.value as AdPlacement)
              }
              value={placement}
            >
              <option value="audio_preroll">Audio pre-roll</option>
              <option value="sponsored_queue">Sponsored queue</option>
            </select>
          </div>
        </div>
        {tracksQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading your tracks…</p>
        )}
        {!tracksQuery.isLoading && tracks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tracks yet — upload music first, then promote it here.
          </p>
        )}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {tracks.map((track) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              key={track.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{track.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {(track.playbackUrl ?? track.previewUrl)
                    ? "Ready to promote"
                    : "Processing…"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {track.genre && <Badge variant="outline">{track.genre}</Badge>}
                <Button
                  disabled={launchingId !== null}
                  onClick={() =>
                    launch(
                      track.id,
                      track.title,
                      track.playbackUrl ?? track.previewUrl ?? null
                    )
                  }
                  size="sm"
                >
                  {launchingId === track.id ? "Launching…" : "Promote"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
