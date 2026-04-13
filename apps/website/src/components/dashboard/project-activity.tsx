import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Download, Edit, CheckCircle } from "lucide-react"

interface ProjectActivityProps {
  projectId: string
}

const mockActivity = [
  {
    id: 1,
    type: "upload",
    user: "You",
    action: "uploaded",
    target: "instrumental file",
    time: "2 hours ago",
    icon: Upload,
  },
  {
    id: 2,
    type: "status",
    user: "Producer Mike",
    action: "marked project as",
    target: "mixed",
    time: "4 hours ago",
    icon: CheckCircle,
  },
  {
    id: 3,
    type: "download",
    user: "Producer Mike",
    action: "downloaded",
    target: "session file",
    time: "1 day ago",
    icon: Download,
  },
  {
    id: 4,
    type: "edit",
    user: "You",
    action: "updated project",
    target: "description",
    time: "2 days ago",
    icon: Edit,
  },
  {
    id: 5,
    type: "upload",
    user: "Producer Mike",
    action: "uploaded",
    target: "session file",
    time: "2 days ago",
    icon: Upload,
  },
]

export function ProjectActivity({ projectId }: ProjectActivityProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-playfair)]">Activity</CardTitle>
        <CardDescription>Recent changes to this project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockActivity.map((activity) => {
          const IconComponent = activity.icon
          return (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <IconComponent className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user}</span> {activity.action}{" "}
                  <span className="font-medium text-primary">{activity.target}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
