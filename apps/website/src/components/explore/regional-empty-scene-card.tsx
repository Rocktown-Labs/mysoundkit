import { Link } from "@tanstack/react-router";
import { ArrowRight, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RegionalEmptySceneCardProps {
  onResetGlobal?: () => void;
  regionName: string;
}

export function RegionalEmptySceneCard({
  onResetGlobal,
  regionName,
}: RegionalEmptySceneCardProps) {
  return (
    <section
      aria-labelledby="empty-scene-title"
      className="mb-8 rounded-xl border border-border/80 bg-card/60 p-5 md:p-6 text-card-foreground shadow-sm"
      data-testid="regional-empty-scene-card"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {regionName} Scene
            </span>
            <span
              aria-hidden="true"
              className="size-1 rounded-full bg-border"
            />
            <span className="text-xs text-muted-foreground">Early Access</span>
          </div>

          <h2
            className="text-lg md:text-xl font-bold tracking-tight text-foreground"
            id="empty-scene-title"
          >
            No music published in {regionName} yet
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            You&apos;re early to this scene. While local artists and producers
            upload their catalog, we&apos;ve queued top music from across
            SoundKit below so you can start listening right now.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center shrink-0">
          {onResetGlobal ? (
            <Button
              className="gap-2 text-xs"
              onClick={onResetGlobal}
              size="sm"
              type="button"
              variant="outline"
            >
              <Globe className="size-3.5" />
              Reset to Global
            </Button>
          ) : null}

          <Button asChild className="gap-2 text-xs" size="sm" variant="default">
            <Link to="/signup/artist/credentials">
              Are you a {regionName} creator? Publish music
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
