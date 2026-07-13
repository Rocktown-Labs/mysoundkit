import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Disc3,
  Music2,
  Plus,
  Save,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { useTracksQuery } from "@/lib/soundkit-api-hooks";
import type { TrackSummary } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/live/my-kit")({
  component: MyKitPage,
});

const battleFormats = [
  {
    description: "Three focused records for quick ranked matchups.",
    id: "best-of-3",
    label: "Best of 3",
    slots: 3,
  },
  {
    description: "A deeper rotation when the room wants range.",
    id: "best-of-5",
    label: "Best of 5",
    slots: 5,
  },
  {
    description: "Your full set list for longer live battles.",
    id: "best-of-7",
    label: "Best of 7",
    slots: 7,
  },
  {
    description: "One decisive track for sudden-death rounds.",
    id: "tiebreaker",
    label: "Tiebreaker",
    slots: 1,
  },
] as const;

type BattleFormatId = (typeof battleFormats)[number]["id"];
type SelectedKits = Record<BattleFormatId, string[]>;

const emptySelectedKits: SelectedKits = {
  "best-of-3": [],
  "best-of-5": [],
  "best-of-7": [],
  tiebreaker: [],
};

const storageKey = "soundkit:battle-kit:v1";

function MyKitPage() {
  const { data: tracks = [], error, isLoading } = useTracksQuery();
  const [activeFormatId, setActiveFormatId] =
    useState<BattleFormatId>("best-of-3");
  const [selectedKits, setSelectedKits] =
    useState<SelectedKits>(emptySelectedKits);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedKit = window.localStorage.getItem(storageKey);

    if (!storedKit) {
      return;
    }

    try {
      const parsedKit = JSON.parse(storedKit) as Partial<SelectedKits>;
      setSelectedKits({
        "best-of-3": parsedKit["best-of-3"] ?? [],
        "best-of-5": parsedKit["best-of-5"] ?? [],
        "best-of-7": parsedKit["best-of-7"] ?? [],
        tiebreaker: parsedKit.tiebreaker ?? [],
      });
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  const activeFormat = battleFormats.find(
    (format) => format.id === activeFormatId
  );
  const activeSelectedIds = selectedKits[activeFormatId];
  const selectedTrackMap = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks]
  );
  const selectedTracks = activeSelectedIds
    .map((trackId) => selectedTrackMap.get(trackId))
    .filter((track): track is TrackSummary => Boolean(track));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTracks = tracks.filter((track) => {
    if (!normalizedQuery) {
      return true;
    }

    return [track.title, track.genre, track.productionStatus]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  const updateSelectedTracks = (trackId: string) => {
    const slotCount = activeFormat?.slots ?? 0;

    setSelectedKits((currentKits) => {
      const currentTracks = currentKits[activeFormatId];

      if (currentTracks.includes(trackId)) {
        return {
          ...currentKits,
          [activeFormatId]: currentTracks.filter((id) => id !== trackId),
        };
      }

      if (currentTracks.length >= slotCount) {
        return currentKits;
      }

      return {
        ...currentKits,
        [activeFormatId]: [...currentTracks, trackId],
      };
    });
  };

  const removeSelectedTrack = (trackId: string) => {
    setSelectedKits((currentKits) => ({
      ...currentKits,
      [activeFormatId]: currentKits[activeFormatId].filter(
        (id) => id !== trackId
      ),
    }));
  };

  const saveKit = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(selectedKits));
    setSavedAt(new Date().toLocaleTimeString([], { timeStyle: "short" }));
  };

  const slotCount = activeFormat?.slots ?? 0;
  const isFormatFull = activeSelectedIds.length >= slotCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">My Battle Kit</h1>
          <p className="text-muted-foreground">
            Preset your strongest tracks for each live battle format.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/tracks">
              <Music2 className="mr-2 size-4" />
              Explore Music
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/live">
              <Trophy className="mr-2 size-4" />
              Find Battles
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {battleFormats.map((format) => {
          const selectedCount = selectedKits[format.id].length;
          const isActive = activeFormatId === format.id;

          return (
            <button
              type="button"
              key={format.id}
              onClick={() => setActiveFormatId(format.id)}
              className={cn(
                "rounded-lg border bg-card/50 p-4 text-left transition-colors hover:border-primary/60",
                isActive && "border-primary bg-primary/10"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{format.label}</p>
                <Badge variant={isActive ? "default" : "outline"}>
                  {selectedCount}/{format.slots}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {format.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Track Library</CardTitle>
                <CardDescription>
                  Select from your uploaded catalog for {activeFormat?.label}.
                </CardDescription>
              </div>
              <Badge variant="secondary">{tracks.length} tracks</Badge>
            </div>
            <div className="relative">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
                placeholder="Search by title, genre, or status"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                Loading your tracks...
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-8 text-sm text-destructive">
                We could not load your tracks. Refresh and try again.
              </div>
            )}

            {!isLoading && !error && tracks.length === 0 && (
              <EmptyLibraryState />
            )}

            {!isLoading &&
              !error &&
              tracks.length > 0 &&
              filteredTracks.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No tracks match that search.
                </div>
              )}

            {!isLoading && !error && filteredTracks.length > 0 && (
              <div className="space-y-3">
                {filteredTracks.map((track) => {
                  const isSelected = activeSelectedIds.includes(track.id);
                  const disableAdd = !isSelected && isFormatFull;

                  return (
                    <TrackLibraryRow
                      key={track.id}
                      track={track}
                      disabled={disableAdd}
                      isSelected={isSelected}
                      onToggle={() => updateSelectedTracks(track.id)}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-card/70">
          <CardHeader>
            <CardTitle>{activeFormat?.label} Set</CardTitle>
            <CardDescription>
              {activeSelectedIds.length} of {slotCount} battle slots ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {Array.from({ length: slotCount }).map((_, index) => {
                const selectedTrack = selectedTracks[index];

                if (!selectedTrack) {
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: Battle slots are fixed positions.
                      key={index}
                      className="flex min-h-16 items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                    >
                      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                        {index + 1}
                      </div>
                      Empty slot
                    </div>
                  );
                }

                return (
                  <div
                    key={selectedTrack.id}
                    className="flex min-h-16 items-center gap-3 rounded-lg border bg-background/60 p-3"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {selectedTrack.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTrackMeta(selectedTrack)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSelectedTrack(selectedTrack.id)}
                      aria-label={`Remove ${selectedTrack.title}`}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              {isFormatFull
                ? "This kit is full and ready to use."
                : `Add ${slotCount - activeSelectedIds.length} more ${
                    slotCount - activeSelectedIds.length === 1
                      ? "track"
                      : "tracks"
                  } to complete this format.`}
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={saveKit}
              disabled={activeSelectedIds.length === 0}
            >
              <Save className="mr-2 size-4" />
              Save Kit
            </Button>

            {savedAt && (
              <p className="text-center text-xs text-muted-foreground">
                Saved locally at {savedAt}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrackLibraryRow({
  disabled,
  isSelected,
  onToggle,
  track,
}: {
  disabled: boolean;
  isSelected: boolean;
  onToggle: () => void;
  track: TrackSummary;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
        isSelected ? "border-primary bg-primary/10" : "bg-background/40",
        disabled && "opacity-60"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {track.coverArtUrl ? (
            <img
              src={track.coverArtUrl}
              alt={`${track.title} cover`}
              className="size-full object-cover"
            />
          ) : (
            <Disc3 className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{track.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatTrackMeta(track)}</span>
            {track.fileAvailability?.master && (
              <Badge variant="outline">Master ready</Badge>
            )}
            {track.isForSale && <Badge variant="secondary">For sale</Badge>}
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant={isSelected ? "default" : "outline"}
        onClick={onToggle}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        {isSelected ? (
          <>
            <Check className="mr-2 size-4" />
            Added
          </>
        ) : (
          <>
            <Plus className="mr-2 size-4" />
            Add
          </>
        )}
      </Button>
    </div>
  );
}

function EmptyLibraryState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Music2 className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-semibold">No tracks in your library yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a track first, then add it to a battle kit.
      </p>
      <Button asChild className="mt-4">
        <Link to="/dashboard/tracks/new">Create Track</Link>
      </Button>
    </div>
  );
}

function formatTrackMeta(track: TrackSummary) {
  const parts = [
    track.genre || "No genre",
    track.duration || "No duration",
    `${track.plays.toLocaleString()} plays`,
  ];

  return parts.join(" - ");
}
