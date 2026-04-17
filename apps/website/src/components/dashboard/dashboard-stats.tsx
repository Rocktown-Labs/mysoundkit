import { Music, FolderOpen, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    change: "+3 this month",
    icon: Music,
    name: "Total Tracks",
    value: "24",
  },
  {
    change: "2 Albums, 3 EPs",
    icon: FolderOpen,
    name: "Active Projects",
    value: "5",
  },
  {
    change: "+2 this month",
    icon: Users,
    name: "Collaborators",
    value: "8",
  },
];

export function DashboardStats() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.name}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </p>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.change}
                </p>
              </div>
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                <stat.icon className="size-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
