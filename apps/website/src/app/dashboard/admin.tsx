import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Disc3,
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
import { authClient } from "@/lib/auth-client";
import {
  useAdminAccessQuery,
  useAdminOverviewQuery,
  useAdminPaymentsQuery,
  useImportStripePlanMutation,
  useSyncStripePlansMutation,
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
      </Tabs>
    </div>
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
        <Button
          disabled={!data.stripeConfigured || syncMutation.isPending}
          onClick={handleSync}
        >
          <RefreshCw className="size-4" />
          {syncMutation.isPending ? "Syncing" : "Sync missing"}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions transactions={data.recentTransactions} />
        <StripeCatalog prices={data.stripePrices} />
      </div>
    </div>
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
