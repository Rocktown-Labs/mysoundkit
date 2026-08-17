"use client";

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Disc, Play, Search, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";

import { BattleFilters } from "@/components/explore/battle-filters";
import { ExploreCollectionGrid } from "@/components/explore/explore-collection";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { musicGenres } from "@/lib/music-genres";
import { usePublicProjectsQuery } from "@/lib/soundkit-api-hooks";
import type { PublicProjectSummary } from "@/lib/soundkit-api-hooks";

const sortOptions = [
    { label: "Newest", value: "date-desc" },
    { label: "Oldest", value: "date-asc" },
    { label: "Title (A-Z)", value: "title-asc" },
    { label: "Title (Z-A)", value: "title-desc" },
  ],
  projectTypeOptions = [
    { label: "Albums", value: "album" },
    { label: "EPs", value: "ep" },
    { label: "Mixtapes", value: "mixtape" },
  ] as const;

interface ExploreProjectsSearch {
  forSale?: boolean;
  genre?: string;
  q?: string;
  region?: string;
  regionType?: "north-america" | "global";
  sort?: string;
  type?: "album" | "ep" | "mixtape";
  view?: "all" | "sections";
}

type ProjectFilterUpdate = Omit<Partial<ExploreProjectsSearch>, "type"> & {
  type?: ExploreProjectsSearch["type"] | null;
};

export const Route = createFileRoute("/_explore/projects/")({
  component: ExploreProjectsPage,
  validateSearch: (search: Record<string, unknown>): ExploreProjectsSearch => ({
    forSale: search.forSale === true || search.forSale === "true",
    genre: typeof search.genre === "string" ? search.genre : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    regionType: search.regionType === "global" ? "global" : "north-america",
    sort: typeof search.sort === "string" ? search.sort : undefined,
    type:
      search.type === "album" ||
      search.type === "ep" ||
      search.type === "mixtape"
        ? search.type
        : undefined,
    view: search.view === "all" ? "all" : "sections",
  }),
});

