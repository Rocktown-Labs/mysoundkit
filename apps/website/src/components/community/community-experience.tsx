/* eslint-disable one-var, sort-vars, complexity */
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  Hash,
  LockKeyhole,
  MessageCircle,
  Newspaper,
  Send,
  Settings2,
  Shield,
  ShieldMinus,
  ShieldPlus,
  UserMinus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiClient, rpcJson } from "@/lib/api";
import type { DbCommunity, DbCommunityMember } from "@/lib/data-db";
import {
  useCreateDbCommunityPost,
  useDbCommunity,
  useDbCommunityActions,
  useDbCommunityBans,
  useDbCommunityMembers,
  useDbCommunityMessages,
  useDbCommunityModeration,
  useDbCommunityPosts,
  useSendDbCommunityMessage,
} from "@/lib/data-db";
import {
  useMeQuery,
  useNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

type CommunityChannel = "chat" | "members" | "updates";
type CommunityNotificationKey = "communityMentions" | "communityPosts";

const defaultCommunitySearch = {
    access: "all",
    genre: "all",
    q: "",
    sort: "activity-desc",
    view: "sections",
  } as const,
  channels: {
    icon: typeof Hash;
    id: CommunityChannel;
    label: string;
  }[] = [
    { icon: Newspaper, id: "updates", label: "updates" },
    { icon: MessageCircle, id: "chat", label: "community-chat" },
    { icon: Users, id: "members", label: "members" },
  ],
  formatChatTimestamp = (value: string) => {
    const date = new Date(value),
      now = new Date(),
      isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  },
  communityCheckoutPost = apiClient.v1["community-billing"].checkout.$post,
  beginPaidCommunityCheckout = async (communityId: string) => {
    const payload = await rpcJson(
      await communityCheckoutPost({
        json: {
          cancelUrl: window.location.href,
          communityId,
          successUrl: window.location.href,
        },
      })
    );
    if (!payload.checkoutUrl) {
      throw new Error("Community checkout is unavailable.");
    }
    window.location.assign(payload.checkoutUrl);
  };

export function CommunityExperience({
  backTo,
  communityId,
  creatorMode = false,
  ownerActions,
}: {
  /** Optional route the header back button navigates to (e.g. /communities). */
  backTo?: string;
  communityId: string;
  creatorMode?: boolean;
  /** Owner-only actions rendered in the community header (e.g. membership settings). */
  ownerActions?: ReactNode;
}) {
  const { community, isLoading, status } = useDbCommunity(communityId),
    meQuery = useMeQuery(),
    navigate = useNavigate(),
    { joinFree } = useDbCommunityActions(),
    [isJoining, setIsJoining] = useState(false),
    [hasJoined, setHasJoined] = useState(false),
    [joinPromptOpen, setJoinPromptOpen] = useState(false);

  useEffect(() => {
    if (
      community &&
      !community.isMember &&
      !hasJoined &&
      !community.isOwner &&
      !creatorMode
    ) {
      setJoinPromptOpen(true);
    }
  }, [community, creatorMode, hasJoined]);

  if (isLoading || status === "idle" || status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Loading community…
      </div>
    );
  }
  if (!community) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-4 p-8 text-center">
            <h1 className="font-semibold text-xl">Community not found</h1>
            <Button asChild variant="outline">
              <Link search={defaultCommunitySearch} to="/communities">
                Browse communities
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const joinCommunity = async () => {
    if (!meQuery.data?.user) {
      await navigate({
        search: { redirect: `/communities/${community.id}` },
        to: "/login",
      });
      return;
    }
    setIsJoining(true);
    try {
      if (community.monthlyPriceCents === 0) {
        const transaction = joinFree(community.id);
        await transaction.isPersisted.promise;
        setHasJoined(true);
      } else {
        await beginPaidCommunityCheckout(community.id);
      }
    } catch (error) {
      setIsJoining(false);
      toast({
        description:
          error instanceof Error ? error.message : "Unable to join community.",
        title: "Community unavailable",
        variant: "destructive",
      });
      return;
    }
    setIsJoining(false);
    if (community.monthlyPriceCents === 0) {
      setJoinPromptOpen(false);
      toast({
        description: `Welcome to ${community.name}.`,
        title: "Community joined",
      });
    }
  };

  if (!(community.isMember || hasJoined || community.isOwner || creatorMode)) {
    return (
      <div className="h-full w-full overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <CommunityJoinCard
            community={community}
            isJoining={isJoining}
            onJoin={() => setJoinPromptOpen(true)}
          />
        </div>
        <CommunityJoinDialog
          community={community}
          isJoining={isJoining}
          onConfirm={joinCommunity}
          onOpenChange={setJoinPromptOpen}
          open={joinPromptOpen}
        />
      </div>
    );
  }

  const user = meQuery.data?.user;
  if (!user) {
    return null;
  }

  return (
    <CommunityMemberExperience
      backTo={backTo}
      community={community}
      currentUser={{
        avatarUrl: user.avatarUrl,
        id: user.id,
        name: user.displayName,
        username: user.username,
      }}
      ownerActions={ownerActions}
    />
  );
}

