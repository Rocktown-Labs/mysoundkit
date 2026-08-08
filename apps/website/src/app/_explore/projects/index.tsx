"use client";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Disc,
  Filter,
  Grid,
  List,
  Music,
  Play,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectsQuery } from "@/lib/soundkit-api-hooks";

interface ExploreProjectsSearch {
  forSale?: boolean;
  genre?: string;
  page?: number;
  q?: string;
  type?: "album" | "ep" | "mixtape";
}

export const Route = createFileRoute("/_explore/projects/")({
  component: ExploreProjectsPage,
  validateSearch: (search: Record<string, unknown>): ExploreProjectsSearch => ({
    forSale: search.forSale === true || search.forSale === "true",
    genre: typeof search.genre === "string" ? search.genre : undefined,
    page: typeof search.page === "number" ? search.page : 1,
    q: typeof search.q === "string" ? search.q : undefined,
    type:
      search.type === "album" || search.type === "ep" || search.type === "mixtape"
        ? search.type
        : undefined,
  }),
});

function ExploreProjectsPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: projects = [], isLoading } = useProjectsQuery();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (search.type && project.projectType !== search.type) return false;
      if (search.genre && project.tracks?.some((t) => t.genre === search.genre))
        return false;
      if (search.forSale && !project.isPublic) return false;
      if (search.q) {
        const query = search.q.toLowerCase();
        return (
          project.title.toLowerCase().includes(query) ||
          project.projectType.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [projects, search]);

  const handleTypeSelect = (type?: ExploreProjectsSearch["type"]) => {
    navigate({
      search: {
        ...search,
        type,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Projects &amp; Albums
          </h1>
          <p className="mt-1 text-muted-foreground">
            Explore full-length albums, EPs, and mixtapes from top SoundKit creators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
          >
            <Grid className="size-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Project Type Chips & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={!search.type ? "default" : "outline"}
            onClick={() => handleTypeSelect(undefined)}
          >
            All Projects
          </Button>
          <Button
            size="sm"
            variant={search.type === "album" ? "default" : "outline"}
            onClick={() => handleTypeSelect("album")}
          >
            Albums
          </Button>
          <Button
            size="sm"
            variant={search.type === "ep" ? "default" : "outline"}
            onClick={() => handleTypeSelect("ep")}
          >
            EPs
          </Button>
          <Button
            size="sm"
            variant={search.type === "mixtape" ? "default" : "outline"}
            onClick={() => handleTypeSelect("mixtape")}
          >
            Mixtapes
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search albums..."
            value={search.q ?? ""}
            onChange={(e) =>
              navigate({
                search: {
                  ...search,
                  q: e.target.value || undefined,
                },
              })
            }
            className="pl-9"
          />
        </div>
      </div>

      {/* Projects Grid / List */}
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Loading albums...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed text-muted-foreground">
          <Disc className="mx-auto size-10 mb-2 opacity-50" />
          <p className="font-semibold text-foreground">No projects found</p>
          <p className="text-sm">Try clearing your search or category filters.</p>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
              : "space-y-4"
          }
        >
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="group overflow-hidden border-border/40 bg-card/60 hover:border-primary/50 transition-all hover:shadow-xl"
            >
              <div className="relative aspect-square w-full bg-muted overflow-hidden">
                {project.coverArtUrl ? (
                  <AppImage
                    src={project.coverArtUrl}
                    alt={project.title}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center bg-accent/40 text-muted-foreground">
                    <Disc className="size-16 opacity-40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button asChild size="icon" className="rounded-full shadow-lg">
                    <Link to="/projects/$id" params={{ id: project.id }}>
                      <Play className="size-5 fill-current ml-0.5" />
                    </Link>
                  </Button>
                </div>
                <div className="absolute top-2 left-2 flex gap-1">
                  <Badge variant="secondary" className="uppercase text-[10px] font-bold tracking-wider backdrop-blur-md">
                    {project.projectType}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4">
                <Link
                  to="/projects/$id"
                  params={{ id: project.id }}
                  className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors"
                >
                  {project.title}
                </Link>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{project.trackCount} tracks</span>
                  <span>{project.releaseDate ? new Date(project.releaseDate).getFullYear() : "2026"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
