/* eslint-disable one-var, sort-vars, complexity */
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  ChevronDown,
  Hash,
  LockKeyhole,
  MessageCircle,
  Newspaper,
  Send,
  Shield,
  ShieldMinus,
  ShieldPlus,
  UserMinus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  communityId,
  creatorMode = false,
}: {
  communityId: string;
  creatorMode?: boolean;
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
      <div className="py-16 text-center text-muted-foreground">
        Loading community…
      </div>
    );
  }
  if (!community) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="font-semibold text-xl">Community not found</h1>
          <Button asChild variant="outline">
            <Link search={defaultCommunitySearch} to="/communities">
              Browse communities
            </Link>
          </Button>
        </CardContent>
      </Card>
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
      <>
        <CommunityJoinCard
          community={community}
          isJoining={isJoining}
          onJoin={() => setJoinPromptOpen(true)}
        />
        <CommunityJoinDialog
          community={community}
          isJoining={isJoining}
          onConfirm={joinCommunity}
          onOpenChange={setJoinPromptOpen}
          open={joinPromptOpen}
        />
      </>
    );
  }

  const user = meQuery.data?.user;
  if (!user) {
    return null;
  }

  return (
    <CommunityMemberExperience
      community={community}
      currentUser={{
        avatarUrl: user.avatarUrl,
        id: user.id,
        name: user.displayName,
        username: user.username,
      }}
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
  const [channel, setChannel] = useState<CommunityChannel>("chat"),
    { data: members } = useDbCommunityMembers(community.id),
    notificationSettingsQuery = useNotificationSettingsQuery(),
    updateNotificationSettings = useUpdateNotificationSettingsMutation(),
    [communityNotifications, setCommunityNotifications] = useState({
      communityMentions: true,
      communityPosts: true,
    }),
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
    <div className="overflow-hidden rounded-xl border bg-card/40 shadow-xl">
      <header className="flex flex-col gap-4 border-b bg-gradient-to-r from-primary/10 via-background to-accent/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 border-2 border-primary/30">
            <AvatarImage
              alt={`${community.artist.name} profile photo`}
              src={community.artist.avatarUrl ?? undefined}
            />
            <AvatarFallback>
              {community.artist.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider">
              Artist community
            </p>
            <h1 className="truncate font-bold text-xl">{community.name}</h1>
            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
              {community.description ??
                `Updates and conversation from ${community.artist.name}.`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{community.memberCount.toLocaleString()} members</Badge>
          {community.genre ? <Badge variant="outline">{community.genre.name}</Badge> : null}
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-13rem)] flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="border-b bg-muted/30 p-3 lg:border-b-0 lg:border-r">
          <div className="mb-4 rounded-lg bg-primary/10 p-3">
            <p className="truncate font-semibold">{community.name}</p>
            <p className="mt-1 truncate text-muted-foreground text-xs">
              {community.memberCount.toLocaleString()} members
            </p>
          </div>
          <nav
            aria-label="Community channels"
            className="flex gap-1 overflow-x-auto lg:block lg:space-y-1"
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
          </nav>
          <div className="mt-5 border-t pt-4">
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
            <div className="mt-5 border-t pt-4">
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

        <section className="min-w-0 bg-background/40">
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

        <aside className="hidden border-l bg-muted/20 p-4 lg:block">
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
    <div className="flex h-[70vh] min-h-[560px] flex-col">
      <div className="border-b px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Hash className="size-5 text-muted-foreground" /> community-chat
        </h2>
        <p className="text-muted-foreground text-xs">
          Keep conversation useful, welcoming, and on topic.
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-5 py-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading messages…</p>
        ) : null}
        <div className="space-y-5">
          {messages.map((message) => (
            <div className="flex items-start gap-3" key={message.id}>
              <Avatar className="size-9">
                <AvatarImage src={message.author.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {message.author.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-sm">
                    {message.author.name}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {message.body}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            aria-label={`Message ${community.name}`}
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
          <Button aria-label="Send message" onClick={submit} size="icon">
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
    <div className="space-y-5 p-5">
      <div>
        <h2 className="font-semibold text-xl">Community updates</h2>
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
              {post.isPinned ? <Badge className="ml-auto">Pinned</Badge> : null}
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{post.body}</p>
          </CardContent>
        </Card>
      ))}
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
    <div className="space-y-6 p-5">
      <div>
        <h2 className="font-semibold text-xl">Members</h2>
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
        <CommunityBanList communityId={community.id} moderation={moderation} />
      ) : null}
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
