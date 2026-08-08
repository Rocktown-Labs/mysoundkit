import { Link,useRouterState } from "@tanstack/react-router";
import {
  Home,
  Music,
  FolderOpen,
  MessageSquare,
  Plus,
  BarChart3,
} from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const navigation = [
  { icon: Home, name: "Home", to: "/dashboard" },
  { icon: Music, name: "Music", to: "/dashboard/music" },
  { icon: BarChart3, name: "Analytics", to: "/dashboard/career/analytics" },
  { icon: MessageSquare, name: "Messages", to: "/dashboard/messages" },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around h-16">
        {navigation.slice(0, 2).map((item) => (
          <Link
            key={item.name}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs transition-colors",
              pathname === item.to ||
                (item.to === "/dashboard/music" &&
                  (pathname.startsWith("/dashboard/tracks") ||
                    pathname.startsWith("/dashboard/projects")))
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="size-5" />
            <span>{item.name}</span>
          </Link>
        ))}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs">
              <div className="flex items-center justify-center size-12 -mt-6 rounded-full bg-primary text-primary-foreground shadow-lg">
                <Plus className="size-6" />
              </div>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New</DialogTitle>
              <DialogDescription>
                Choose what you'd like to create
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Link
                to="/dashboard/tracks/new"
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
                onClick={() => setOpen(false)}
              >
                <Music className="size-8 text-primary" />
                <div>
                  <p className="font-semibold">New Track</p>
                  <p className="text-sm text-muted-foreground">
                    Create a single song
                  </p>
                </div>
              </Link>
              <Link
                to="/dashboard/projects/new"
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
                onClick={() => setOpen(false)}
              >
                <FolderOpen className="size-8 text-primary" />
                <div>
                  <p className="font-semibold">New Project</p>
                  <p className="text-sm text-muted-foreground">
                    Create an Album or EP
                  </p>
                </div>
              </Link>
            </div>
          </DialogContent>
        </Dialog>

        {navigation.slice(2).map((item) => (
          <Link
            key={item.name}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs transition-colors",
              pathname === item.to ||
                (item.to === "/dashboard/career/analytics" &&
                  pathname.startsWith("/dashboard/career"))
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="size-5" />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
