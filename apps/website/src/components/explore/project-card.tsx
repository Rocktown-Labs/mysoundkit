import { Link } from "@tanstack/react-router";
import { Disc, Play } from "lucide-react";

import {
  PublicCard,
  PublicCardMeta,
  PublicCardThumbnail,
} from "@/components/explore/public-card";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PublicProjectSummary } from "@/lib/soundkit-api-hooks";

export function ProjectCard({ project }: { project: PublicProjectSummary }) {
  return (
    <PublicCard className="w-full">
      <PublicCardThumbnail aspect="square">
        {project.coverArtUrl ? (
          <AppImage
            alt={`${project.title} cover artwork`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            height={640}
            layout="constrained"
            loading="lazy"
            src={project.coverArtUrl}
            width={640}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-accent/40 text-muted-foreground">
            <Disc aria-hidden="true" className="size-14 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            aria-label={`Open ${project.title}`}
            asChild
            className="rounded-full shadow-lg"
            size="icon"
          >
            <Link params={{ id: project.id }} to="/projects/$id">
              <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />
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
          {project.isForSale ? (
            <Badge className="text-[10px]" variant="outline">
              For Sale
            </Badge>
          ) : null}
        </div>
      </PublicCardThumbnail>
      <PublicCardMeta className="p-3.5">
        <Link
          className="line-clamp-1 font-semibold transition-colors group-hover:text-primary"
          params={{ id: project.id }}
          to="/projects/$id"
        >
          {project.title}
        </Link>
        <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
          {project.artistName ?? project.genre ?? "SoundKit artist"}
        </p>
        <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
          <span>{project.trackCount} tracks</span>
          <span>{project.duration ?? "0:00"}</span>
        </div>
      </PublicCardMeta>
    </PublicCard>
  );
}
