import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Download, Edit, Music } from "lucide-react"

const mockActivity = [
  {
    id: 1,
    type: "upload",
    user: "You",
    action: "uploaded vocals for",
    project: "Summer Vibes",
    time: "2 hours ago",
    icon: Upload,
  },
  {
    id: 2,
    type: "download",
    user: "Collaborator",
    action: "downloaded session file from",
    project: "Late Night Sessions",
    time: "1 day ago",
    icon: Download,
  },
  {
    id: 3,
    type: "edit",
    user: "You",
    action: "updated project details for",
    project: "Collaboration Track",
    time: "2 days ago",
    icon: Edit,
  },
  {
    id: 4,
    type: "create",
    user: "You",
    action: "created new project",
    project: "Untitled Track",
    time: "3 days ago",
    icon: Music,
  },
]

export function RecentActivity() {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <CardTitle className="font-[family-name:var(--font-playfair)]">Recent Activity</CardTitle>
        <CardDescription>Latest updates from your collaborations</CardDescription>
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
                  <span className="font-medium text-primary">{activity.project}</span>
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