function CommunityJoinCard({
  community,
  isJoining,
  onJoin,
}: {
  community: DbCommunity;
  isJoining: boolean;
  onJoin: () => void;
}) {
  const price =
    community.monthlyPriceCents === 0
      ? "Free"
      : `${new Intl.NumberFormat("en-US", {
          currency: community.currency,
          style: "currency",
        }).format(community.monthlyPriceCents / 100)}/month`;
  return (
    <Card className="mx-auto max-w-3xl overflow-hidden">
      <div className="h-40 bg-gradient-to-br from-primary/35 via-accent/15 to-background" />
      <CardContent className="-mt-10 space-y-6 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge className="mb-3" variant="secondary">
              {community.genre?.name ?? "Artist community"}
            </Badge>
            <h1 className="font-bold text-3xl">{community.name}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {community.description ??
                `Join ${community.artist.name}'s private SoundKit community.`}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-semibold text-xl">{price}</p>
            <p className="text-muted-foreground text-xs">
              {community.memberCount.toLocaleString()} members
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={isJoining} onClick={onJoin} size="lg">
            {community.monthlyPriceCents > 0 ? (
              <LockKeyhole data-icon="inline-start" />
            ) : (
              <Users data-icon="inline-start" />
            )}
            {isJoining ? "Joining…" : "Join Community"}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link search={defaultCommunitySearch} to="/communities">
              Back to discovery
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CommunityJoinDialog({
  community,
  isJoining,
  onConfirm,
  onOpenChange,
  open,
}: {
  community: DbCommunity;
  isJoining: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const price =
    community.monthlyPriceCents === 0
      ? "Free"
      : `${new Intl.NumberFormat("en-US", {
          currency: community.currency,
          style: "currency",
        }).format(community.monthlyPriceCents / 100)}/month`;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Join {community.name}?</DialogTitle>
          <DialogDescription>
            Confirm that you want access to this artist-led community. You can
            manage your community notifications after joining.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Membership</span>
            <Badge variant="secondary">{price}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {community.description ??
              "Get creator updates, community chat, and member access in one place."}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Not now
          </Button>
          <Button disabled={isJoining} onClick={onConfirm}>
            {isJoining
              ? "Joining…"
              : community.monthlyPriceCents > 0
                ? "Continue to checkout"
                : "Join for free"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommunityMemberExperience({
  backTo,
  community,
  currentUser,
  ownerActions,
}: {
  backTo?: string;
  community: DbCommunity;
  currentUser: {
    avatarUrl?: string | null;
    id: string;
    name: string;
    username: string;
  };
  ownerActions?: ReactNode;
}) {
  const [channel, setChannel] = useState<CommunityChannel>("chat"),
    { data: members } = useDbCommunityMembers(community.id),
    notificationSettingsQuery = useNotificationSettingsQuery(),
    updateNotificationSettings = useUpdateNotificationSettingsMutation(),
    [communityNotifications, setCommunityNotifications] = useState({
      communityMentions: true,
      communityPosts: true,
    }),
    [mobilePanelOpen, setMobilePanelOpen] = useState(false),
    canModerate = community.isOwner;

  useEffect(() => {
    const settings = notificationSettingsQuery.data;
    if (!settings) {
      return;
    }
    setCommunityNotifications({
      communityMentions: settings.communityMentions,
      communityPosts: settings.communityPosts,
    });
  }, [
    notificationSettingsQuery.data?.communityMentions,
    notificationSettingsQuery.data?.communityPosts,
  ]);

  const updateCommunityNotification = async (
    key: CommunityNotificationKey,
    checked: boolean
  ) => {
    const previous = communityNotifications[key];
    setCommunityNotifications((current) => ({ ...current, [key]: checked }));
    try {
      await updateNotificationSettings.mutateAsync({ [key]: checked });
    } catch (error) {
      setCommunityNotifications((current) => ({ ...current, [key]: previous }));
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Community notification setting could not be saved.",
        title: "Settings unavailable",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b px-3 py-2.5 md:px-4">
        {backTo ? (
          <Button
            aria-label="Back to communities"
            asChild
            className="size-8 shrink-0 rounded-full"
            size="icon"
            variant="ghost"
          >
            <Link to={backTo}>
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
        ) : null}
        <div className="relative shrink-0">
          <Avatar className="size-9 border">
            <AvatarImage
              alt={`${community.artist.name} profile photo`}
              src={community.artist.avatarUrl ?? undefined}
            />
            <AvatarFallback>
              {community.artist.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-semibold text-sm">{community.name}</h1>
            {community.isOwner ? (
              <Badge
                className="shrink-0 px-1.5 py-0 text-[10px]"
                variant="secondary"
              >
                Owner
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-muted-foreground text-xs">
            {community.memberCount.toLocaleString()} members
            {community.genre ? ` · ${community.genre.name}` : ""}
          </p>
        </div>
        {ownerActions ? (
          <div className="flex shrink-0 items-center gap-2">{ownerActions}</div>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[240px_1fr_280px]">
        <aside className="flex shrink-0 flex-col border-b bg-muted/30 lg:min-h-0 lg:border-b-0 lg:border-r">
          <nav
            aria-label="Community channels"
            className="flex items-center gap-1 overflow-x-auto p-2 lg:block lg:space-y-1"
          >
            {channels.map(({ icon: Icon, id, label }) => (
              <button
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors lg:w-full",
                  channel === id
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                key={id}
                onClick={() => setChannel(id)}
                type="button"
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
            <button
              aria-expanded={mobilePanelOpen}
              aria-label="Community notification settings"
              className={cn(
                "ml-auto flex shrink-0 items-center rounded-md p-2 lg:hidden",
                mobilePanelOpen
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={() => setMobilePanelOpen((open) => !open)}
              type="button"
            >
              <Settings2 className="size-4" />
            </button>
          </nav>
          <div
            className={cn(
              "border-t px-3 pb-4 pt-3 lg:block",
              mobilePanelOpen ? "block" : "hidden"
            )}
          >
            <p className="mb-3 text-muted-foreground text-[10px] uppercase tracking-wider">
              Notifications
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs">Creator posts</span>
                <Switch
                  aria-label="Receive creator post notifications"
                  checked={communityNotifications.communityPosts}
                  disabled={
                    notificationSettingsQuery.isLoading ||
                    updateNotificationSettings.isPending
                  }
                  onCheckedChange={(checked) =>
                    void updateCommunityNotification("communityPosts", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs">Chat mentions</span>
                <Switch
                  aria-label="Receive community mention notifications"
                  checked={communityNotifications.communityMentions}
                  disabled={
                    notificationSettingsQuery.isLoading ||
                    updateNotificationSettings.isPending
                  }
                  onCheckedChange={(checked) =>
                    void updateCommunityNotification(
                      "communityMentions",
                      checked
                    )
                  }
                />
              </div>
            </div>
          </div>
          {community.isOwner ? (
            <div
              className={cn(
                "border-t px-3 pb-4 pt-3 lg:block",
                mobilePanelOpen ? "block" : "hidden"
              )}
            >
              <Button
                asChild
                className="w-full justify-start"
                size="sm"
                variant="ghost"
              >
                <Link to="/dashboard/community">
                  <Shield data-icon="inline-start" />
                  Creator controls
                </Link>
              </Button>
            </div>
          ) : null}
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
          {channel === "chat" ? (
            <CommunityChat community={community} currentUser={currentUser} />
          ) : null}
          {channel === "updates" ? (
            <CommunityUpdates community={community} currentUser={currentUser} />
          ) : null}
          {channel === "members" ? (
            <CommunityMembers
              canModerate={canModerate}
              community={community}
              currentUserId={currentUser.id}
              members={members}
            />
          ) : null}
        </section>

        <aside className="hidden border-l bg-muted/20 lg:block lg:min-h-0 lg:overflow-y-auto lg:p-3">
          <p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Members — {members.length}
          </p>
          <div className="space-y-2">
            {members.slice(0, 18).map((member) => (
              <MemberIdentity key={member.userId} member={member} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CommunityChat({
  community,
  currentUser,
}: {
  community: DbCommunity;
  currentUser: {
    avatarUrl?: string | null;
    id: string;
    name: string;
    username: string;
  };
}) {
  const { data: messages, isLoading } = useDbCommunityMessages(community.id),
    send = useSendDbCommunityMessage(community.id, currentUser),
    [draft, setDraft] = useState(""),
    [settledDraft, setSettledDraft] = useState(""),
    endRef = useRef<HTMLDivElement>(null),
    isTyping = Boolean(draft.trim()) && draft !== settledDraft;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    // The message count intentionally triggers scrolling to the newest message.
    // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [messages.length]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSettledDraft(draft), 700);
    return () => window.clearTimeout(timeoutId);
  }, [draft]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) {
      return;
    }
    setDraft("");
    const transaction = send(body);
    try {
      await transaction.isPersisted.promise;
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Message was not sent.",
        title: "Chat unavailable",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-2.5">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <Hash className="size-4 text-muted-foreground" /> community-chat
        </h2>
        <p className="text-muted-foreground text-xs">
          Keep conversation useful, welcoming, and on topic.
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading messages…</p>
          ) : null}
          {!isLoading && messages.length === 0 ? (
            <div className="py-12 text-center">
              <MessageCircle className="mx-auto mb-3 size-8 text-muted-foreground/30" />
              <p className="font-medium text-sm">No messages yet</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Say hello and get the conversation started.
              </p>
            </div>
          ) : null}
          {messages.map((message) => {
            const mine = message.author.username === currentUser.username;

            return (
              <div
                className={cn("flex", mine ? "justify-end" : "justify-start")}
                key={message.id}
              >
                {mine ? (
                  <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2 text-primary-foreground">
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.body}
                    </p>
                    <p className="mt-0.5 text-right text-[10px] opacity-70">
                      {formatChatTimestamp(message.createdAt)}
                    </p>
                  </div>
                ) : (
                  <div className="flex max-w-[85%] items-start gap-2">
                    <Avatar className="mt-auto size-6 shrink-0">
                      <AvatarImage
                        src={message.author.avatarUrl ?? undefined}
                      />
                      <AvatarFallback>
                        {message.author.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-xs">
                          {message.author.name}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {formatChatTimestamp(message.createdAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2">
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {message.body}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 rounded-full border bg-muted/40 p-1.5 pl-4">
          <Input
            aria-label={`Message ${community.name}`}
            className="h-8 border-0 bg-transparent px-0 text-sm"
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={`Message ${community.name}`}
            value={draft}
          />
          <Button
            aria-label="Send message"
            className="size-9 shrink-0 rounded-full shadow-lg shadow-primary/20"
            disabled={!draft.trim()}
            onClick={submit}
            size="icon"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-1 h-4 text-muted-foreground text-[10px]">
          {isTyping
            ? "Typing…"
            : "Messages send immediately and bursts are queued."}
        </p>
      </div>
    </div>
  );
}

function CommunityUpdates({
  community,
  currentUser,
}: {
  community: DbCommunity;
  currentUser: {
    avatarUrl?: string | null;
    id: string;
    name: string;
    username: string;
  };
}) {
  const { data: posts, isLoading } = useDbCommunityPosts(community.id),
    createPost = useCreateDbCommunityPost(community.id, currentUser),
    [draft, setDraft] = useState(""),
    submitPost = async () => {
      const body = draft.trim();
      if (!body) {
        return;
      }
      setDraft("");
      try {
        await createPost(body).isPersisted.promise;
      } catch {
        toast({
          title: "Update could not be posted",
          variant: "destructive",
        });
      }
    };
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="space-y-5 p-4 md:p-5">
        <div>
          <h2 className="font-semibold text-lg">Community updates</h2>
          <p className="text-muted-foreground text-sm">
            Longer announcements and conversations that should not get lost in
            chat.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-3 p-4">
            <Textarea
              aria-label="Write a community update"
              maxLength={10_000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Share an update with the community…"
              value={draft}
            />
            <div className="flex justify-end">
              <Button disabled={!draft.trim()} onClick={submitPost}>
                Post update
              </Button>
            </div>
          </CardContent>
        </Card>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading updates…</p>
        ) : null}
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={post.author.avatarUrl ?? undefined} />
                  <AvatarFallback>
                    {post.author.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm">{post.author.name}</CardTitle>
                  <p className="text-muted-foreground text-xs">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
                {post.isPinned ? (
                  <Badge className="ml-auto">Pinned</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{post.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CommunityMembers({
  canModerate,
  community,
  currentUserId,
  members,
}: {
  canModerate: boolean;
  community: DbCommunity;
  currentUserId: string;
  members: DbCommunityMember[];
}) {
  const moderation = useDbCommunityModeration(community.id);
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="space-y-6 p-4 md:p-5">
        <div>
          <h2 className="font-semibold text-lg">Members</h2>
          <p className="text-muted-foreground text-sm">
            {canModerate
              ? "Manage access without cluttering the member experience."
              : "People sharing this community with you."}
          </p>
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              key={member.userId}
            >
              <MemberIdentity member={member} />
              {canModerate &&
              member.userId !== currentUserId &&
              member.role !== "owner" ? (
                <MemberActions member={member} moderation={moderation} />
              ) : null}
            </div>
          ))}
        </div>
        {community.isOwner ? (
          <CommunityBanList
            communityId={community.id}
            moderation={moderation}
          />
        ) : null}
      </div>
    </div>
  );
}

function CommunityBanList({
  communityId,
  moderation,
}: {
  communityId: string;
  moderation: ReturnType<typeof useDbCommunityModeration>;
}) {
  const { data: bans } = useDbCommunityBans(communityId);
  if (bans.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3 border-t pt-5">
      <h3 className="flex items-center gap-2 font-semibold text-sm">
        <Ban className="size-4" /> Banned members
      </h3>
      {bans.map((ban) => (
        <div
          className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"
          key={ban.userId}
        >
          <Avatar className="size-8">
            <AvatarImage src={ban.avatarUrl ?? undefined} />
            <AvatarFallback>
              {ban.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{ban.name}</p>
            <p className="truncate text-muted-foreground text-xs">
              {ban.reason ?? "No reason supplied"}
            </p>
          </div>
          <Button
            onClick={() => moderation.unban(ban.userId)}
            size="sm"
            variant="outline"
          >
            Unban
          </Button>
        </div>
      ))}
    </div>
  );
}

function MemberActions({
  member,
  moderation,
}: {
  member: DbCommunityMember;
  moderation: ReturnType<typeof useDbCommunityModeration>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Manage ${member.name}`}
          className="ml-auto"
          size="icon"
          variant="ghost"
        >
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            moderation.setRole({
              role: member.role === "moderator" ? "member" : "moderator",
              userId: member.userId,
            })
          }
        >
          {member.role === "moderator" ? <ShieldMinus /> : <ShieldPlus />}
          {member.role === "moderator" ? "Remove moderator" : "Make moderator"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => moderation.remove(member.userId)}>
          <UserMinus /> Remove member
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() =>
            moderation.ban({ member, reason: "Removed by community owner" })
          }
        >
          <Ban /> Ban member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemberIdentity({ member }: { member: DbCommunityMember }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8">
        <AvatarImage src={member.avatarUrl ?? undefined} />
        <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium text-sm">{member.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          @{member.username}
        </p>
      </div>
      {member.role === "member" ? null : (
        <Badge className="ml-auto" variant="outline">
          {member.role}
        </Badge>
      )}
    </div>
  );
}
