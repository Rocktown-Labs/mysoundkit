"use client";

import { Link } from "@tanstack/react-router";
import { Music, FolderPlus, Film, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function QuickActions() {
  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] gap-2">
            <Zap className="h-4 w-4 fill-current" />
            Quickstart
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 p-2 bg-card/95 backdrop-blur-xl border-border/40"
        >
          <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold px-2 py-1.5">
            Create New
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/20" />

          <DropdownMenuItem
            asChild
            className="rounded-lg cursor-pointer focus:bg-primary/10 focus:text-primary"
          >
            <Link to="/dashboard/tracks/new" className="flex items-center p-2">
              <div className="size-8 rounded-md bg-indigo-500/10 flex items-center justify-center mr-3 text-indigo-500">
                <Music className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">New Track</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Upload audio, stems, and metadata
                </p>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="rounded-lg cursor-pointer focus:bg-primary/10 focus:text-primary mt-1"
          >
            <Link
              to="/dashboard/projects/new"
              className="flex items-center p-2"
            >
              <div className="size-8 rounded-md bg-emerald-500/10 flex items-center justify-center mr-3 text-emerald-500">
                <FolderPlus className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">New Project</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Create an Album, EP or Single
                </p>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="rounded-lg cursor-pointer focus:bg-primary/10 focus:text-primary mt-1"
          >
            <Link to="/dashboard/videos/new" className="flex items-center p-2">
              <div className="size-8 rounded-md bg-amber-500/10 flex items-center justify-center mr-3 text-amber-500">
                <Film className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">New Video</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Mux Upload or YouTube Link
                </p>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border/20 mt-2" />
          <div className="p-2 flex items-center gap-2 text-[10px] text-muted-foreground italic">
            <Sparkles className="size-3 text-primary" />
            <span>Verified uploads available for Pro+</span>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
