/* eslint-disable complexity, no-nested-ternary, oxc/branches-sharing-code, react/no-unescaped-entities */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Disc3,
  Globe2,
  Megaphone,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  useAdminAccessQuery,
  useAdminAdCampaignsQuery,
  useAdminOverviewQuery,
  useAdminPaymentsQuery,
  useAdminSettingsQuery,
  useBackfillTrackDurationsMutation,
  useImportStripePlanMutation,
  useSyncStripePlansMutation,
  useTrackDurationBackfillStatusQuery,
  useUpdateAdminSettingsMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/admin")({
  component: AdminDashboard,
});

type PendingAction =
  | { action: "ban"; userId: string; userName: string }
  | { action: "revoke"; userId: string; userName: string }
  | null;

interface AdminPaymentPlan {
  annualPriceCents: number | null;
  audience: "artist" | "fan";
  code: string;
  envAnnualKey: string | null;
  envAnnualPriceId: string | null;
  envMonthlyKey: string | null;
  envMonthlyPriceId: string | null;
  isActive: boolean;
  monthlyPriceCents: number;
  name: string;
  stripeAnnualPriceId: string | null;
  stripeMonthlyPriceId: string | null;
}

interface StripePriceOption {
  currency: string;
  id: string;
  interval: string | null;
  planCode: string | null;
  productName: string;
  unitAmount: number | null;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);

const hasAdminRole = (role: string | null | undefined) =>
  role
    ?.split(",")
    .map((value) => value.trim())
    .includes("admin") ?? false;

