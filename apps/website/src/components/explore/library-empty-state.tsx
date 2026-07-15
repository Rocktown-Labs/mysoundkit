import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface LibraryEmptyStateProps {
  actionHref: "/login" | "/signup" | "/tracks" | "/videos" | "/live";
  actionLabel: string;
  description: string;
  icon: LucideIcon;
  secondaryHref?: "/signup" | "/tracks" | "/videos" | "/live";
  secondaryLabel?: string;
  title: string;
}

export function LibraryEmptyState({
  actionHref,
  actionLabel,
  description,
  icon: Icon,
  secondaryHref,
  secondaryLabel,
  title,
}: LibraryEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-6 text-primary" />
      </div>
      <h2 className="mt-4 font-semibold text-lg">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        {description}
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
        {secondaryHref && secondaryLabel ? (
          <Button asChild variant="outline">
            <Link to={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
