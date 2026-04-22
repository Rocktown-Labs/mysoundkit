"use client";

import { Upload, Download, Edit, Music, ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mockActivity = [
  {
    action: "uploaded vocals for",
    icon: Upload,
    id: 1,
    project: "Summer Vibes",
    time: "2h ago",
    type: "upload",
    user: "You",
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    action: "downloaded stems from",
    icon: Download,
    id: 2,
    project: "Late Night Sessions",
    time: "1d ago",
    type: "download",
    user: "David Kim",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  },
  {
    action: "edited metadata for",
    icon: Edit,
    id: 3,
    project: "Collaboration Track",
    time: "2d ago",
    type: "edit",
    user: "You",
    color: "text-amber-500",
    bg: "bg-amber-500/10"
  },
  {
    action: "created project",
    icon: Music,
    id: 4,
    project: "Untitled Track",
    time: "3d ago",
    type: "create",
    user: "You",
    color: "text-primary",
    bg: "bg-primary/10"
  },
];

export function RecentActivity() {
  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/40 overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="font-[family-name:var(--font-playfair)] text-lg">
            Activity
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase tracking-widest font-bold">
            Full Log
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-border/40 via-border/20 to-transparent" />
          
          <div className="p-4 space-y-6">
            {mockActivity.map((activity) => {
              const IconComponent = activity.icon;
              return (
                <div key={activity.id} className="flex items-start gap-4 group relative">
                  <div className={cn(
                    "size-7 rounded-full flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-110 border border-border/20 shadow-sm",
                    activity.bg,
                    activity.color
                  )}>
                    <IconComponent className="size-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">
                      <span className="font-bold text-foreground/90">{activity.user}</span>{" "}
                      <span className="text-muted-foreground/80">{activity.action}</span>{" "}
                      <span className="font-semibold text-primary hover:underline cursor-pointer">
                        {activity.project}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/50 font-medium">
                        {activity.time}
                      </span>
                      <span className="size-0.5 rounded-full bg-border" />
                      <button className="text-[10px] text-primary/60 hover:text-primary font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
