import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  Kanban,
  ListTodo,
  Music,
  Plus,
  Radio,
  Sparkles,
  Swords,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  useListeningPartiesQuery,
  useProjectsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/calendar")({
  component: CareerCalendarPage,
});

interface KanbanTask {
  category: "track" | "project" | "promo" | "battle";
  column: "todo" | "in_progress" | "scheduled" | "released";
  date?: string;
  id: string;
  title: string;
}

function CareerCalendarPage() {
  const { toast } = useToast();
  const projectsQuery = useProjectsQuery();
  const tracksQuery = useTracksQuery();
  const partiesQuery = useListeningPartiesQuery();

  const [activeTab, setActiveTab] = useState<"calendar" | "kanban">("calendar");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCol, setNewTaskCol] = useState<
    "todo" | "in_progress" | "scheduled" | "released"
  >("todo");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  const projects = useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data]
  );
  const tracks = useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);
  const parties = useMemo(() => partiesQuery.data ?? [], [partiesQuery.data]);

  // Initial Kanban State derived from Projects + Tracks + Custom tasks
  const [customTasks, setCustomTasks] = useState<KanbanTask[]>([
    {
      category: "promo",
      column: "in_progress",
      date: "2026-07-28",
      id: "k-1",
      title: "Record TikTok & Reels Cover Teaser",
    },
    {
      category: "battle",
      column: "todo",
      date: "2026-07-30",
      id: "k-2",
      title: "Battle 3 Top Artists in Rap Arena",
    },
    {
      category: "promo",
      column: "scheduled",
      date: "2026-08-02",
      id: "k-3",
      title: "Send Post-Battle Summary Email to Fans",
    },
  ]);

  const allKanbanTasks: KanbanTask[] = useMemo(() => {
    const projectTasks: KanbanTask[] = projects.map((p) => ({
      category: "project",
      column: p.releaseDate ? "scheduled" : "in_progress",
      date: p.releaseDate,
      id: `proj-${p.id}`,
      title: `Project Release: ${p.title}`,
    }));

    const trackTasks: KanbanTask[] = tracks.map((t) => ({
      category: "track",
      column: t.isPurchasable ? "released" : "in_progress",
      id: `track-${t.id}`,
      title: `Single Track Promo: ${t.title}`,
    }));

    return [...projectTasks, ...trackTasks, ...customTasks];
  }, [projects, tracks, customTasks]);

  const moveTask = (
    taskId: string,
    newCol: "todo" | "in_progress" | "scheduled" | "released"
  ) => {
    setCustomTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, column: newCol } : task
      )
    );
    toast({
      description: `Task updated to ${newCol.replace("_", " ").toUpperCase()}`,
      title: "Kanban Updated",
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {return;}

    setCustomTasks((current) => [
      ...current,
      {
        category: "promo",
        column: newTaskCol,
        id: `custom-${Date.now()}`,
        title: newTaskTitle.trim(),
      },
    ]);

    setNewTaskTitle("");
    setIsTaskDialogOpen(false);
    toast({
      description: "Added promotional milestone to your release Kanban board.",
      title: "Task Created 🎯",
    });
  };

  // Calendar Math
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
    }[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ dateStr: "", dayNum: 0, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const pad = (num: number) => String(num).padStart(2, "0");
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }
    return days;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Release & Promo Hub
          </h1>
          <p className="mt-1 text-muted-foreground">
            Schedule releases, manage promotional campaigns, and track artist
            milestones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="size-4" /> Add Promo Milestone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Release Promotion Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Task / Goal Title</Label>
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. Host Open Verse Challenge on TikTok"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial Kanban Column</Label>
                  <Select
                    value={newTaskCol}
                    onValueChange={(val: any) => setNewTaskCol(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do (Backlog)</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="released">Released</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Create Task
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button asChild className="gap-2">
            <Link to="/dashboard/projects/new">
              <Sparkles className="size-4" /> Schedule Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs View Selector */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="calendar" className="gap-2 font-bold">
            <CalendarIcon className="size-4" /> Interactive Calendar
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2 font-bold">
            <Kanban className="size-4" /> Release Kanban Board
          </TabsTrigger>
        </TabsList>

        {/* CALENDAR VIEW */}
        <TabsContent value="calendar" className="mt-6 space-y-6">
          <Card className="border-border/40 bg-card/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold font-[family-name:var(--font-playfair)]">
                  {selectedMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </CardTitle>
                <CardDescription>
                  Click dates or tasks to jump directly to live rooms and
                  project setup.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth(new Date(year, month - 1, 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth(new Date(year, month + 1, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground uppercase mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div key={day} className="py-2">
                      {day}
                    </div>
                  )
                )}
              </div>

              {/* Grid Days */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((cd, index) => {
                  if (!cd.isCurrentMonth) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="h-28 rounded-xl bg-muted/10 border border-transparent"
                      />
                    );
                  }

                  const matchedProjects = projects.filter(
                    (p) => p.releaseDate === cd.dateStr
                  );
                  const matchedParties = parties.filter((p) =>
                    p.scheduledStartAt.startsWith(cd.dateStr)
                  );
                  const isToday =
                    cd.dateStr === new Date().toISOString().slice(0, 10);

                  return (
                    <div
                      key={cd.dateStr}
                      className={`h-28 p-2 rounded-xl border flex flex-col justify-between transition-colors ${
                        isToday
                          ? "border-emerald-500 bg-emerald-500/5 shadow-sm"
                          : "border-border/40 bg-background/40 hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold ${isToday ? "text-emerald-500" : "text-muted-foreground"}`}
                        >
                          {cd.dayNum}
                        </span>
                        {isToday && (
                          <Badge className="bg-emerald-500 text-[8px] h-4 px-1">
                            Today
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 overflow-y-auto">
                        {matchedProjects.map((p) => (
                          <Link
                            key={p.id}
                            to="/dashboard/projects/$id"
                            params={{ id: p.id }}
                            className="block truncate rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium px-1.5 py-0.5 hover:underline"
                          >
                            💿 {p.title}
                          </Link>
                        ))}
                        {matchedParties.map((party) => (
                          <Link
                            key={party.id}
                            to="/live/parties/$id"
                            params={{ id: party.liveRoomId ?? party.id }}
                            className="block truncate rounded bg-primary/20 text-primary text-[10px] font-medium px-1.5 py-0.5 hover:underline"
                          >
                            🎙️ {party.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KANBAN BOARD VIEW */}
        <TabsContent value="kanban" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                col: "todo",
                color: "border-amber-500/40 bg-amber-500/5 text-amber-400",
                title: "1. To Do (Backlog)",
              },
              {
                col: "in_progress",
                color: "border-blue-500/40 bg-blue-500/5 text-blue-400",
                title: "2. In Progress (Promo)",
              },
              {
                col: "scheduled",
                color: "border-purple-500/40 bg-purple-500/5 text-purple-400",
                title: "3. Scheduled (Queued)",
              },
              {
                col: "released",
                color:
                  "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
                title: "4. Released & Live",
              },
            ].map((column) => {
              const columnTasks = allKanbanTasks.filter(
                (t) => t.column === column.col
              );

              return (
                <div key={column.col} className="space-y-3">
                  <div
                    className={`p-3 rounded-xl border font-bold text-xs uppercase tracking-wider flex items-center justify-between ${column.color}`}
                  >
                    <span>{column.title}</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-mono"
                    >
                      {columnTasks.length}
                    </Badge>
                  </div>

                  <div className="space-y-3 min-h-[350px] p-2 rounded-2xl border border-border/30 bg-muted/10">
                    {columnTasks.map((task) => (
                      <Card
                        key={task.id}
                        className="border-border/40 bg-card/60 shadow-sm hover:border-primary/40 transition-colors"
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-sm leading-snug">
                              {task.title}
                            </p>
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase font-bold shrink-0"
                            >
                              {task.category}
                            </Badge>
                          </div>

                          {task.date && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3 text-emerald-400" />{" "}
                              {task.date}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-border/20 text-xs">
                            <Select
                              value={task.column}
                              onValueChange={(val: any) =>
                                moveTask(task.id, val)
                              }
                            >
                              <SelectTrigger className="h-7 text-[10px] bg-background/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">
                                  In Progress
                                </SelectItem>
                                <SelectItem value="scheduled">
                                  Scheduled
                                </SelectItem>
                                <SelectItem value="released">
                                  Released
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {columnTasks.length === 0 && (
                      <div className="h-24 border border-dashed border-border/40 rounded-xl flex items-center justify-center text-xs text-muted-foreground">
                        No tasks in this column
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