function ExploreProjectsPage() {
  const router = useRouter(),
    navigate = Route.useNavigate(),
    search = Route.useSearch(),
    savedRegionType =
      typeof window === "undefined"
        ? null
        : (localStorage.getItem("exploreRegionType") as
            | "global"
            | "north-america"
            | null),
    savedRegion =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("exploreRegion"),
    regionType = search.regionType ?? savedRegionType ?? "north-america",
    region = search.region ?? savedRegion ?? "us-arkansas",
    genre = search.genre ?? "all",
    sort = search.sort ?? "date-desc",
    forSale = search.forSale ?? false,
    q = search.q ?? "",
    { type } = search,
    view = search.view ?? "sections",
    isFilteredView = Boolean(type || forSale || q || genre !== "all"),
    updateFilters = (next: ProjectFilterUpdate) => {
      const nextRegionType = next.regionType ?? regionType,
        nextRegion = next.region ?? region;

      if (typeof window !== "undefined") {
        localStorage.setItem("exploreRegionType", nextRegionType);
        localStorage.setItem("exploreRegion", nextRegion);
      }

      navigate({
        replace: true,
        search: (prev) => ({
          ...prev,
          forSale: (next.forSale ?? forSale) || undefined,
          genre: next.genre ?? genre,
          q: (next.q ?? q) || undefined,
          region: nextRegion,
          regionType: nextRegionType,
          sort: next.sort ?? sort,
          type: next.type === null ? undefined : (next.type ?? type),
          view: next.view ?? view,
        }),
      });
    },
    { data: projects = [], isLoading } = usePublicProjectsQuery({
      forSale: forSale || undefined,
      genre,
      limit: 48,
      q: q || undefined,
      region,
      regionType,
      sort,
      type,
    });

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-2 font-bold text-2xl md:text-3xl lg:text-4xl">
          <Disc className="size-6 text-primary md:size-8" />
          Projects
        </h1>
        <p className="text-muted-foreground">
          Explore albums, EPs, and mixtapes by region, genre, and release type.
        </p>
      </div>

      <BattleFilters
        genre={genre}
        onGenreChange={(nextGenre) => updateFilters({ genre: nextGenre })}
        onRegionChange={(nextRegion) => updateFilters({ region: nextRegion })}
        onRegionTypeChange={(nextRegionType) =>
          updateFilters({ regionType: nextRegionType })
        }
        onSortChange={(nextSort) => updateFilters({ sort: nextSort })}
        region={region}
        regionType={regionType}
        sort={sort}
        sortOptions={sortOptions}
      />

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => updateFilters({ type: null })}
            size="sm"
            variant={type ? "outline" : "default"}
          >
            All Projects
          </Button>
          {projectTypeOptions.map((option) => (
            <Button
              key={option.value}
              onClick={() => updateFilters({ type: option.value })}
              size="sm"
              variant={type === option.value ? "default" : "outline"}
            >
              {option.label}
            </Button>
          ))}
          <Button
            onClick={() => updateFilters({ forSale: !forSale })}
            size="sm"
            variant={forSale ? "default" : "outline"}
          >
            <ShoppingBag className="mr-2 size-4" />
            For Sale
          </Button>
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => updateFilters({ q: event.target.value })}
            placeholder="Search projects..."
            value={q}
          />
        </div>
      </div>

      {view === "all" || isFilteredView ? (
        <ExploreCollectionGrid
          empty="No projects found for the selected filters."
          isLoading={isLoading}
          items={projects}
          title={view === "all" ? "All Projects" : "Matching Projects"}
        >
          {(project) => <ProjectCard project={project} />}
        </ExploreCollectionGrid>
      ) : null}

      {view !== "all" && !isFilteredView ? (
        <ProjectRail
          empty="No featured projects found for the selected filters."
          genre={genre}
          isLoading={isLoading}
          projects={projects}
          region={region}
          regionType={regionType}
          sort={sort}
          title="Featured Projects"
          type={type}
          forSale={forSale}
        />
      ) : null}

      {view !== "all" && !isFilteredView ? (
        <div className="flex flex-col gap-10">
          {musicGenres.map((sectionGenre) => (
            <ProjectGenreRail
              forSale={forSale}
              key={sectionGenre.value}
              q={q}
              region={region}
              regionType={regionType}
              sectionGenre={sectionGenre}
              sort={sort}
              type={type}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectGenreRail({
  forSale,
  q,
  region,
  regionType,
  sectionGenre,
  sort,
  type,
}: {
  forSale: boolean;
  q: string;
  region: string;
  regionType: "global" | "north-america";
  sectionGenre: (typeof musicGenres)[number];
  sort: string;
  type?: "album" | "ep" | "mixtape";
}) {
  const { data: projects = [], isLoading } = usePublicProjectsQuery({
    forSale: forSale || undefined,
    genre: sectionGenre.value,
    limit: 12,
    q: q || undefined,
    region,
    regionType,
    sort,
    type,
  });

  return (
    <ProjectRail
      empty={`No ${sectionGenre.label} projects are live yet.`}
      forSale={forSale}
      genre={sectionGenre.value}
      isLoading={isLoading}
      projects={projects}
      region={region}
      regionType={regionType}
      sort={sort}
      title={sectionGenre.label}
      type={type}
    />
  );
}

function ProjectRail({
  empty,
  forSale,
  genre,
  isLoading,
  projects,
  region,
  regionType,
  sort,
  title,
  type,
}: {
  empty: string;
  forSale: boolean;
  genre: string;
  isLoading: boolean;
  projects: PublicProjectSummary[];
  region: string;
  regionType: "global" | "north-america";
  sort: string;
  title: string;
  type?: "album" | "ep" | "mixtape";
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-xl">{title}</h2>
          <p className="text-muted-foreground text-sm">
            Albums, EPs, and mixtapes from this lane.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link
            search={
              {
                forSale: forSale || undefined,
                genre,
                region,
                regionType,
                sort,
                type,
                view: "all",
              } satisfies ExploreProjectsSearch
            }
            to="/projects"
          >
            View All
          </Link>
        </Button>
      </div>

      {isLoading || projects.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {projects.slice(0, 12).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <ProjectEmptyState>{empty}</ProjectEmptyState>
      )}
    </section>
  );
}

function ProjectGridSection({
  empty,
  isLoading,
  projects,
  title,
}: {
  empty: string;
  isLoading: boolean;
  projects: PublicProjectSummary[];
  title: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-semibold text-xl">{title}</h2>
      {isLoading || projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <ProjectEmptyState>{empty}</ProjectEmptyState>
      )}
    </section>
  );
}

function ProjectCard({ project }: { project: PublicProjectSummary }) {
  return (
    <Card className="group w-[220px] shrink-0 overflow-hidden border-border/40 bg-card/60 transition-colors hover:border-primary/50">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {project.coverArtUrl ? (
          <AppImage
            alt={project.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={project.coverArtUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-accent/40 text-muted-foreground">
            <Disc className="size-14 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
          <Button asChild className="rounded-full shadow-lg" size="icon">
            <Link params={{ id: project.id }} to="/projects/$id">
              <Play className="ml-0.5 size-5 fill-current" />
            </Link>
          </Button>
        </div>
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge
            className="text-[10px] uppercase tracking-wide"
            variant="secondary"
          >
            {project.projectType}
          </Badge>
          {project.isForSale && (
            <Badge className="text-[10px]" variant="outline">
              For Sale
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <Link
          className="line-clamp-1 font-semibold transition-colors group-hover:text-primary"
          params={{ id: project.id }}
          to="/projects/$id"
        >
          {project.title}
        </Link>
        <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
          {project.genre ?? "Mixed genre"}
        </p>
        <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
          <span>{project.trackCount} tracks</span>
          <span>{project.duration ?? "0:00"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
      {children}
    </div>
  );
}
