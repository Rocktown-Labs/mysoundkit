"use client";

import {
  Music,
  Clock,
  CheckCircle,
  Download,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockProjects = [
  {
    files: {
      adlibs: true,
      coverArt: true,
      instrumental: true,
      session: true,
      vocals: true,
    },
    id: 1,
    lastUpdated: "2 hours ago",
    mastered: true,
    mixed: true,
    name: "Summer Vibes",
    status: "complete",
  },
  {
    files: {
      adlibs: false,
      coverArt: false,
      instrumental: true,
      session: true,
      vocals: true,
    },
    id: 2,
    lastUpdated: "1 day ago",
    mastered: false,
    mixed: false,
    name: "Late Night Sessions",
    status: "in-progress",
  },
  {
    files: {
      adlibs: false,
      coverArt: true,
      instrumental: true,
      session: false,
      vocals: false,
    },
    id: 3,
    lastUpdated: "3 days ago",
    mastered: false,
    mixed: false,
    name: "Collaboration Track",
    status: "in-progress",
  },
];

export function ProjectsOverview() {
  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/40 overflow-hidden">
      <CardHeader className="border-b border-border/20 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-[family-name:var(--font-playfair)] text-xl">
              Recent Projects
            </CardTitle>
            <CardDescription className="text-xs">
              Your latest music collaborations and uploads
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-white/5"
          >
            View All
            <ChevronRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/10">
          {mockProjects.map((project) => (
            <div
              key={project.id}
              className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-white/[0.02] transition-colors gap-4"
            >
              <div className="flex items-center space-x-4 min-w-0">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform">
                    <Music className="h-6 w-6 text-primary" />
                  </div>
                  {project.status === "complete" && (
                    <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-card">
                      <CheckCircle className="size-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                    {project.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 mt-1">
                    <Badge
                      variant={
                        project.status === "complete" ? "default" : "secondary"
                      }
                      className={cn(
                        "text-[9px] uppercase tracking-wider px-1.5 h-4 font-bold",
                        project.status === "complete"
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                      )}
                    >
                      {project.status === "complete" ? "Complete" : "Working"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {project.lastUpdated}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                {/* File Status Dots */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center -space-x-1.5">
                    {Object.entries(project.files).map(([key, value], idx) => (
                      <div
                        key={key}
                        className={cn(
                          "size-2.5 rounded-full border border-card shadow-sm transition-transform hover:scale-125 hover:z-10",
                          value ? "bg-primary" : "bg-muted-foreground/20"
                        )}
                        title={key.charAt(0).toUpperCase() + key.slice(1)}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {Object.values(project.files).filter(Boolean).length}/5
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem>Edit Project</DropdownMenuItem>
                      <DropdownMenuItem>Share Stems</DropdownMenuItem>
                      <DropdownMenuItem>View Analytics</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { cn } from "@/lib/utils";
