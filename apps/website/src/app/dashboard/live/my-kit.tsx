/* eslint-disable complexity, no-nested-ternary, one-var, sort-vars, unicorn/prefer-ternary */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Disc3,
  Edit3,
  Music2,
  Plus,
  Save,
  Search,
  Swords,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { isReleasedTrack } from "@/lib/release-momentum";
import type { BattleKit, TrackSummary } from "@/lib/soundkit-api-hooks";
import {
  useBattleKitsQuery,
  useCreateBattleKitMutation,
  useDeleteBattleKitMutation,
  useTracksQuery,
  useUpdateBattleKitMutation,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/live/my-kit")({
  component: MyKitPage,
});

const battleFormats = [
  { id: "best_of_3", label: "Best of 3", mainTracks: 3 },
  { id: "best_of_5", label: "Best of 5", mainTracks: 5 },
  { id: "best_of_7", label: "Best of 7", mainTracks: 7 },
] as const;

type BattleKitFormat = (typeof battleFormats)[number]["id"];

const formatLabel = (format: BattleKitFormat) =>
  battleFormats.find((entry) => entry.id === format)?.label ?? format;

function MyKitPage() {
  const { toast } = useToast(),
    kitsQuery = useBattleKitsQuery(),
    tracksQuery = useTracksQuery(),
    createKit = useCreateBattleKitMutation(),
    updateKit = useUpdateBattleKitMutation(),
    deleteKit = useDeleteBattleKitMutation(),
    [editingKitId, setEditingKitId] = useState<string | null>(null),
    editingKit = kitsQuery.data?.find((kit) => kit.id === editingKitId),
    releasedTracks = useMemo(
      () => (tracksQuery.data ?? []).filter(isReleasedTrack),
      [tracksQuery.data]
    );

  if (editingKitId !== null) {
    return (
      <BattleKitEditor
        initialKit={editingKit}
        releasedTracks={releasedTracks}
        isSaving={createKit.isPending || updateKit.isPending}
        onBack={() => setEditingKitId(null)}
        onSave={async (payload) => {
          try {
            if (editingKit) {
              await updateKit.mutateAsync({ kitId: editingKit.id, ...payload });
            } else {
              await createKit.mutateAsync(payload);
            }
            toast({
              description:
                "Your Battle Kit is saved across your SoundKit devices.",
              title: "Battle Kit saved",
            });
            setEditingKitId(null);
          } catch (error) {
            toast({
              description:
                error instanceof Error
                  ? error.message
                  : "Could not save this Battle Kit.",
              title: "Battle Kit save failed",
              variant: "destructive",
            });
          }
        }}
      />
    );
  }

  const kits = kitsQuery.data ?? [],
    tracks = tracksQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            My Battle Kits
          </h1>
          <p className="mt-1 text-muted-foreground">
            Preset reusable, battle-ready collections from your catalog.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/tracks">
              <Music2 data-icon="inline-start" />
              Explore Music
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/live/battles">
              <Trophy data-icon="inline-start" />
              Find Battles
            </Link>
          </Button>
          <Button
            disabled={tracksQuery.data?.length === 0}
            onClick={() => setEditingKitId("new")}
          >
            <Plus data-icon="inline-start" />
            Create Kit
          </Button>
        </div>
      </div>

      {kitsQuery.isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading your Battle Kits...
          </CardContent>
        </Card>
      )}

      {kitsQuery.error && (
        <Card className="border-destructive/40">
          <CardContent className="p-8 text-center text-sm text-destructive">
            We could not load your Battle Kits. Refresh and try again.
          </CardContent>
        </Card>
      )}

      {!kitsQuery.isLoading && !kitsQuery.error && kits.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Swords className="size-10 text-primary" />
            <h2 className="text-xl font-semibold">
              Build your first Battle Kit
            </h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              {tracks.length === 0
                ? "Upload and release music before creating a Battle Kit."
                : releasedTracks.length < 4
                  ? `You currently have ${releasedTracks.length} eligible track${releasedTracks.length === 1 ? "" : "s"}. A BO3 kit requires 4 including the tiebreaker.`
                  : "Give a named set of songs a home, then take it into your next battle."}
            </p>
            {releasedTracks.length > 0 && (
              <Button onClick={() => setEditingKitId("new")}>
                <Plus data-icon="inline-start" />
                Create your first kit
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!kitsQuery.isLoading && !kitsQuery.error && kits.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kits.map((kit) => (
            <BattleKitCard
              key={kit.id}
              kit={kit}
              isDeleting={deleteKit.isPending}
              onDelete={async () => {
                try {
                  await deleteKit.mutateAsync(kit.id);
                  toast({ title: "Battle Kit deleted" });
                } catch (error) {
                  toast({
                    description:
                      error instanceof Error ? error.message : "Delete failed.",
                    title: "Could not delete Battle Kit",
                    variant: "destructive",
                  });
                }
              }}
              onEdit={() => setEditingKitId(kit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BattleKitCard({
  isDeleting,
  kit,
  onDelete,
  onEdit,
}: {
  isDeleting: boolean;
  kit: BattleKit;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const mainTracks = kit.tracks.filter((track) => track.role === "main"),
    tiebreaker = kit.tracks.find((track) => track.role === "tiebreaker");

  return (
    <Card
      className={cn("flex flex-col", kit.isBattleReady && "border-primary/50")}
    >
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{kit.name}</CardTitle>
            <CardDescription>{formatLabel(kit.format)}</CardDescription>
          </div>
          <Badge variant={kit.isBattleReady ? "default" : "secondary"}>
            {kit.isBattleReady
              ? "Battle Ready"
              : `${kit.totalUniqueTracks}/${kit.totalRequiredTracks}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {[...mainTracks, ...(tiebreaker ? [tiebreaker] : [])].map((track) => (
            <div
              className="size-12 overflow-hidden rounded-md border bg-muted"
              key={track.id}
            >
              {track.coverArtUrl ? (
                <img
                  alt={`${track.title} cover`}
                  className="size-full object-cover"
                  src={track.coverArtUrl}
                />
              ) : (
                <Disc3 className="m-3 size-6 text-muted-foreground" />
              )}
            </div>
          ))}
          {kit.totalUniqueTracks < kit.totalRequiredTracks && (
            <div className="flex size-12 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              +
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {kit.isBattleReady
            ? `${kit.totalUniqueTracks} unique tracks ready to take into a battle.`
            : (kit.reason ??
              `Choose ${kit.totalRequiredTracks - kit.totalUniqueTracks} more track${kit.totalRequiredTracks - kit.totalUniqueTracks === 1 ? "" : "s"}.`)}
        </p>
        <div className="mt-auto flex gap-2">
          <Button
            asChild
            className="flex-1"
            disabled={!kit.isBattleReady}
            variant={kit.isBattleReady ? "default" : "outline"}
          >
            <Link to="/dashboard/live/battles">
              <Swords data-icon="inline-start" />
              Use Kit
            </Link>
          </Button>
          <Button
            aria-label={`Edit ${kit.name}`}
            onClick={onEdit}
            size="icon"
            variant="outline"
          >
            <Edit3 />
          </Button>
          <Button
            aria-label={`Delete ${kit.name}`}
            disabled={isDeleting}
            onClick={onDelete}
            size="icon"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BattleKitEditor({
  initialKit,
  isSaving,
  onBack,
  onSave,
  releasedTracks,
}: {
  initialKit?: BattleKit;
  isSaving: boolean;
  onBack: () => void;
  onSave: (payload: {
    format: BattleKitFormat;
    name: string;
    tracks: {
      mainSlot: number | null;
      role: "main" | "tiebreaker";
      trackId: string;
    }[];
  }) => Promise<void>;
  releasedTracks: TrackSummary[];
}) {
  const [name, setName] = useState(initialKit?.name ?? ""),
    [format, setFormat] = useState<BattleKitFormat>(
      initialKit?.format ?? "best_of_3"
    ),
    [mainTrackIds, setMainTrackIds] = useState<string[]>(
      initialKit?.tracks
        .filter((track) => track.role === "main")
        .toSorted(
          (first, second) => (first.mainSlot ?? 0) - (second.mainSlot ?? 0)
        )
        .map((track) => track.trackId) ?? []
    ),
    [tiebreakerId, setTiebreakerId] = useState<string | null>(
      initialKit?.tracks.find((track) => track.role === "tiebreaker")
        ?.trackId ?? null
    ),
    [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const requiredMainTracks =
      battleFormats.find((entry) => entry.id === format)?.mainTracks ?? 3;
    if (mainTrackIds.length > requiredMainTracks) {
      setMainTrackIds((current) => current.slice(0, requiredMainTracks));
    }
  }, [format, mainTrackIds.length]);

  const requiredMainTracks =
      battleFormats.find((entry) => entry.id === format)?.mainTracks ?? 3,
    selectedIds = new Set([
      ...mainTrackIds,
      ...(tiebreakerId ? [tiebreakerId] : []),
    ]),
    normalizedSearch = searchQuery.trim().toLowerCase(),
    visibleTracks = releasedTracks.filter((track) => {
      if (!normalizedSearch) {
        return true;
      }
      return [track.title, track.genre].some((value) =>
        value?.toLowerCase().includes(normalizedSearch)
      );
    }),
    toggleMainTrack = (trackId: string) => {
      setMainTrackIds((current) => {
        if (current.includes(trackId)) {
          return current.filter((id) => id !== trackId);
        }
        if (current.length >= requiredMainTracks || trackId === tiebreakerId) {
          return current;
        }
        return [...current, trackId];
      });
    },
    toggleTiebreaker = (trackId: string) => {
      setTiebreakerId((current) =>
        current === trackId
          ? null
          : mainTrackIds.includes(trackId)
            ? current
            : trackId
      );
    },
    submit = () => {
      if (!name.trim()) {
        return;
      }
      void onSave({
        format,
        name: name.trim(),
        tracks: [
          ...mainTrackIds.map((trackId, index) => ({
            mainSlot: index + 1,
            role: "main" as const,
            trackId,
          })),
          ...(tiebreakerId
            ? [
                {
                  mainSlot: null,
                  role: "tiebreaker" as const,
                  trackId: tiebreakerId,
                },
              ]
            : []),
        ],
      });
    };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button onClick={onBack} size="sm" variant="ghost">
            <ArrowLeft data-icon="inline-start" />
            My Battle Kits
          </Button>
          <h1 className="mt-2 font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            {initialKit ? "Edit Battle Kit" : "Create Battle Kit"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Save an incomplete draft now, then finish it when your catalog is
            ready.
          </p>
        </div>
        <Button disabled={isSaving || !name.trim()} onClick={submit}>
          <Save data-icon="inline-start" />
          {isSaving ? "Saving..." : "Save Kit"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Kit details</CardTitle>
            <CardDescription>
              Name the loadout and choose its battle format.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              aria-label="Battle Kit name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Certified Hits"
              value={name}
            />
            <Select
              onValueChange={(value) => setFormat(value as BattleKitFormat)}
              value={format}
            >
              <SelectTrigger aria-label="Battle Kit format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {battleFormats.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>{formatLabel(format)} Set</CardTitle>
            <CardDescription>
              {mainTrackIds.length + (tiebreakerId ? 1 : 0)} of{" "}
              {requiredMainTracks + 1} tracks selected
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: requiredMainTracks }, (_, index) => {
              const track = releasedTracks.find(
                (entry) => entry.id === mainTrackIds[index]
              );
              return (
                <KitSlot
                  key={`main-${index + 1}`}
                  label={`Main slot ${index + 1}`}
                  track={track}
                  onRemove={() => track && toggleMainTrack(track.id)}
                />
              );
            })}
            <KitSlot
              label="Tiebreaker"
              track={releasedTracks.find((entry) => entry.id === tiebreakerId)}
              onRemove={() => tiebreakerId && setTiebreakerId(null)}
            />
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                mainTrackIds.length === requiredMainTracks && tiebreakerId
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              {mainTrackIds.length === requiredMainTracks && tiebreakerId
                ? "Battle Ready"
                : `Choose ${requiredMainTracks - mainTrackIds.length} main track${requiredMainTracks - mainTrackIds.length === 1 ? "" : "s"} and ${tiebreakerId ? "keep your tiebreaker" : "one tiebreaker"}.`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Released track library</CardTitle>
              <CardDescription>
                Only released tracks can be taken into a Battle Kit.
              </CardDescription>
            </div>
            <Badge variant="secondary">{releasedTracks.length} eligible</Badge>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search your released catalog"
              value={searchQuery}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {releasedTracks.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Release music before adding it to a Battle Kit.
            </div>
          )}
          {visibleTracks.map((track) => {
            const isMain = mainTrackIds.includes(track.id),
              isTiebreaker = tiebreakerId === track.id,
              isSelected = selectedIds.has(track.id);
            return (
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                  isSelected && "border-primary bg-primary/5"
                )}
                key={track.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {track.coverArtUrl ? (
                      <img
                        alt={`${track.title} cover`}
                        className="size-full object-cover"
                        src={track.coverArtUrl}
                      />
                    ) : (
                      <Disc3 className="m-3 size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{track.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {track.genre} · {track.duration}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 sm:shrink-0">
                  <Button
                    disabled={
                      isTiebreaker ||
                      (!isMain && mainTrackIds.length >= requiredMainTracks)
                    }
                    onClick={() => toggleMainTrack(track.id)}
                    size="sm"
                    variant={isMain ? "default" : "outline"}
                  >
                    {isMain ? (
                      <Check data-icon="inline-start" />
                    ) : (
                      <Plus data-icon="inline-start" />
                    )}
                    {isMain ? "Main" : "Add main"}
                  </Button>
                  <Button
                    disabled={isMain}
                    onClick={() => toggleTiebreaker(track.id)}
                    size="sm"
                    variant={isTiebreaker ? "default" : "outline"}
                  >
                    {isTiebreaker ? (
                      <Check data-icon="inline-start" />
                    ) : (
                      <Swords data-icon="inline-start" />
                    )}
                    {isTiebreaker ? "Tiebreaker" : "TB"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function KitSlot({
  label,
  onRemove,
  track,
}: {
  label: string;
  onRemove: () => void;
  track?: TrackSummary;
}) {
  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-md border p-3",
        !track && "border-dashed text-muted-foreground"
      )}
    >
      <Badge variant="outline">{label}</Badge>
      {track ? (
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {track.title}
          </span>
          <Button
            aria-label={`Remove ${track.title}`}
            onClick={onRemove}
            size="icon"
            variant="ghost"
          >
            <X />
          </Button>
        </>
      ) : (
        <span className="text-sm">Choose from the track library</span>
      )}
    </div>
  );
}
