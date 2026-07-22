import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones, Plus } from "lucide-react";

import { ListeningPartyCard } from "@/components/explore/listening-party-card";
import { partyDiscoveryItems } from "@/components/explore/live-discovery-data";
import { SectionHeader } from "@/components/explore/section-header";
import { Button } from "@/components/ui/button";
import { musicGenres } from "@/lib/music-genres";

export const Route = createFileRoute("/_explore/live/parties/")({
  component: LivePartiesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
  }),
});

function PartyRail({
  genreValue,
  items,
  title,
}: {
  genreValue?: string;
  items: typeof partyDiscoveryItems;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title={title}
        description="Synced listening rooms with shared chat and saves."
        viewAllHref={
          genreValue ? `/live/parties?genre=${genreValue}` : "/live/parties"
        }
      />
      {items.length > 0 ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4 md:gap-6">
            {items.map((party) => (
              <ListeningPartyCard key={party.id} {...party} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          No {title} listening parties are live yet.
        </div>
      )}
    </section>
  );
}

function LivePartiesPage() {
  const featured = partyDiscoveryItems.filter((party) => party.isFeatured);

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-2xl">
            <Headphones className="size-6 text-primary" />
            Listening Parties
          </h2>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Join release rooms, album faceoffs, and friend-hosted listening
            sessions. Signed-out visitors can browse what is live before jumping
            in.
          </p>
        </div>
        <Button asChild>
          <Link to="/login">
            <Plus className="mr-2 size-4" />
            Create Party
          </Link>
        </Button>
      </section>

      <PartyRail items={featured} title="Featured Parties" />

      {musicGenres.map((genre) => (
        <PartyRail
          genreValue={genre.value}
          items={partyDiscoveryItems.filter(
            (party) => party.genre === genre.label
          )}
          key={genre.value}
          title={genre.label}
        />
      ))}
    </div>
  );
}