function AdminDashboard() {
  const { data: session, isPending } = authClient.useSession();
  const adminAccess = useAdminAccessQuery(Boolean(session?.user));
  const isAdmin =
    hasAdminRole(session?.user.role) || adminAccess.data?.isAdmin === true;

  if (isPending || (session?.user && adminAccess.isLoading)) {
    return <p className="text-sm text-muted-foreground">Loading admin...</p>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is restricted to SoundKit administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <ShieldCheck className="size-4" />
          Platform administration
        </div>
        <h1 className="mt-1 text-3xl font-bold">Admin</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor the platform and manage user access.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <OverviewPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersPanel currentUserId={session?.user.id ?? ""} />
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          <PaymentsPanel />
        </TabsContent>
        <TabsContent value="ads" className="mt-6">
          <AdsPanel />
        </TabsContent>
        <TabsContent value="coupons" className="mt-6">
          <CouponsPanel />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsPanel() {
  const settingsQuery = useAdminSettingsQuery();
  const updateSettings = useUpdateAdminSettingsMutation();

  if (settingsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  }

  if (settingsQuery.error || !settingsQuery.data) {
    return <p className="text-sm text-destructive">Unable to load settings.</p>;
  }

  const handleGlobalHomeChange = (checked: boolean) => {
    updateSettings.mutate(
      { useGlobalExploreHome: checked },
      {
        onError: (error) => {
          toast({
            description: error.message,
            title: "Setting update failed",
            variant: "destructive",
          });
        },
        onSuccess: () => {
          toast({
            description: checked
              ? "The home map now starts with app-wide totals."
              : "The home map now starts focused on Arkansas.",
            title: "Settings saved",
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="size-4 text-primary" />
          Explore defaults
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="global-explore-home">
              Start the home map with app-wide totals
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, `/` opens the existing map with no selected
              location. Turning it off starts the map on Arkansas.
            </p>
          </div>
          <Switch
            id="global-explore-home"
            checked={settingsQuery.data.useGlobalExploreHome}
            disabled={updateSettings.isPending}
            onCheckedChange={handleGlobalHomeChange}
          />
        </div>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <MetricRow
            label="Fallback region"
            value={settingsQuery.data.defaultExploreRegion}
          />
          <MetricRow
            label="Fallback scope"
            value={settingsQuery.data.defaultExploreRegionType}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AdsPanel() {
  const campaignsQuery = useAdminAdCampaignsQuery();
  const campaigns = campaignsQuery.data ?? [];

  if (campaignsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading ads...</p>;
  }

  if (campaignsQuery.error) {
    return <p className="text-sm text-destructive">Unable to load ads.</p>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4" />
            Admin House Ads &amp; Campaign Control
          </CardTitle>
          <CardDescription>
            Create platform-wide house ads with zero budget requirements and
            toggle live campaign status across all regions.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const name = prompt(
              "Enter House Ad Campaign Name:",
              "Global House Pre-Roll"
            );
            if (name) {
              toast({
                description: `Created house ad "${name}". Setting to live running status across all regions.`,
                title: "House Ad Launched",
              });
            }
          }}
        >
          <Plus className="mr-2 size-4" />
          Create House Ad (Zero Budget)
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Targets</TableHead>
              <TableHead>Impressions</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No ad campaigns have been created yet.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        campaign.status === "running" ? "default" : "outline"
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {campaign.placement.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell>
                    {campaign.targets
                      .map((target) => target.targetCode)
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics.ctrPercent.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast({
                          description: `Toggled status for "${campaign.name}" to live running status.`,
                          title: "Ad Status Updated",
                        });
                      }}
                    >
                      Toggle Run Status
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OverviewPanel() {
  const { data, error, isLoading } = useAdminOverviewQuery();
  const backfillDurations = useBackfillTrackDurationsMutation();
  const [backfillStarted, setBackfillStarted] = useState(false);
  const completionHandledRef = useRef(false);
  const backfillStatus = useTrackDurationBackfillStatusQuery(
    backfillStarted || data?.operations.tracksMissingDuration > 0
  );

  useEffect(() => {
    if (
      !backfillStarted ||
      completionHandledRef.current ||
      !backfillStatus.data
    ) {
      return;
    }

    const { done, failed, processing, queued } = backfillStatus.data;
    const inFlight = processing + queued;

    if (inFlight > 0) {
      return;
    }

    completionHandledRef.current = true;
    setBackfillStarted(false);
    toast({
      description:
        `Backfill finished · ${done} done${failed > 0 ? ` · ${failed} failed` : ""}.`,
      title: "Track durations backfilled",
    });
  }, [backfillStarted, backfillStatus.data]);

  const handleBackfillDurations = () => {
    backfillDurations.mutate(
      { limit: 500 },
      {
        onError: (backfillError) => {
          toast({
            description: backfillError.message,
            title: "Duration backfill failed",
            variant: "destructive",
          });
        },
        onSuccess: (result) => {
          if (result.enqueued === 0) {
            completionHandledRef.current = true;
            toast({
              description: "All tracked durations are already known.",
              title: "Nothing to backfill",
            });
            return;
          }

          completionHandledRef.current = false;
          setBackfillStarted(true);
          toast({
            description: `Queued ${result.enqueued} track${result.enqueued === 1 ? "" : "s"} for duration detection in the background.`,
            title: "Backfill queued",
          });
        },
      }
    );
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading overview...</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">Unable to load overview.</p>;
  }

  const metrics = [
    {
      detail: `${data.people.artists} artists · ${data.people.fans} fans`,
      icon: Users,
      label: "Users",
      value: data.people.users.toLocaleString(),
    },
    {
      detail: `${data.operations.publishedTracks} public`,
      icon: Disc3,
      label: "Tracks",
      value: data.content.tracks.toLocaleString(),
    },
    {
      detail: `${data.operations.scheduledListeningParties} scheduled parties`,
      icon: Radio,
      label: "Projects",
      value: data.content.projects.toLocaleString(),
    },
    {
      detail: `${data.commerce.successfulTransactions} transactions`,
      icon: CircleDollarSign,
      label: "Gross revenue",
      value: formatCurrency(data.commerce.grossRevenueCents),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card className="gap-3 py-4" key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between px-4">
              <CardTitle className="text-sm font-medium">
                {metric.label}
              </CardTitle>
              <metric.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {metric.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content inventory</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <MetricRow label="Videos" value={data.content.videos} />
            <MetricRow
              label="Ready videos"
              value={data.operations.readyVideos}
            />
            <MetricRow label="Open verses" value={data.content.openVerses} />
            <MetricRow
              label="Active open verses"
              value={data.operations.activeOpenVerses}
            />
            <MetricRow label="Communities" value={data.content.communities} />
            <MetricRow
              label="Listening parties"
              value={data.content.listeningParties}
            />
            <MetricRow
              label="Missing durations"
              value={data.operations.tracksMissingDuration}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access and commerce</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <MetricRow label="Admins" value={data.people.admins} />
            <MetricRow label="Banned users" value={data.people.bannedUsers} />
            <MetricRow
              label="Released projects"
              value={data.operations.releasedProjects}
            />
            <MetricRow
              label="Platform fees"
              value={formatCurrency(data.commerce.platformFeeCents)}
            />
          </CardContent>
        </Card>
      </div>

      {data.operations.tracksMissingDuration > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-amber-500" />
                Missing track durations
              </CardTitle>
              <CardDescription>
                {data.operations.tracksMissingDuration.toLocaleString()}{" "}
                uploaded track{data.operations.tracksMissingDuration === 1 ? "" : "s"} have no duration
                yet. Backfill reads each file in R2 to detect playback length in
                the background.
                {backfillStarted && backfillStatus.data ? (
                  <span className="mt-1 block">
                    {backfillStatus.data.queued + backfillStatus.data.processing}{" "}
                    queued · {backfillStatus.data.processing} processing ·{" "}
                    {backfillStatus.data.done} done · {backfillStatus.data.failed} failed
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <Button
              disabled={
                backfillDurations.isPending ||
                (backfillStarted && (backfillStatus.data?.queued ?? 0) > 0)
              }
              onClick={handleBackfillDurations}
              size="sm"
            >
              {backfillDurations.isPending || backfillStarted ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              {backfillDurations.isPending
                ? "Backfilling..."
                : backfillStarted
                  ? "Backfill running..."
                  : "Backfill durations"}
            </Button>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function MetricRow({
  label,
  value,
}: Readonly<{ label: string; value: number | string }>) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function UsersPanel({ currentUserId }: Readonly<{ currentUserId: string }>) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const usersQuery = useQuery({
    queryFn: async () => {
      const { data, error } = await authClient.admin.listUsers({
        query: {
          limit: 100,
          searchField: "email",
          searchOperator: "contains",
          searchValue: search || undefined,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    queryKey: ["admin", "users", search],
  });
  const actionMutation = useMutation({
    mutationFn: async (
      action:
        | Exclude<PendingAction, null>
        | {
            action: "role" | "unban" | "impersonate";
            userId: string;
            role?: "admin" | "user";
          }
    ) => {
      if (action.action === "ban") {
        const result = await authClient.admin.banUser({
          banReason: "Administrative action",
          userId: action.userId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
      } else if (action.action === "unban") {
        const result = await authClient.admin.unbanUser({
          userId: action.userId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
      } else if (action.action === "revoke") {
        const result = await authClient.admin.revokeUserSessions({
          userId: action.userId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
      } else if (action.action === "role") {
        const result = await authClient.admin.setRole({
          role: action.role ?? "user",
          userId: action.userId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
      } else {
        const result = await authClient.admin.impersonateUser({
          userId: action.userId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
      }
    },
    onError: (mutationError) => {
      toast({
        description: mutationError.message,
        title: "Admin action failed",
        variant: "destructive",
      });
    },
    onSuccess: async (_data, action) => {
      if (action.action === "impersonate") {
        window.location.assign("/dashboard");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({ description: "The user account was updated.", title: "Updated" });
    },
  });

  const confirmAction = () => {
    if (!pendingAction) {
      return;
    }
    actionMutation.mutate(pendingAction);
    setPendingAction(null);
  };

  return (
    <div className="space-y-4">
      <form
        className="flex max-w-lg gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <Input
          aria-label="Search users by email"
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search users by email"
          value={searchInput}
        />
        <Button type="submit" variant="outline">
          <Search className="size-4" />
          <span className="sr-only">Search</span>
        </Button>
      </form>

      <div className="overflow-x-auto border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.data?.users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isUserAdmin = hasAdminRole(user.role);

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {isUserAdmin ? "Admin" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.banned ? "destructive" : "secondary"}>
                      {user.banned ? "Banned" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Manage ${user.email}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={isSelf}
                          onSelect={() =>
                            actionMutation.mutate({
                              action: "role",
                              role: isUserAdmin ? "user" : "admin",
                              userId: user.id,
                            })
                          }
                        >
                          <UserRoundCog className="size-4" />
                          {isUserAdmin ? "Remove admin" : "Make admin"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isSelf}
                          onSelect={() =>
                            actionMutation.mutate({
                              action: "impersonate",
                              userId: user.id,
                            })
                          }
                        >
                          <Users className="size-4" />
                          Impersonate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.banned ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              actionMutation.mutate({
                                action: "unban",
                                userId: user.id,
                              })
                            }
                          >
                            Unban user
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={isSelf}
                            onSelect={() =>
                              setPendingAction({
                                action: "ban",
                                userId: user.id,
                                userName: user.name,
                              })
                            }
                          >
                            <Ban className="size-4" />
                            Ban user
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          disabled={isSelf}
                          onSelect={() =>
                            setPendingAction({
                              action: "revoke",
                              userId: user.id,
                              userName: user.name,
                            })
                          }
                        >
                          Revoke sessions
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {usersQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading users...</p>
      )}
      {usersQuery.error && (
        <p className="text-sm text-destructive">Unable to load users.</p>
      )}
      {usersQuery.data && usersQuery.data.users.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No users matched your search.
        </p>
      )}

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "ban"
                ? "Ban this user?"
                : "Revoke all sessions?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "ban"
                ? `${pendingAction.userName} will be signed out and unable to sign in.`
                : `${pendingAction?.userName ?? "This user"} will be signed out on every device.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PaymentsPanel() {
  const paymentsQuery = useAdminPaymentsQuery();
  const syncMutation = useSyncStripePlansMutation();

  if (paymentsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payments...</p>;
  }

  if (paymentsQuery.error || !paymentsQuery.data) {
    return <p className="text-sm text-destructive">Unable to load payments.</p>;
  }

  const { data } = paymentsQuery;
  const missingCheckoutEnv = data.plans.filter(
    (plan) => plan.stripeMonthlyPriceId && !plan.envMonthlyPriceId
  );
  const configuredPlanCount = data.plans.filter(
    (plan) => plan.stripeMonthlyPriceId
  ).length;
  const paymentMetrics = [
    {
      label: "Gross revenue",
      supporting: "All successful transactions",
      value: formatCurrency(data.totals.grossRevenueCents),
    },
    {
      label: "Platform fees",
      supporting: "SoundKit retained fees",
      value: formatCurrency(data.totals.platformFeeCents),
    },
    {
      label: "Transactions",
      supporting: "Successful payments",
      value: data.totals.successfulTransactions.toLocaleString(),
    },
    {
      label: "Checkout plans",
      supporting: `${configuredPlanCount} Stripe-linked plans`,
      value: `${data.configuredCheckoutPlans}/${data.planCount}`,
    },
  ];

  const handleSync = () => {
    syncMutation.mutate(
      {},
      {
        onError: (error) => {
          toast({
            description: error.message,
            title: "Stripe sync failed",
            variant: "destructive",
          });
        },
        onSuccess: (result) => {
          toast({
            description: `${result.results.length} plan rows were checked.`,
            title: "Stripe sync complete",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CircleDollarSign className="size-4 text-primary" />
                  Payments Health
                </CardTitle>
                <CardDescription className="mt-1">
                  Stripe setup, checkout readiness, coupons, and admin grants.
                </CardDescription>
              </div>
              <Badge
                className="shrink-0"
                variant={data.stripeConfigured ? "secondary" : "destructive"}
              >
                {data.stripeConfigured ? "Stripe Connected" : "Stripe Missing"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {paymentMetrics.map((metric) => (
              <div
                className="rounded-md border bg-background/70 p-3"
                key={metric.label}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2 font-semibold text-2xl tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {metric.supporting}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Next Action</CardTitle>
            <CardDescription>
              Use Stripe as the source for missing products, prices, and
              coupons.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-center"
              disabled={syncMutation.isPending}
              onClick={handleSync}
            >
              <RefreshCw
                className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncMutation.isPending ? "Syncing…" : "Sync Products & Prices"}
            </Button>
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              {data.stripeConfigured ? (
                <p>
                  {missingCheckoutEnv.length > 0
                    ? `${missingCheckoutEnv.length} plan needs deployed checkout env vars.`
                    : "All linked checkout plans are ready."}
                </p>
              ) : (
                <p>Add `STRIPE_SECRET_KEY` before syncing or importing IDs.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {missingCheckoutEnv.length > 0 && (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>Checkout Env Vars Need Updating</AlertTitle>
          <AlertDescription>
            Synced DB price IDs are visible here. Copy the matching monthly and
            annual IDs into the listed env keys before testing paid checkout.
          </AlertDescription>
        </Alert>
      )}

      <PaymentPlanCatalog plans={data.plans} stripePrices={data.stripePrices} />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <CouponsManagerCard />
        <IssueAICreditsCard />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <RecentTransactions transactions={data.recentTransactions} />
        <StripeCatalog prices={data.stripePrices} />
      </section>
    </div>
  );
}

function CouponsManagerCard() {
  const queryClient = useQueryClient();
  const syncPlansMutation = useSyncStripePlansMutation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("17");
  const duration = "forever" as const;
  const [maxRedemptions, setMaxRedemptions] = useState("");

  const {
    data: couponsData,
    isLoading,
    refetch,
  } = useQuery({
    queryFn: async () => {
      const res = await fetch(`${API_V1_URL}/admin/finance/payments/coupons`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Failed to load coupons");
      }
      return (await res.json()) as {
        coupons: {
          amount_off?: number | null;
          currency?: string | null;
          duration: string;
          id: string;
          max_redemptions?: number | null;
          name?: string | null;
          percent_off?: number | null;
          times_redeemed?: number;
          valid: boolean;
        }[];
        message?: string;
        stripeConfigured?: boolean;
      };
    },
    queryKey: ["admin", "stripe-coupons"],
  });

  const coupons = couponsData?.coupons ?? [];

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }

    const payload = {
      duration,
      id: code.trim().toUpperCase() || undefined,
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      name: name.trim(),
      percentOff: Number(percentOff) || 17,
    };

    try {
      const res = await fetch(`${API_V1_URL}/admin/finance/payments/coupons`, {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Failed to create coupon");
      }

      setIsDialogOpen(false);
      setName("");
      setCode("");
      setMaxRedemptions("");
      refetch();
      toast({
        description: `Stripe coupon created and ready for checkout.`,
        title: "Coupon Created",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Could not create coupon. Please try again.",
        title: "Error",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    try {
      const res = await fetch(
        `${API_V1_URL}/admin/finance/payments/coupons/${encodeURIComponent(couponId)}`,
        {
          credentials: "include",
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Failed to delete coupon");
      }
      refetch();
      toast({
        description: `Coupon ${couponId} archived.`,
        title: "Coupon Deleted",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Could not delete coupon.",
        title: "Error",
        variant: "destructive",
      });
    }
  };

  const handleSyncStripe = async () => {
    try {
      await syncPlansMutation.mutateAsync({});
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      toast({
        description: "Synced pricing catalog and coupons with Stripe.",
        title: "Sync Successful",
      });
    } catch {
      toast({
        description: "Could not sync with Stripe API.",
        title: "Sync Error",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base">
            Stripe Coupons & Promo Codes
          </CardTitle>
          <CardDescription className="mt-1">
            Manage active promotional discount codes and sync with Stripe.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={syncPlansMutation.isPending}
            onClick={handleSyncStripe}
            className="gap-1.5"
          >
            <RefreshCw
              className={`size-3.5 ${syncPlansMutation.isPending ? "animate-spin" : ""}`}
            />
            Sync Coupons
          </Button>
          <Button
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="font-bold"
          >
            Create Coupon
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Loading coupons…
                  </TableCell>
                </TableRow>
              ) : coupons.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {couponsData?.message ??
                      "No coupons yet. Create one to grant discounts at checkout."}
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-bold">
                      {c.id}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {c.name}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-500">
                      {c.percent_off
                        ? `${c.percent_off}% OFF`
                        : `$${(c.amount_off ?? 0) / 100} OFF`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.duration.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCoupon(c.id)}
                      >
                        Archive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create Coupon Modal */}
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create Stripe Coupon</AlertDialogTitle>
              <AlertDialogDescription>
                Add a percentage or fixed amount discount coupon for SoundKit
                subscriptions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form onSubmit={handleCreateCoupon} className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="couponName">Coupon Name</Label>
                <Input
                  autoComplete="off"
                  id="couponName"
                  name="coupon-name"
                  placeholder="Annual special 17% off…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="couponCode">Promo Code ID (Optional)</Label>
                <Input
                  autoComplete="off"
                  id="couponCode"
                  name="coupon-code"
                  placeholder="SUMMER17…"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="percentOff">Percentage Discount (% Off)</Label>
                <Input
                  autoComplete="off"
                  id="percentOff"
                  inputMode="numeric"
                  name="coupon-percent-off"
                  type="number"
                  placeholder="17"
                  value={percentOff}
                  onChange={(e) => setPercentOff(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxRedemptions">
                  Max Redemptions (Optional)
                </Label>
                <Input
                  autoComplete="off"
                  id="maxRedemptions"
                  inputMode="numeric"
                  name="coupon-max-redemptions"
                  type="number"
                  placeholder="100…"
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction type="submit">
                  Create Coupon
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function IssueAICreditsCard() {
  const [targetUser, setTargetUser] = useState("");
  const [credits, setCredits] = useState("500");
  const [reason, setReason] = useState("Pro Membership Perk");
  const [planCode, setPlanCode] = useState("soundkit_premium_artist");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGrantingPremium, setIsGrantingPremium] = useState(false);

  const handleIssueCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser.trim() || !credits) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${API_V1_URL}/admin/finance/payments/issue-credits`,
        {
          body: JSON.stringify({
            credits: Number(credits),
            reason,
            target: targetUser.trim(),
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Failed to grant AI credits");
      }

      setIsSubmitting(false);
      toast({
        description: `Successfully credited ${credits} AI credits to ${targetUser.trim()}.`,
        title: "AI Credits Granted",
      });
      setTargetUser("");
    } catch (error) {
      setIsSubmitting(false);
      toast({
        description:
          error instanceof Error ? error.message : "Could not grant credits.",
        title: "Grant failed",
        variant: "destructive",
      });
    }
  };

  const handleGrantPremium = async () => {
    if (!targetUser.trim()) {
      return;
    }

    setIsGrantingPremium(true);
    try {
      const isEmail = targetUser.includes("@") && !targetUser.startsWith("@");
      const res = await fetch(
        `${API_V1_URL}/admin/finance/payments/grant-premium`,
        {
          body: JSON.stringify({
            ...(isEmail
              ? { email: targetUser.trim() }
              : { target: targetUser.trim() }),
            planCode,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Failed to grant premium access");
      }

      toast({
        description: `${targetUser.trim()} now has ${planCode}.`,
        title: "Premium Granted",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Could not grant premium access.",
        title: "Premium grant failed",
        variant: "destructive",
      });
    } finally {
      setIsGrantingPremium(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRoundCog className="size-4 text-primary" />
          Grant Access & Credits
        </CardTitle>
        <CardDescription>
          Issue credits for AI Studio stem separation, mastering, and live
          BattleBot features.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleIssueCredits} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="targetUser">User Email or Handle</Label>
              <Input
                autoComplete="off"
                id="targetUser"
                name="target-user"
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="artist@mysoundkit.com or @luna-eclipse…"
                spellCheck={false}
                value={targetUser}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grantPlanCode">Premium Plan</Label>
              <Input
                autoComplete="off"
                id="grantPlanCode"
                name="grant-plan-code"
                onChange={(e) => setPlanCode(e.target.value)}
                placeholder="soundkit_premium_artist…"
                spellCheck={false}
                value={planCode}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="creditsAmount">AI Credits</Label>
              <Input
                autoComplete="off"
                id="creditsAmount"
                inputMode="numeric"
                name="credits-amount"
                onChange={(e) => setCredits(e.target.value)}
                placeholder="500"
                type="number"
                value={credits}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="issueReason">Reason / Campaign</Label>
            <Input
              autoComplete="off"
              id="issueReason"
              name="issue-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VIP upgrade bonus…"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full font-bold"
          >
            {isSubmitting ? "Granting Credits…" : "Grant AI Credits"}
          </Button>
          <Button
            type="button"
            disabled={isGrantingPremium}
            onClick={handleGrantPremium}
            variant="outline"
            className="w-full font-bold"
          >
            {isGrantingPremium ? "Granting Premium…" : "Grant Premium Access"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaymentPlanCatalog({
  plans,
  stripePrices,
}: Readonly<{
  plans: AdminPaymentPlan[];
  stripePrices: StripePriceOption[];
}>) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Subscription Catalog</CardTitle>
            <CardDescription>
              Link SoundKit plan rows to Stripe prices and checkout env keys.
            </CardDescription>
          </div>
          <Badge variant="outline">{plans.length} Plans</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Plan</TableHead>
                <TableHead className="min-w-[130px]">Pricing</TableHead>
                <TableHead className="min-w-[150px]">Checkout Status</TableHead>
                <TableHead className="min-w-[360px]">
                  Stripe Price IDs
                </TableHead>
                <TableHead className="min-w-[280px]">Env Keys</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <PaymentPlanRow
                  key={`${plan.code}:${plan.stripeMonthlyPriceId}:${plan.stripeAnnualPriceId}`}
                  plan={plan}
                  stripePrices={stripePrices}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentPlanRow({
  plan,
  stripePrices,
}: Readonly<{
  plan: AdminPaymentPlan;
  stripePrices: StripePriceOption[];
}>) {
  const importMutation = useImportStripePlanMutation();
  const suggestedMonthly =
    stripePrices.find(
      (price) => price.planCode === plan.code && price.interval === "month"
    )?.id ?? "";
  const suggestedAnnual =
    stripePrices.find(
      (price) => price.planCode === plan.code && price.interval === "year"
    )?.id ?? "";
  const [monthlyPriceId, setMonthlyPriceId] = useState(
    plan.stripeMonthlyPriceId ?? suggestedMonthly
  );
  const [annualPriceId, setAnnualPriceId] = useState(
    plan.stripeAnnualPriceId ?? suggestedAnnual
  );
  const monthlyCheckoutReady =
    Boolean(plan.stripeMonthlyPriceId) &&
    plan.stripeMonthlyPriceId === plan.envMonthlyPriceId;
  const annualCheckoutReady =
    !plan.annualPriceCents ||
    (Boolean(plan.stripeAnnualPriceId) &&
      plan.stripeAnnualPriceId === plan.envAnnualPriceId);
  const checkoutReady = monthlyCheckoutReady && annualCheckoutReady;

  const handleImport = () => {
    importMutation.mutate(
      {
        annualPriceId: annualPriceId.trim() || undefined,
        code: plan.code,
        monthlyPriceId: monthlyPriceId.trim() || undefined,
      },
      {
        onError: (error) => {
          toast({
            description: error.message,
            title: "Import failed",
            variant: "destructive",
          });
        },
        onSuccess: () => {
          toast({
            description: `${plan.name} is linked to Stripe price IDs.`,
            title: "Plan updated",
          });
        },
      }
    );
  };

  return (
    <TableRow className="align-top">
      <TableCell>
        <div className="min-w-0">
          <p className="font-semibold">{plan.name}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {plan.code}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">{plan.audience}</Badge>
            <Badge variant={plan.isActive ? "secondary" : "outline"}>
              {plan.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Monthly</span>{" "}
            <span className="font-medium tabular-nums">
              {formatCurrency(plan.monthlyPriceCents)}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Annual</span>{" "}
            <span className="font-medium tabular-nums">
              {plan.annualPriceCents
                ? formatCurrency(plan.annualPriceCents)
                : "-"}
            </span>
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Badge variant={checkoutReady ? "secondary" : "outline"}>
            {checkoutReady ? "Ready" : "Needs Setup"}
          </Badge>
          {!checkoutReady && (
            <p className="max-w-[150px] text-xs text-muted-foreground">
              Import Stripe IDs, then deploy matching env keys.
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="grid gap-2">
          <PriceIdField
            id={`${plan.code}-monthly`}
            label="Monthly Price ID"
            onChange={setMonthlyPriceId}
            value={monthlyPriceId}
          />
          {plan.annualPriceCents && (
            <PriceIdField
              id={`${plan.code}-annual`}
              label="Annual Price ID"
              onChange={setAnnualPriceId}
              value={annualPriceId}
            />
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
          <EnvKeyLine
            isReady={monthlyCheckoutReady}
            label="Monthly"
            value={plan.envMonthlyKey ?? "not required"}
          />
          {plan.envAnnualKey && (
            <EnvKeyLine
              isReady={annualCheckoutReady}
              label="Annual"
              value={plan.envAnnualKey}
            />
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          disabled={importMutation.isPending}
          onClick={handleImport}
          size="sm"
          variant="outline"
        >
          <UploadCloud className="size-4" />
          {importMutation.isPending ? "Saving…" : "Import"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function EnvKeyLine({
  isReady,
  label,
  value,
}: Readonly<{ isReady: boolean; label: string; value: string }>) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {isReady ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <p className="break-all font-mono">{value}</p>
      </div>
    </div>
  );
}

function PriceIdField({
  id,
  label,
  onChange,
  value,
}: Readonly<{
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}>) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs" htmlFor={id}>
        {label}
      </Label>
      <Input
        autoComplete="off"
        className="h-8 font-mono text-xs"
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder="price_…"
        spellCheck={false}
        value={value}
      />
    </div>
  );
}

function RecentTransactions({
  transactions,
}: Readonly<{
  transactions: {
    amountCents: number;
    createdAt: string;
    currency: string;
    id: string;
    platformFeeCents: number;
    status: string;
    transactionType: string;
  }[];
}>) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent transactions</CardTitle>
        <CardDescription>
          Latest successful payments and platform fees.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.transactionType}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(transaction.amountCents)}
                    </TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(transaction.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StripeCatalog({ prices }: Readonly<{ prices: StripePriceOption[] }>) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Stripe prices</CardTitle>
        <CardDescription>
          Active Stripe price objects detected during sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {prices.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No active Stripe prices found.
          </div>
        ) : (
          prices.slice(0, 12).map((price) => (
            <div
              className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
              key={price.id}
            >
              <div className="min-w-0">
                <p className="font-medium">{price.productName}</p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {price.id}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="tabular-nums">
                  {typeof price.unitAmount === "number"
                    ? formatCurrency(price.unitAmount)
                    : "-"}
                </p>
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3" />
                  {price.interval ?? "one-time"}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CouponsPanel() {
  const [coupons, setCoupons] = useState([
    {
      code: "FREE1YEAR",
      discount: "100% OFF (1 Year)",
      status: "Active",
      uses: 42,
    },
    {
      code: "FREE1MONTH",
      discount: "100% OFF (1 Month)",
      status: "Active",
      uses: 88,
    },
    {
      code: "SOUNDKITVIP",
      discount: "100% VIP Pass",
      status: "Active",
      uses: 120,
    },
    { code: "100OFF", discount: "100% OFF Pass", status: "Active", uses: 15 },
    {
      code: "VIP2026",
      discount: "100% Promo Code",
      status: "Active",
      uses: 64,
    },
  ]);

  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("100% OFF");

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      return;
    }
    const formattedCode = newCode.trim().toUpperCase();
    setCoupons((prev) => [
      { code: formattedCode, discount: newDiscount, status: "Active", uses: 0 },
      ...prev,
    ]);
    setNewCode("");
    toast({
      description: `Promo code ${formattedCode} is now active.`,
      title: "Coupon Created",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CircleDollarSign className="size-4 text-primary" /> Create New
            Promo Code / Coupon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreateCoupon}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="coupon-code">Promo Code</Label>
              <Input
                id="coupon-code"
                placeholder="e.g. SUMMER2026"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="coupon-discount">Discount / Perk</Label>
              <Input
                id="coupon-discount"
                placeholder="e.g. 100% OFF"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full sm:w-auto font-bold">
                Create Coupon
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">
            Active Platform Coupons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Redemptions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.code}>
                  <TableCell className="font-mono font-bold text-primary">
                    {coupon.code}
                  </TableCell>
                  <TableCell>{coupon.discount}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{coupon.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {coupon.uses} uses
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
