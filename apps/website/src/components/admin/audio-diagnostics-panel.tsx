import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useCreateDiagnosticJobMutation, useDiagnosticJobQuery, useDiagnosticJobsQuery, useDiagnosticTestsQuery, useSearchQuery } from '@/lib/soundkit-api-hooks';
import type { DiagnosticJob } from '@/lib/soundkit-api-hooks';
import { cn } from "@/lib/utils";

const MAX_SELECTION = 25;

interface SelectedTrack {
  artistName: string | null;
  id: string;
  title: string;
}

const verdictBadge = (verdict: string) => {
  if (verdict === "fail") {
    return <Badge variant="destructive">Fail</Badge>;
  }
  if (verdict === "warn") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/50 text-amber-600 dark:text-amber-400"
      >
        Warning
      </Badge>
    );
  }
  if (verdict === "skipped") {
    return <Badge variant="secondary">Skipped</Badge>;
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
    >
      Pass
    </Badge>
  );
};

export function AudioDiagnosticsPanel() {
  const testsQuery = useDiagnosticTestsQuery(),
    jobsQuery = useDiagnosticJobsQuery(),
    createJob = useCreateDiagnosticJobMutation(),
    [searchValue, setSearchValue] = useState(""),
    [debouncedSearch, setDebouncedSearch] = useState(""),
    [selected, setSelected] = useState<SelectedTrack[]>([]),
    [manualId, setManualId] = useState(""),
    [enabledTests, setEnabledTests] = useState<string[]>([]),
    [activeJobId, setActiveJobId] = useState<string | null>(null),
    [testsInitialized, setTestsInitialized] = useState(false),
    announcedJobRef = useRef<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  useEffect(() => {
    if (!testsInitialized && testsQuery.data && testsQuery.data.length > 0) {
      setEnabledTests(testsQuery.data.map((test) => test.id));
      setTestsInitialized(true);
    }
  }, [testsInitialized, testsQuery.data]);

  const searchQuery = useSearchQuery({
      limit: "8",
      q: debouncedSearch,
      type: "tracks",
    }),
    jobQuery = useDiagnosticJobQuery(activeJobId),
    activeJob: DiagnosticJob | undefined =
      jobQuery.data ?? jobsQuery.data?.find((job) => job.id === activeJobId);

  useEffect(() => {
    if (
      activeJob &&
      (activeJob.status === "completed" || activeJob.status === "failed") &&
      announcedJobRef.current !== activeJob.id
    ) {
      announcedJobRef.current = activeJob.id;
      if (activeJob.status === "completed") {
        const fails = activeJob.results.filter(
          (result) => result.verdict === "fail"
        ).length;
        toast({
          description: `${activeJob.results.length} tracks analyzed — ${fails} failed. Results are below.`,
          title: "Audio diagnostics complete",
        });
      } else {
        toast({
          description: activeJob.error ?? "The diagnostic job failed.",
          title: "Audio diagnostics failed",
          variant: "destructive",
        });
      }
    }
  }, [activeJob]);

  const toggleTest = (testId: string) => {
      setEnabledTests((current) =>
        current.includes(testId)
          ? current.filter((id) => id !== testId)
          : [...current, testId]
      );
    },
    addTrack = (track: SelectedTrack) => {
      setSelected((current) => {
        if (current.some((item) => item.id === track.id)) {
          return current;
        }
        if (current.length >= MAX_SELECTION) {
          toast({
            description: `Diagnostics are capped at ${MAX_SELECTION} tracks per run.`,
            title: "Selection full",
            variant: "destructive",
          });
          return current;
        }
        return [...current, track];
      });
    },
    addManualId = () => {
      const id = manualId.trim();
      if (!id) {
        return;
      }
      addTrack({ artistName: null, id, title: id });
      setManualId("");
    },
    runDiagnostics = () => {
      if (selected.length === 0 || enabledTests.length === 0) {
        return;
      }
      announcedJobRef.current = null;
      createJob.mutate(
        {
          tests: enabledTests,
          trackIds: selected.map((track) => track.id),
        },
        {
          onError: () => {
            toast({
              description: "Could not start the diagnostic job.",
              title: "Diagnostics failed to start",
              variant: "destructive",
            });
          },
          onSuccess: (job) => {
            setActiveJobId(job.id);
            toast({
              description: `Analyzing ${job.total} tracks in the background. You will be alerted here and in notifications when it finishes.`,
              title: "Diagnostics running",
            });
          },
        }
      );
    },

   searchTracks = searchQuery.data?.tracks ?? [],
    isJobActive =
      activeJob?.status === "queued" || activeJob?.status === "running",
    progressPercent =
      activeJob && activeJob.total > 0
        ? Math.round((activeJob.progressDone / activeJob.total) * 100)
        : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>New diagnostic run</CardTitle>
          <CardDescription>
            Select up to {MAX_SELECTION} tracks and the tests to run. Jobs run
            in the background — you can leave this tab and will be alerted on
            completion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="diagnostic-track-search">Find tracks</Label>
            <Input
              id="diagnostic-track-search"
              placeholder="Search the catalog by title, artist, genre…"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            {debouncedSearch.trim().length > 1 && (
              <div className="max-h-56 overflow-y-auto rounded-md border p-1">
                {searchQuery.isLoading && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Searching…
                  </p>
                )}
                {!searchQuery.isLoading && searchTracks.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No tracks found. You can also paste a track ID below.
                  </p>
                )}
                {searchTracks.map((track) => (
                  <button
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-primary/10"
                    key={track.id}
                    onClick={() =>
                      addTrack({
                        artistName: track.artistName ?? null,
                        id: track.id,
                        title: track.title,
                      })
                    }
                    type="button"
                  >
                    <span className="truncate">
                      <span className="font-medium">{track.title}</span>{" "}
                      {track.artistName && (
                        <span className="text-muted-foreground">
                          · {track.artistName}
                        </span>
                      )}
                    </span>
                    {selected.some((item) => item.id === track.id) ? (
                      <Badge variant="secondary">Added</Badge>
                    ) : (
                      <Badge variant="outline">Add</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Or paste a track ID"
                value={manualId}
                onChange={(event) => setManualId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addManualId();
                  }
                }}
              />
              <Button onClick={addManualId} type="button" variant="outline">
                Add
              </Button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="space-y-2">
              <Label>
                Selected ({selected.length}/{MAX_SELECTION})
              </Label>
              <div className="flex flex-wrap gap-2">
                {selected.map((track) => (
                  <Badge
                    className="cursor-pointer gap-1 py-1"
                    key={track.id}
                    onClick={() =>
                      setSelected((current) =>
                        current.filter((item) => item.id !== track.id)
                      )
                    }
                    variant="secondary"
                  >
                    {track.title} ✕
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tests</Label>
            <div className="space-y-2">
              {(testsQuery.data ?? []).map((test) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-primary/5"
                  key={test.id}
                >
                  <Checkbox
                    checked={enabledTests.includes(test.id)}
                    onCheckedChange={() => toggleTest(test.id)}
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {test.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {test.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button
            disabled={
              createJob.isPending ||
              selected.length === 0 ||
              enabledTests.length === 0
            }
            onClick={runDiagnostics}
          >
            {createJob.isPending
              ? "Starting…"
              : `Run diagnostics on ${selected.length} track${selected.length === 1 ? "" : "s"}`}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Active run</CardTitle>
            <CardDescription>
              Progress refreshes automatically while a job is running.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!activeJob && (
              <p className="text-sm text-muted-foreground">
                No run selected yet. Start one, or pick a recent job below.
              </p>
            )}
            {activeJob && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {activeJob.progressDone}/{activeJob.total} tracks
                  </span>
                  <Badge
                    variant={
                      activeJob.status === "completed"
                        ? "outline"
                        : (activeJob.status === "failed"
                          ? "destructive"
                          : "secondary")
                    }
                  >
                    {activeJob.status}
                  </Badge>
                </div>
                <Progress value={progressPercent} />
                {activeJob.error && (
                  <p className="text-sm text-destructive">{activeJob.error}</p>
                )}
                {isJobActive && (
                  <p className="text-xs text-muted-foreground">
                    Running in the background — safe to leave this page. A
                    notification will arrive when it finishes.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(jobsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            )}
            {(jobsQuery.data ?? []).map((job) => (
              <button
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-primary/5",
                  job.id === activeJobId && "border-primary/40 bg-primary/5"
                )}
                key={job.id}
                onClick={() => {
                  announcedJobRef.current = null;
                  setActiveJobId(job.id);
                }}
                type="button"
              >
                <span className="truncate">
                  {new Date(job.createdAt).toLocaleString()} · {job.total}{" "}
                  tracks
                </span>
                <Badge variant="secondary">{job.status}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {activeJob && activeJob.results.length > 0 && (
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              Per-track verdicts with the evidence behind each one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeJob.results.map((result) => (
              <div className="rounded-md border p-4" key={result.trackId}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{result.trackTitle}</span>
                  {verdictBadge(result.verdict)}
                </div>
                <div className="space-y-2">
                  {result.checks.map((check) => (
                    <div
                      className="flex items-start justify-between gap-3 text-sm"
                      key={check.test}
                    >
                      <span className="text-muted-foreground">
                        {check.detail}
                      </span>
                      {verdictBadge(check.verdict)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
