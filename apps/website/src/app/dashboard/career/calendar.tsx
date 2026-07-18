import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, FolderOpen, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useListeningPartiesQuery,
  useProjectsQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/calendar")({
  component: CareerCalendarPage,
});

const monthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

function CareerCalendarPage() {
  const projectsQuery = useProjectsQuery();
  const partiesQuery = useListeningPartiesQuery();
  const scheduledProjects = [...(projectsQuery.data ?? [])]
    .filter((project) => project.releaseDate)
    .toSorted(
      (left, right) =>
        new Date(left.releaseDate ?? 0).getTime() -
        new Date(right.releaseDate ?? 0).getTime()
    );
  const currentMonth = monthLabel(new Date());
  const parties = partiesQuery.data ?? [];
  const groupedProjects: Record<string, typeof scheduledProjects> = {};
  for (const project of scheduledProjects) {
    const label = monthLabel(new Date(project.releaseDate ?? ""));
    groupedProjects[label] ??= [];
    groupedProjects[label].push(project);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Release Calendar
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upcoming project release dates from your catalog.
          </p>
        </div>
        <Button asChild={true}>
          <Link to="/dashboard/projects/new">
            <Plus className="mr-2 size-4" />
            Schedule Release
          </Link>
        </Button>
      </div>

      <Card className="border-border/40 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            {currentMonth}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {projectsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading release dates...
            </p>
          )}

          {parties.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
                Live Parties
              </h2>
              <div className="grid gap-3">
                {parties.map((party) => (
                  <Link
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-background/40 p-4 transition-colors hover:border-primary/40"
                    key={party.id}
                    params={{ id: party.liveRoomId ?? party.id }}
                    to="/live/parties/$id"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <CalendarDays className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{party.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(party.scheduledStartAt).toLocaleDateString(
                            undefined,
                            {
                              day: "numeric",
                              month: "short",
                              weekday: "short",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge className="capitalize" variant="outline">
                      {party.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!projectsQuery.isLoading && scheduledProjects.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/50 p-10 text-center">
              <CalendarDays className="mx-auto mb-3 size-10 text-muted-foreground/30" />
              <p className="font-semibold">No scheduled releases</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a release date to a project to see it here.
              </p>
            </div>
          )}

          {Object.entries(groupedProjects).map(([label, projects]) => (
            <section className="space-y-3" key={label}>
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                {label}
              </h2>
              <div className="grid gap-3">
                {projects.map((project) => (
                  <Link
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-background/40 p-4 transition-colors hover:border-primary/40"
                    key={project.id}
                    params={{ id: project.id }}
                    to="/dashboard/projects/$id"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FolderOpen className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {project.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(
                            project.releaseDate ?? ""
                          ).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            weekday: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge className="capitalize" variant="secondary">
                      {project.projectType}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
