"use client";

import { useRouter } from "@tanstack/react-router";
import {
  AudioLines,
  Calendar,
  Command as CommandIcon,
  Compass,
  FileMusic,
  HelpCircle,
  Home,
  Keyboard,
  Mic,
  Plus,
  Radio,
  Search,
  Settings,
  Megaphone,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutDef {
  category: "Navigation" | "Playback" | "General";
  description: string;
  keys: string[];
}

const SHORTCUT_LIST: ShortcutDef[] = [
  {
    category: "General",
    description: "Open Global Command Search",
    keys: ["⌘", "K"],
  },
  {
    category: "General",
    description: "Show Keyboard Shortcuts Guide",
    keys: ["?"],
  },
  {
    category: "Playback",
    description: "Toggle Play / Pause",
    keys: ["Space"],
  },
  {
    category: "Playback",
    description: "Next Track in Queue",
    keys: ["Shift", "→"],
  },
  {
    category: "Playback",
    description: "Previous Track in Queue",
    keys: ["Shift", "←"],
  },
  {
    category: "Playback",
    description: "Toggle Audio Mute",
    keys: ["M"],
  },
  {
    category: "Navigation",
    description: "Go to Dashboard Home",
    keys: ["G", "H"],
  },
  {
    category: "Navigation",
    description: "Go to Ads",
    keys: ["G", "A"],
  },
  {
    category: "Navigation",
    description: "Go to Open Verses",
    keys: ["G", "O"],
  },
];

interface KeyboardShortcutsContextValue {
  isSearchOpen: boolean;
  isShortcutsOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  setIsShortcutsOpen: (open: boolean) => void;
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null);

export function KeyboardShortcutsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter(),
    [isSearchOpen, setIsSearchOpen] = useState(false),
    [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Global keydown handler with input guard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null,
        isInput =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable);

      // Cmd+K or Ctrl+K opens search anywhere (even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      // Ignore remaining shortcuts if user is typing in an input
      if (isInput) {
        return;
      }

      // '?' opens shortcuts dialog
      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectRoute = useCallback(
      (path: string) => {
        setIsSearchOpen(false);
        void router.navigate({ to: path });
      },
      [router]
    ),
    value = useMemo(
      () => ({
        isSearchOpen,
        isShortcutsOpen,
        setIsSearchOpen,
        setIsShortcutsOpen,
      }),
      [isSearchOpen, isShortcutsOpen]
    );

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}

      {/* Global Command Palette (Cmd+K) */}
      <CommandDialog
        description="Type a command or search SoundKit routes..."
        onOpenChange={setIsSearchOpen}
        open={isSearchOpen}
        title="SoundKit Command Palette"
      >
        <CommandInput placeholder="Search tracks, open verses, features, or jump to page..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Navigation">
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/career")}
            >
              <Home className="mr-2 size-4 text-primary" />
              <span>Dashboard Home</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/career/ai-studio")}
            >
              <Megaphone className="mr-2 size-4 text-purple-400" />
              <span>Ads Manager & Campaign Builder</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/tracks")}
            >
              <FileMusic className="mr-2 size-4 text-blue-400" />
              <span>Track Manager & Releases</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/open-verses")}
            >
              <Mic className="mr-2 size-4 text-emerald-400" />
              <span>Open Verse Arena & Submissions</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/live/challenge")}
            >
              <Trophy className="mr-2 size-4 text-amber-400" />
              <span>Live Battle Challenges</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/collaborators")}
            >
              <Users className="mr-2 size-4 text-pink-400" />
              <span>Collaborators & Splits</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/career/settings")}
            >
              <Settings className="mr-2 size-4 text-muted-foreground" />
              <span>Settings & Profile</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions & Tools">
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/tracks")}
            >
              <Plus className="mr-2 size-4 text-emerald-500" />
              <span>Upload New Track / Beat</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/dashboard/live/index")}
            >
              <Radio className="mr-2 size-4 text-red-500" />
              <span>Start Live Room / Listening Party</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelectRoute("/_explore/live/preview")}
            >
              <Compass className="mr-2 size-4 text-sky-400" />
              <span>Explore Live Preview Showcase</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Keyboard Shortcuts Help Dialog (?) */}
      <Dialog onOpenChange={setIsShortcutsOpen} open={isShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Keyboard className="size-5 text-primary" />
              Keyboard Shortcuts Guide
            </DialogTitle>
            <DialogDescription>
              Control SoundKit fast with cross-platform key bindings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {(["General", "Playback", "Navigation"] as const).map((cat) => {
              const items = SHORTCUT_LIST.filter((s) => s.category === cat);
              if (items.length === 0) {
                return null;
              }
              return (
                <div className="space-y-2" key={cat}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat}
                  </h4>
                  <div className="space-y-1.5 rounded-lg border p-2 bg-muted/30">
                    {items.map((item) => (
                      <div
                        className="flex items-center justify-between py-1 text-sm"
                        key={item.description}
                      >
                        <span className="text-muted-foreground">
                          {item.description}
                        </span>
                        <div className="flex gap-1">
                          {item.keys.map((k) => (
                            <kbd
                              className="inline-flex h-5 items-center justify-center rounded border bg-background px-1.5 text-[11px] font-semibold text-foreground shadow-xs"
                              key={k}
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </KeyboardShortcutsContext.Provider>
  );
}

export const useKeyboardShortcuts = () => {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error(
      "useKeyboardShortcuts must be used inside KeyboardShortcutsProvider."
    );
  }
  return ctx;
};
