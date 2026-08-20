import { Check, Music2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveRoomState } from "@/lib/live-room";

export function BattleArtistControlPanel({
  battle,
  onSelectTrack,
  pending,
  selectedTrackId,
}: {
  battle: NonNullable<LiveRoomState["battle"]>;
  onSelectTrack: (trackId: string) => void;
  pending?: boolean;
  selectedTrackId?: string | null;
}) {
  const controls = battle.artistControls;
  if (!controls) {
    return null;
  }

  return (
    <Card className="border-primary/40 bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Music2 className="size-4 text-primary" />
          Your Battle Kit
          <Badge className="ml-auto text-[10px]" variant="outline">
            Private competitor controls
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Choose only from your locked lineup. Your opponent cannot change or
          see this queue.
        </p>
        {controls.availableTrackIds.map((trackId) => {
          const isSelected =
            selectedTrackId === trackId ||
            controls.selectedNextTrackId === trackId;
          return (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 p-3"
              key={trackId}
            >
              <span className="truncate font-mono text-xs">{trackId}</span>
              <Button
                disabled={pending || isSelected}
                onClick={() => onSelectTrack(trackId)}
                size="sm"
                variant={isSelected ? "secondary" : "outline"}
              >
                {isSelected ? <Check className="mr-1 size-3.5" /> : null}
                {isSelected ? "Selected" : "Choose next"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
