import { Upload, Download, Edit, CheckCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProjectActivityProps {
  projectId: string;
}

const mockActivity = [
  {
    action: "uploaded",
    icon: Upload,
    id: 1,
    target: "instrumental file",
    time: "2 hours ago",
    type: "upload",
    user: "You",
  },
  {
    action: "marked project as",
    icon: CheckCircle,
    id: 2,
    target: "mixed",
    time: "4 hours ago",
    type: "status",
    user: "Producer Mike",
  },
  {
    action: "downloaded",
    icon: Download,
    id: 3,
    target: "session file",
    time: "1 day ago",
    type: "download",
    user: "Producer Mike",
  },
  {
    action: "updated project",
    icon: Edit,
    id: 4,
    target: "description",
    time: "2 days ago",
    type: "edit",
    user: "You",
  },
  {
    action: "uploaded",
    icon: Upload,
    id: 5,
    target: "session file",
    time: "2 days ago",
    type: "upload",
    user: "Producer Mike",
  },
];

export function ProjectActivity({ projectId }: ProjectActivityProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-playfair)]">
          Activity
        </CardTitle>
        <CardDescription>Recent changes to this project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockActivity.map((activity) => {
          const IconComponent = activity.icon;
          return (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <IconComponent className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user}</span>{" "}
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
        })}
      </CardContent>
    </Card>
  );
}
