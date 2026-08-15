import { Edit, CheckCircle, Users, Music, LoaderCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProjectQuery } from "@/lib/soundkit-api-hooks";

interface ProjectActivityProps {
  projectId: string;
}

const formatRelativeTime = (isoString: string | null | undefined) => {
  if (!isoString) {
    return "—";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const diffMs = Date.now() - date.getTime(),
   minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
};

export function ProjectActivity({ projectId }: ProjectActivityProps) {
  const projectQuery = useProjectQuery(projectId),
   project = projectQuery.data,
   tracks = project?.tracks ?? [],
   collaborators = Array.isArray(project?.collaborators)
    ? (project.collaborators ?? [])
    : [];

  if (projectQuery.isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading activity…
        </CardContent>
      </Card>
    );
  }

  const statusMeta: Record<
    string,
    { icon: typeof CheckCircle; label: string }
  > = {
    archived: { icon: CheckCircle, label: "Archived" },
    draft: { icon: Edit, label: "Draft" },
    released: { icon: CheckCircle, label: "Released" },
    scheduled: { icon: CheckCircle, label: "Scheduled" },
  },

   statusEntry =
    project && project.status
      ? {
          action: `project is ${project.status}`,
          icon: statusMeta[project.status]?.icon ?? Edit,
          id: "status",
          target: statusMeta[project.status]?.label ?? project.status,
          time: formatRelativeTime(project.updatedAt),
          type: "status",
          user: "",
        }
      : null,

   entries = [
    ...(statusEntry ? [statusEntry] : []),
    ...(project
      ? [
          {
            action: "updated project",
            icon: Edit,
            id: "updated",
            target: project.title,
            time: formatRelativeTime(project.updatedAt),
            type: "edit",
            user: "",
          },
        ]
      : []),
    ...tracks.map((track) => ({
      action: "added track",
      icon: Music,
      id: `track-${track.id}`,
      target: track.title,
      time: formatRelativeTime(track.updatedAt),
      type: "track",
      user: "",
    })),
    ...collaborators
      .filter((collaborator) => collaborator.status === "accepted")
      .map((collaborator) => ({
        action: "joined as",
        icon: Users,
        id: `collab-${collaborator.id}`,
        target: collaborator.role,
        time: formatRelativeTime(project?.updatedAt),
        type: "collaborator",
        user: collaborator.name ?? collaborator.email ?? "A collaborator",
      })),
  ];

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-playfair)]">
          Activity
        </CardTitle>
        <CardDescription>Recent changes to this project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity recorded for this project yet.
          </p>
        ) : (
          entries.map((activity) => {
            const IconComponent = activity.icon;
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <IconComponent className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    {activity.user ? (
                      <span className="font-medium">{activity.user}</span>
                    ) : null}
                    {activity.user ? " " : null}
                    {activity.action}{" "}
                    <span className="font-medium text-primary">
                      {activity.target}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.time}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
