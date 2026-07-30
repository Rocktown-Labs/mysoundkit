import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Disc3,
  Globe2,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useAdminOverviewQuery,
  useAdminPaymentsQuery,
  useAdminSettingsQuery,
  useImportStripePlanMutation,
  useSyncStripePlansMutation,
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
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="emails">Email Templates</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <OverviewPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersPanel currentUserId={session.user.id} />
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          <PaymentsPanel />
        </TabsContent>
        <TabsContent value="coupons" className="mt-6">
          <CouponsPanel />
        </TabsContent>
        <TabsContent value="emails" className="mt-6">
          <EmailsPanel />
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

function OverviewPanel() {
  const { data, error, isLoading } = useAdminOverviewQuery();

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
  const paymentMetrics = [
    {
      label: "Gross revenue",
      value: formatCurrency(data.totals.grossRevenueCents),
    },
    {
      label: "Platform fees",
      value: formatCurrency(data.totals.platformFeeCents),
    },
    {
      label: "Transactions",
      value: data.totals.successfulTransactions.toLocaleString(),
    },
    {
      label: "Checkout plans",
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
    <div className="space-y-6">
      {!data.stripeConfigured && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Stripe is not configured</AlertTitle>
          <AlertDescription>
            Add `STRIPE_SECRET_KEY` before syncing products or importing price
            IDs.
          </AlertDescription>
        </Alert>
      )}
      {missingCheckoutEnv.length > 0 && (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>Checkout env vars still need updating</AlertTitle>
          <AlertDescription>
            Synced DB price IDs are visible here, but Better Auth checkout still
            reads deployed Stripe price env vars. Copy the matching monthly and
            annual IDs into the listed env keys before testing paid checkout.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {paymentMetrics.map((metric) => (
          <Card className="gap-3 py-4" key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between px-4">
              <CardTitle className="text-sm font-medium">
                {metric.label}
              </CardTitle>
              <CreditCard className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-2xl font-bold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Subscription catalog</h2>
          <p className="text-sm text-muted-foreground">
            Create missing Stripe Products and Prices or link existing prices.
          </p>
        </div>
        <Button disabled={syncMutation.isPending} onClick={handleSync}>
          <RefreshCw className="size-4" />
          {syncMutation.isPending
            ? "Syncing..."
            : "Sync Missing Products & Prices"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.plans.map((plan) => (
          <PaymentPlanCard
            key={`${plan.code}:${plan.stripeMonthlyPriceId}:${plan.stripeAnnualPriceId}`}
            plan={plan}
            stripePrices={data.stripePrices}
          />
        ))}
      </div>

      {/* Coupons & AI Credit Management Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CouponsManagerCard />
        <IssueAICreditsCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions transactions={data.recentTransactions} />
        <StripeCatalog prices={data.stripePrices} />
      </div>
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
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">(
    "forever"
  );
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
        throw new Error("Failed to load coupons");
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
        throw new Error("Failed to create coupon");
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
    } catch {
      toast({
        description: "Could not create coupon. Please try again.",
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
        throw new Error("Failed to delete coupon");
      }
      refetch();
      toast({
        description: `Coupon ${couponId} archived.`,
        title: "Coupon Deleted",
      });
    } catch {
      toast({
        description: "Could not delete coupon.",
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">
            Stripe Coupons & Promo Codes
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Manage active promotional discount codes and sync with Stripe.
          </p>
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
            Sync to Stripe
          </Button>
          <Button
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="font-bold"
          >
            + Create Coupon
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
                    className="text-center text-xs py-4 text-muted-foreground"
                  >
                    Loading coupons...
                  </TableCell>
                </TableRow>
              ) : coupons.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-4 text-center text-muted-foreground text-xs"
                  >
                    No Stripe coupons have been created yet.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-bold text-xs">
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
                        Delete
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
                  id="couponName"
                  placeholder="e.g. Annual Special 17% Off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="couponCode">Promo Code ID (Optional)</Label>
                <Input
                  id="couponCode"
                  placeholder="e.g. SUMMER17"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="percentOff">Percentage Discount (% Off)</Label>
                <Input
                  id="percentOff"
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
                  id="maxRedemptions"
                  type="number"
                  placeholder="e.g. 100"
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
            userId: targetUser.trim(),
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to grant AI credits");
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
              : { userId: targetUser.trim() }),
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
      <CardHeader>
        <CardTitle className="text-base">Grant AI Credits & Upsells</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Issue credits for AI Studio stem separation, mastering, and live
          BattleBot features.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleIssueCredits} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="targetUser">User Email or Handle</Label>
            <Input
              id="targetUser"
              placeholder="e.g. artist@mysoundkit.com or @luna-eclipse"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grantPlanCode">Premium plan</Label>
            <Input
              id="grantPlanCode"
              placeholder="soundkit_premium_artist"
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="creditsAmount">AI Credits Amount</Label>
            <Input
              id="creditsAmount"
              type="number"
              placeholder="500"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="issueReason">Reason / Campaign</Label>
            <Input
              id="issueReason"
              placeholder="e.g. VIP Upgrade Bonus"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full font-bold bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSubmitting ? "Granting Credits..." : "Grant AI Credits to User"}
          </Button>
          <Button
            type="button"
            disabled={isGrantingPremium}
            onClick={handleGrantPremium}
            variant="outline"
            className="w-full font-bold"
          >
            {isGrantingPremium ? "Granting Premium..." : "Grant Premium Access"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaymentPlanCard({
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{plan.name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{plan.code}</p>
          </div>
          <Badge variant={monthlyCheckoutReady ? "secondary" : "outline"}>
            {monthlyCheckoutReady ? "Checkout ready" : "Needs env"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <MetricRow label="Audience" value={plan.audience} />
          <MetricRow
            label="Monthly"
            value={formatCurrency(plan.monthlyPriceCents)}
          />
          <MetricRow
            label="Annual"
            value={
              plan.annualPriceCents
                ? formatCurrency(plan.annualPriceCents)
                : "-"
            }
          />
          <MetricRow label="Active" value={plan.isActive ? "Yes" : "No"} />
        </div>

        <div className="grid gap-3">
          <PriceIdField
            id={`${plan.code}-monthly`}
            label="Monthly Stripe price ID"
            onChange={setMonthlyPriceId}
            value={monthlyPriceId}
          />
          {plan.annualPriceCents && (
            <PriceIdField
              id={`${plan.code}-annual`}
              label="Annual Stripe price ID"
              onChange={setAnnualPriceId}
              value={annualPriceId}
            />
          )}
        </div>

        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          <p>
            Env monthly:{" "}
            <span className="font-mono">
              {plan.envMonthlyKey ?? "not required"}
            </span>
          </p>
          {plan.envAnnualKey && (
            <p className="mt-1">
              Env annual: <span className="font-mono">{plan.envAnnualKey}</span>
            </p>
          )}
        </div>

        <Button
          disabled={importMutation.isPending}
          onClick={handleImport}
          variant="outline"
        >
          <UploadCloud className="size-4" />
          {importMutation.isPending ? "Saving" : "Import IDs"}
        </Button>
      </CardContent>
    </Card>
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
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder="price_..."
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
      <CardHeader>
        <CardTitle className="text-base">Recent transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
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
                    <TableCell>
                      {formatCurrency(transaction.amountCents)}
                    </TableCell>
                    <TableCell>
                      {new Date(transaction.createdAt).toLocaleDateString()}
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
      <CardHeader>
        <CardTitle className="text-base">Stripe prices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active Stripe prices found.
          </p>
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
                <p>
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

function EmailsPanel() {
  const [selectedTemplate, setSelectedTemplate] = useState<
    "post_battle" | "battle_challenge" | "open_verse" | "weekly_summary"
  >("post_battle");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold">React Email Template Previews</h2>
          <p className="text-sm text-muted-foreground">
            Preview live transactional email templates sent via Resend.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={selectedTemplate === "post_battle" ? "default" : "outline"}
            onClick={() => setSelectedTemplate("post_battle")}
            className="text-xs"
          >
            🏆 Post-Battle Recap
          </Button>
          <Button
            size="sm"
            variant={
              selectedTemplate === "battle_challenge" ? "default" : "outline"
            }
            onClick={() => setSelectedTemplate("battle_challenge")}
            className="text-xs"
          >
            ⚔️ Battle Challenge
          </Button>
          <Button
            size="sm"
            variant={selectedTemplate === "open_verse" ? "default" : "outline"}
            onClick={() => setSelectedTemplate("open_verse")}
            className="text-xs"
          >
            🎙️ Open Verse Collab
          </Button>
          <Button
            size="sm"
            variant={
              selectedTemplate === "weekly_summary" ? "default" : "outline"
            }
            onClick={() => setSelectedTemplate("weekly_summary")}
            className="text-xs"
          >
            📊 Weekly Summary
          </Button>
        </div>
      </div>

      {/* Rendered Email Template HTML Box */}
      <Card className="p-6 bg-zinc-950 border-zinc-800 text-white max-w-2xl mx-auto shadow-2xl rounded-2xl">
        {selectedTemplate === "post_battle" && (
          <div className="space-y-4 font-sans p-6 bg-white text-zinc-900 rounded-xl">
            <div className="border-b pb-4">
              <h2 className="text-xl font-bold text-rose-600">
                🏆 Battle Recap &amp; Tracklist
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Winner: <strong>MetroFlow</strong> (3 - 2)
              </p>
            </div>
            <p className="text-sm">
              Hey Alex, here is the tracklist played during the live battle:
            </p>
            <ul className="bg-zinc-50 p-4 rounded-lg text-xs space-y-2 border">
              <li>
                Round 1: <strong>Metro Bounce (WAV)</strong>
              </li>
              <li>
                Round 2: <strong>Nightfall Vibe (Master)</strong>
              </li>
              <li>
                Round 3: <strong>Cyberpunk Anthem (Unreleased)</strong>
              </li>
            </ul>
            <a
              href="/live/preview"
              className="inline-block bg-rose-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow"
            >
              Watch Battle Replay
            </a>
          </div>
        )}

        {selectedTemplate === "battle_challenge" && (
          <div className="space-y-4 font-sans p-6 bg-white text-zinc-900 rounded-xl">
            <h2 className="text-xl font-bold text-purple-600">
              Swords Up! New Battle Challenge
            </h2>
            <p className="text-sm">Hey ProducerKev,</p>
            <p className="text-sm">
              <strong>MetroFlow</strong> has challenged you to a{" "}
              <strong>Best of 5</strong> battle on SoundKit!
            </p>
            <blockquote className="border-l-4 border-purple-600 pl-3 italic text-xs text-zinc-600">
              "Let's see who has the best drum processing."
            </blockquote>
            <a
              href="/dashboard/live/challenge"
              className="inline-block bg-purple-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow mt-2"
            >
              Respond to Challenge
            </a>
          </div>
        )}

        {selectedTemplate === "open_verse" && (
          <div className="space-y-4 font-sans p-6 bg-white text-zinc-900 rounded-xl">
            <h2 className="text-xl font-bold text-pink-600">
              Private Open Verse Collab Invitation
            </h2>
            <p className="text-sm">Hey Sarah,</p>
            <p className="text-sm">
              <strong>MetroFlow</strong> invited you to collaborate on their
              private Open Verse: <strong>"Midnight Mixtape Track 4"</strong>.
            </p>
            <a
              href="/dashboard/open-verses"
              className="inline-block bg-pink-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow mt-2"
            >
              Join Collaboration
            </a>
          </div>
        )}

        {selectedTemplate === "weekly_summary" && (
          <div className="space-y-4 font-sans p-6 bg-white text-zinc-900 rounded-xl">
            <h2 className="text-xl font-bold text-blue-600">
              Your Weekly SoundKit Performance Summary
            </h2>
            <p className="text-sm">Hey MetroFlow,</p>
            <p className="text-sm">Here is your weekly artist recap:</p>
            <ul className="bg-blue-50 p-4 rounded-lg text-xs space-y-1.5 border border-blue-100">
              <li>
                <strong>Weekly Qualified Streams:</strong> 12,480
              </li>
              <li>
                <strong>Active Fan Count:</strong> 850
              </li>
              <li>
                <strong>Payout Pool Share:</strong> $342.50
              </li>
            </ul>
            <a
              href="/dashboard"
              className="inline-block bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow mt-2"
            >
              Open Artist Dashboard
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
