import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Lock,
  Maximize2,
  Minus,
  Pencil,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import {
  artistSetupProgress,
  buildArtistSetupGuideTasks,
  exploratoryArtistSetupTasks,
} from "@/lib/artist-setup-guide";
import type { ArtistSetupGuide } from "@/lib/soundkit-api-hooks";
import { usePlatformInviteMutation } from "@/lib/soundkit-api-hooks";

export function ArtistSetupGuide({
  isMinimized,
  onDismiss,
  onMinimizedChange,
  state,
}: {
  isMinimized: boolean;
  onDismiss: () => void;
  onMinimizedChange: (isMinimized: boolean) => void;
  state: ArtistSetupGuide;
}) {
  const navigate = useNavigate(),
    tasks = useMemo(() => buildArtistSetupGuideTasks(state), [state]),
    progress = useMemo(() => artistSetupProgress(tasks), [tasks]),
    [expandedTask, setExpandedTask] = useState<string | undefined>(
      () => tasks.find((task) => task.status === "available")?.id
    ),
    [isExploreExpanded, setIsExploreExpanded] = useState(false),
    [friendEmail, setFriendEmail] = useState(""),
    inviteMutation = usePlatformInviteMutation();

  useEffect(() => {
    const firstAvailable = tasks.find((task) => task.status === "available");
    if (firstAvailable && !expandedTask) {
      setExpandedTask(firstAvailable.id);
    }
  }, [expandedTask, tasks]);

  const openExplore = () => {
    onMinimizedChange(false);
    setIsExploreExpanded(true);
  };
  const inviteFriend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = friendEmail.trim();
    if (!email) {
      return;
    }
    try {
      await inviteMutation.mutateAsync(email);
      setFriendEmail("");
      toast({
        description: `An invitation was sent to ${email}.`,
        title: "Friend invited",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "We could not send that invitation.",
        title: "Invitation failed",
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      className={`w-[calc(100vw-2rem)] overflow-hidden border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl ${isMinimized ? "max-w-[320px]" : "max-w-[380px]"}`}
    >
      <CardHeader className="gap-3 border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-sm">
                {isMinimized ? "Setup guide" : "Artist setup"}
              </p>
              {!isMinimized ? (
                <p className="text-xs text-muted-foreground">
                  Build your SoundKit presence
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              aria-label="Edit artist profile"
              onClick={() => navigate({ to: "/dashboard/career/settings" })}
              size="icon"
              title="Edit profile"
              variant="ghost"
            >
              <Pencil />
            </Button>
            <Button
              aria-label={
                isMinimized ? "Expand setup guide" : "Minimize setup guide"
              }
              onClick={() => onMinimizedChange(!isMinimized)}
              size="icon"
              title={isMinimized ? "Expand" : "Minimize"}
              variant="ghost"
            >
              {isMinimized ? <Maximize2 /> : <Minus />}
            </Button>
            <Button
              aria-label="Hide setup guide"
              onClick={onDismiss}
              size="icon"
              title="Hide"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          {!isMinimized ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Your progress</span>
              <span className="font-medium">
                {progress.completed} of {progress.total} complete
              </span>
            </div>
          ) : null}
          <Progress
            aria-label={`${progress.percent}% setup complete`}
            value={progress.percent}
          />
        </div>
        {isMinimized ? (
          <Button
            className="h-auto justify-start gap-1 px-0 text-xs"
            onClick={openExplore}
            variant="ghost"
          >
            <span className="text-muted-foreground">Next:</span>
            <span className="font-medium text-primary">
              Explore what&apos;s next
            </span>
            <ChevronRight className="size-3.5" />
          </Button>
        ) : null}
      </CardHeader>

      {!isMinimized ? (
        <>
          <CardContent className="max-h-[min(48vh,460px)] overflow-y-auto p-0">
            <Accordion
              collapsible
              onValueChange={setExpandedTask}
              type="single"
              value={expandedTask}
            >
              {tasks.map((task, index) => {
                const isReferral = task.id === "referral",
                  isUpgrade =
                    task.id === "monetization" &&
                    !state.capabilities.canReceivePayouts,
                  ctaLabel =
                    task.id === "monetization"
                      ? isUpgrade
                        ? "Explore Premium"
                        : "Connect payouts"
                      : task.id === "track"
                        ? "Upload track"
                        : task.id === "publish-release"
                          ? "Open tracks"
                          : task.id === "community"
                            ? "Open community"
                            : task.id === "project"
                              ? "Create project"
                              : "Build Battle Kit",
                  taskHref = isUpgrade ? "/pricing" : task.href;

                if (task.status === "completed") {
                  return (
                    <div
                      className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-b-0"
                      key={task.id}
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-muted-foreground line-through">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Complete
                        </p>
                      </div>
                      <Badge className="shrink-0" variant="secondary">
                        Done
                      </Badge>
                    </div>
                  );
                }

                if (task.status === "locked") {
                  return (
                    <div
                      className="flex items-start gap-3 border-b border-border/40 px-4 py-2.5 opacity-70 last:border-b-0"
                      key={task.id}
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                        <Lock className="size-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {task.description}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <AccordionItem
                    className="border-b border-border/40 last:border-b-0"
                    key={task.id}
                    value={task.id}
                  >
                    <AccordionTrigger className="gap-3 px-4 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
                      <div className="flex min-w-0 items-center gap-3 text-left">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/50 text-primary">
                          <span className="text-xs font-semibold">
                            {index + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{task.title}</p>
                          {isUpgrade ? (
                            <Badge className="mt-1" variant="outline">
                              Premium opportunity
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3 pl-[52px]">
                      <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                        {task.description}
                      </p>
                      {isReferral ? (
                        <form className="flex gap-2" onSubmit={inviteFriend}>
                          <Input
                            aria-label="Friend email address"
                            onChange={(event) =>
                              setFriendEmail(event.target.value)
                            }
                            placeholder="friend@example.com"
                            type="email"
                            value={friendEmail}
                          />
                          <Button
                            aria-label="Send friend invitation"
                            disabled={
                              inviteMutation.isPending || !friendEmail.trim()
                            }
                            size="icon"
                            type="submit"
                          >
                            <Send />
                          </Button>
                        </form>
                      ) : (
                        <Button asChild size="sm">
                          <Link to={taskHref as never}>
                            {ctaLabel}
                            <ChevronRight data-icon="inline-end" />
                          </Link>
                        </Button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            <Accordion
              collapsible
              onValueChange={(value) =>
                setIsExploreExpanded(value === "explore")
              }
              type="single"
              value={isExploreExpanded ? "explore" : ""}
            >
              <AccordionItem
                className="border-t border-border/50 last:border-b-0"
                value="explore"
              >
                <AccordionTrigger className="gap-3 bg-muted/20 px-4 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
                  <div className="min-w-0 text-left">
                    <p className="font-medium text-xs">
                      Explore what&apos;s next
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Keep building beyond the essentials.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-muted/20 px-4 pb-3">
                  <div className="grid gap-1">
                    {exploratoryArtistSetupTasks.map((item) => (
                      <Link
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-xs transition-colors hover:bg-accent hover:text-foreground"
                        key={item.href}
                        to={item.href as never}
                      >
                        <span className="min-w-0">
                          <span className="block text-foreground">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-2 border-t border-border/50 px-4 py-2.5">
            <p className="text-center text-xs text-muted-foreground">
              Need a hand?{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="mailto:support@mysoundkit.com"
              >
                Talk with a SoundKit specialist
              </a>
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                You can hide this guide anytime.
              </p>
              <Button onClick={onDismiss} size="sm" variant="ghost">
                Hide guide
              </Button>
            </div>
          </CardFooter>
        </>
      ) : null}
    </Card>
  );
}
