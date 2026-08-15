/* eslint-disable complexity, no-nested-ternary, oxc/branches-sharing-code, react/no-unescaped-entities */
import { useUploadFiles } from "@better-upload/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
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
import { AppImage } from "@/components/ui/app-image";
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
import { API_V1_URL, MEDIA_BASE_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
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
import { cn } from "@/lib/utils";

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

interface AdminUserSummary {
  accountType: "artist" | "fan" | null;
  banned: boolean | null;
  createdAt: string;
  email: string;
  id: string;
  name: string;
  premiumPlan: string | null;
  premiumStatus: string | null;
  role: string | null;
  username: string | null;
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
    }).format(cents / 100),
  hasAdminRole = (role: string | null | undefined) =>
    role
      ?.split(",")
      .map((value) => value.trim())
      .includes("admin") ?? false;

function AdminDashboard() {
  const { data: session, isPending } = authClient.useSession(),
    adminAccess = useAdminAccessQuery(Boolean(session?.user)),
    isAdmin =
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
  const settingsQuery = useAdminSettingsQuery(),
    updateSettings = useUpdateAdminSettingsMutation();

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
  const campaignsQuery = useAdminAdCampaignsQuery(),
    queryClient = useQueryClient(),
    [clickthroughUrl, setClickthroughUrl] = useState("https://mysoundkit.com"),
    [creativeFormat, setCreativeFormat] = useState<"audio" | "image" | "video">(
      "image"
    ),
    [creativeUrl, setCreativeUrl] = useState(""),
    [name, setName] = useState(""),
    [placement, setPlacement] = useState<
      "audio_preroll" | "video_overlay" | "video_preroll"
    >("video_overlay"),
    [previewUrl, setPreviewUrl] = useState(""),
    { isPending: isUploading, upload } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      onUploadComplete: ({ files }) => {
        const uploadedFile = files[0];
        if (uploadedFile) {
          setCreativeUrl(`${MEDIA_BASE_URL}/${uploadedFile.objectInfo.key}`);
        }
      },
    }),
    createHouseAd = useMutation({
      mutationFn: async () => {
        const response = await fetch(`${API_V1_URL}/ads/admin/campaigns`, {
          body: JSON.stringify({
            clickthroughUrl,
            creativeFormat,
            creativeImageUrl:
              creativeFormat === "image" ? creativeUrl : undefined,
            creativeUrl,
            name,
            placement,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("Could not create house ad.");
        }
      },
      onSuccess: async () => {
        setName("");
        setCreativeUrl("");
        setPreviewUrl("");
        await queryClient.invalidateQueries({
          queryKey: ["ads", "admin", "campaigns"],
        });
        toast({
          description: "The zero-budget house ad is now active.",
          title: "House ad created",
        });
      },
    }),
    updateStatus = useMutation({
      mutationFn: async ({
        campaignId,
        status,
      }: {
        campaignId: string;
        status: "active" | "paused";
      }) => {
        const response = await fetch(
          `${API_V1_URL}/ads/admin/campaigns/${encodeURIComponent(campaignId)}/status`,
          {
            body: JSON.stringify({ status }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          }
        );
        if (!response.ok) {
          throw new Error("Could not update campaign status.");
        }
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["ads", "admin", "campaigns"],
        });
      },
    }),
    campaigns = campaignsQuery.data ?? [];

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
        <Badge variant="secondary">Zero-budget house campaigns</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="house-ad-name">Campaign name</Label>
              <Input
                id="house-ad-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Global SoundKit house campaign"
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="house-ad-destination">Destination URL</Label>
              <Input
                id="house-ad-destination"
                onChange={(event) => setClickthroughUrl(event.target.value)}
                type="url"
                value={clickthroughUrl}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                aria-label="Creative format"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) =>
                  setCreativeFormat(
                    event.target.value === "audio"
                      ? "audio"
                      : event.target.value === "video"
                        ? "video"
                        : "image"
                  )
                }
                value={creativeFormat}
              >
                <option value="image">Banner image</option>
                <option value="audio">Audio pre-roll</option>
                <option value="video">Video pre-roll</option>
              </select>
              <select
                aria-label="Ad placement"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) =>
                  setPlacement(
                    event.target.value as
                      | "audio_preroll"
                      | "video_overlay"
                      | "video_preroll"
                  )
                }
                value={placement}
              >
                <option value="video_overlay">Display overlay</option>
                <option value="audio_preroll">Audio pre-roll</option>
                <option value="video_preroll">Video pre-roll</option>
              </select>
            </div>
            <Input
              accept="audio/*,image/*,video/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                const maxBytes = file.type.startsWith("image/")
                  ? 10 * 1024 * 1024
                  : 100 * 1024 * 1024;
                if (file.size > maxBytes) {
                  toast({
                    description:
                      "Images must be under 10 MB; audio and video must be under 100 MB.",
                    title: "Creative too large",
                    variant: "destructive",
                  });
                  return;
                }
                setPreviewUrl(URL.createObjectURL(file));
                const nextFormat = file.type.startsWith("audio/")
                  ? "audio"
                  : file.type.startsWith("video/")
                    ? "video"
                    : "image";
                setCreativeFormat(nextFormat);
                setPlacement(
                  nextFormat === "audio"
                    ? "audio_preroll"
                    : nextFormat === "video"
                      ? "video_preroll"
                      : "video_overlay"
                );
                void upload([file]);
              }}
              type="file"
            />
            <Button
              disabled={
                createHouseAd.isPending || isUploading || !name || !creativeUrl
              }
              onClick={() => createHouseAd.mutate()}
            >
              <Plus className="mr-2 size-4" />
              {isUploading ? "Uploading…" : "Create House Ad"}
            </Button>
          </div>
          <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg border bg-background">
            {previewUrl ? (
              creativeFormat === "audio" ? (
                <audio className="w-full px-4" controls src={previewUrl} />
              ) : creativeFormat === "video" ? (
                <video
                  className="aspect-video w-full object-cover"
                  controls
                  src={previewUrl}
                />
              ) : (
                <AppImage
                  alt="House ad preview"
                  className="h-full w-full object-contain"
                  height={300}
                  src={previewUrl}
                  width={500}
                />
              )
            ) : (
              <p className="text-muted-foreground text-sm">Creative preview</p>
            )}
          </div>
        </div>

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
                        campaign.status === "active" ? "default" : "outline"
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
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          campaignId: campaign.id,
                          status:
                            campaign.status === "active" ? "paused" : "active",
                        })
                      }
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
  const { data, error, isLoading } = useAdminOverviewQuery(),
    backfillDurations = useBackfillTrackDurationsMutation(),
    [backfillRunId, setBackfillRunId] = useState<string | null>(null),
    [backfillActive, setBackfillActive] = useState(false),
    completionHandledRef = useRef(false),
    backfillStatus = useTrackDurationBackfillStatusQuery(backfillRunId);

  useEffect(() => {
    if (
      !backfillActive ||
      completionHandledRef.current ||
      !backfillStatus.data
    ) {
      return;
    }

    const { done, failed, processing, queued } = backfillStatus.data,
      inFlight = processing + queued;

    if (inFlight > 0) {
      return;
    }

    completionHandledRef.current = true;
    setBackfillActive(false);
    toast({
      description: `Backfill finished · ${done} done${failed > 0 ? ` · ${failed} failed` : ""}.`,
      title: "Track durations backfilled",
    });
  }, [backfillActive, backfillStatus.data]);

  const handleBackfillDurations = () => {
    backfillDurations.mutate(
      { limit: 500, trackIds: [] },
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
              description:
                result.scanned > 0
                  ? `Scanned ${result.scanned} asset${result.scanned === 1 ? "" : "s"}; no new jobs were queued.`
                  : "No track assets need duration backfill.",
              title: "Nothing to backfill",
            });
            return;
          }

          completionHandledRef.current = false;
          setBackfillRunId(result.runId);
          setBackfillActive(true);
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
                uploaded track
                {data.operations.tracksMissingDuration === 1 ? "" : "s"} have no
                duration yet. Backfill reads each file in R2 to detect playback
                length in the background.
                {backfillRunId && backfillStatus.data ? (
                  <>
                    <span className="mt-1 block">
                      {backfillStatus.data.queued +
                        backfillStatus.data.processing}{" "}
                      queued · {backfillStatus.data.processing} processing ·{" "}
                      {backfillStatus.data.done} done ·{" "}
                      {backfillStatus.data.failed} failed
                    </span>
                    {backfillStatus.data.items.map((item) => (
                      <span
                        className="mt-1 flex justify-between gap-3"
                        key={item.trackId}
                      >
                        <span className="truncate">{item.title}</span>
                        <span
                          className={
                            item.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {item.status === "completed" && item.durationMs
                            ? `${Math.round(item.durationMs / 1000)}s`
                            : (item.error ?? item.status)}
                        </span>
                      </span>
                    ))}
                  </>
                ) : null}
              </CardDescription>
            </div>
            <Button
              disabled={
                backfillDurations.isPending ||
                (backfillActive && (backfillStatus.data?.queued ?? 0) > 0)
              }
              onClick={handleBackfillDurations}
              size="sm"
            >
              {backfillDurations.isPending || backfillActive ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              {backfillDurations.isPending
                ? "Backfilling..."
                : backfillActive
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
  const queryClient = useQueryClient(),
    [searchInput, setSearchInput] = useState(""),
    [search, setSearch] = useState(""),
    [pendingAction, setPendingAction] = useState<PendingAction>(null),
    usersQuery = useQuery({
      queryFn: async () => {
        const params = new URLSearchParams();
        if (search) {
          params.set("q", search);
        }
        const response = await fetch(
          `${API_V1_URL}/admin/finance/payments/users?${params.toString()}`,
          { credentials: "include" }
        );
        if (!response.ok) {
          throw new Error("Unable to load users.");
        }
        return (await response.json()) as { users: AdminUserSummary[] };
      },
      queryKey: ["admin", "users", search],
    }),
    actionMutation = useMutation({
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
        toast({
          description: "The user account was updated.",
          title: "Updated",
        });
      },
    }),
    confirmAction = () => {
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
          aria-label="Search users by name, email, or handle"
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search name, email, or @handle"
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
              <TableHead>Account</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.data?.users.map((user) => {
              const isSelf = user.id === currentUserId,
                isUserAdmin = hasAdminRole(user.role);

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    {user.username ? (
                      <p className="text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {isUserAdmin ? "Admin" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {user.accountType ?? "Unspecified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.premiumPlan ? "secondary" : "outline"}>
                      {user.premiumPlan
                        ? user.premiumPlan === "soundkit_premium_artist"
                          ? "Artist Premium"
                          : "Fan Premium"
                        : "Free"}
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
  const paymentsQuery = useAdminPaymentsQuery(),
    syncMutation = useSyncStripePlansMutation();

  if (paymentsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payments...</p>;
  }

  if (paymentsQuery.error || !paymentsQuery.data) {
    return <p className="text-sm text-destructive">Unable to load payments.</p>;
  }

  const { data } = paymentsQuery,
    missingCheckoutEnv = data.plans.filter(
      (plan) => plan.stripeMonthlyPriceId && !plan.envMonthlyPriceId
    ),
    configuredPlanCount = data.plans.filter(
      (plan) => plan.stripeMonthlyPriceId
    ).length,
    paymentMetrics = [
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
    ],
    handleSync = () => {
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
            const createdCount = result.results.filter(
              (r) => r.status === "created"
            ).length;
            toast({
              description:
                createdCount > 0
                  ? `${createdCount} subscription plan${createdCount === 1 ? "" : "s"} created & synced to Stripe.`
                  : `${result.results.length} subscription plans checked & up to date.`,
              title: "Stripe Catalog Synced",
            });
          },
        }
      );
    };

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <CircleDollarSign className="size-5 text-primary shrink-0" />
                <CardTitle className="text-base font-bold">
                  Payments &amp; Stripe Health
                </CardTitle>
                <Badge
                  className="shrink-0 text-xs font-semibold"
                  variant={data.stripeConfigured ? "secondary" : "destructive"}
                >
                  {data.stripeConfigured
                    ? "Stripe Connected"
                    : "Stripe Missing"}
                </Badge>
              </div>
              <CardDescription className="mt-1 text-xs">
                {data.stripeConfigured
                  ? missingCheckoutEnv.length > 0
                    ? `${missingCheckoutEnv.length} plan needs deployed checkout environment variables.`
                    : "Stripe setup is live and all linked checkout plans are ready."
                  : "Add STRIPE_SECRET_KEY before syncing or importing price IDs."}
              </CardDescription>
            </div>
            <Button
              className="shrink-0 font-medium shadow-sm"
              disabled={syncMutation.isPending}
              onClick={handleSync}
              size="sm"
            >
              <RefreshCw
                className={`mr-2 size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncMutation.isPending
                ? "Syncing Stripe…"
                : "Sync Products & Prices"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {paymentMetrics.map((metric) => (
              <div
                className="rounded-lg border bg-background/80 p-3.5 shadow-sm transition-colors"
                key={metric.label}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1.5 font-bold text-xl sm:text-2xl tabular-nums tracking-tight">
                  {metric.value}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {metric.supporting}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {missingCheckoutEnv.length > 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <TriangleAlert className="size-4 text-amber-500" />
          <AlertTitle className="text-amber-500 font-semibold">
            Checkout Env Vars Need Updating
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Synced DB price IDs are visible here. Copy the matching monthly and
            annual IDs into the listed env keys before testing paid checkout.
          </AlertDescription>
        </Alert>
      )}

      <PaymentPlanCatalog plans={data.plans} stripePrices={data.stripePrices} />

      <PremiumGrantCard />

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentTransactions transactions={data.recentTransactions} />
        <StripeCatalog prices={data.stripePrices} />
      </section>
    </div>
  );
}

function CouponsManagerCard() {
  const queryClient = useQueryClient(),
    syncPlansMutation = useSyncStripePlansMutation(),
    [isDialogOpen, setIsDialogOpen] = useState(false),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [percentOff, setPercentOff] = useState("17"),
    duration = "forever" as const,
    [maxRedemptions, setMaxRedemptions] = useState(""),
    {
      data: couponsData,
      error: couponsError,
      isLoading,
      refetch,
    } = useQuery({
      queryFn: async () => {
        const res = await fetch(
          `${API_V1_URL}/admin/finance/payments/coupons`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(body.message ?? "Failed to load coupons");
        }
        return (await res.json()) as {
          coupons: {
            active: boolean;
            code: string;
            coupon: {
              amount_off?: number | null;
              currency?: string | null;
              duration: string;
              id: string;
              name?: string | null;
              percent_off?: number | null;
            };
            id: string;
            max_redemptions?: number | null;
            times_redeemed: number;
          }[];
          message?: string;
          stripeConfigured?: boolean;
        };
      },
      queryKey: ["admin", "stripe-coupons"],
    }),
    coupons = couponsData?.coupons ?? [],
    handleCreateCoupon = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(name.trim() && code.trim())) {
        toast({
          description: "Add both a coupon name and customer-facing promo code.",
          title: "Coupon details required",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        code: code.trim().toUpperCase(),
        duration,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        name: name.trim(),
        percentOff: Number(percentOff) || 17,
      };

      try {
        const res = await fetch(
          `${API_V1_URL}/admin/finance/payments/coupons`,
          {
            body: JSON.stringify(payload),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );

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
    },
    handleDeleteCoupon = async (couponId: string) => {
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
    },
    handleSyncStripe = async () => {
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
                <TableHead>Redemptions</TableHead>
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
              ) : couponsError ? (
                <TableRow>
                  <TableCell
                    className="py-8 text-center text-sm text-destructive"
                    colSpan={5}
                  >
                    {couponsError.message}
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
                      {c.code}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {c.coupon.name}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-500">
                      {c.coupon.percent_off
                        ? `${c.coupon.percent_off}% OFF`
                        : `$${(c.coupon.amount_off ?? 0) / 100} OFF`}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {c.times_redeemed.toLocaleString()} /{" "}
                      {c.max_redemptions?.toLocaleString() ?? "Unlimited"}
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
                <Label htmlFor="couponCode">Customer Promo Code</Label>
                <Input
                  autoComplete="off"
                  id="couponCode"
                  name="coupon-code"
                  placeholder="SUMMER17…"
                  required
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
                  max={100}
                  min={1}
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
                  min={1}
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

function PremiumGrantCard() {
  const queryClient = useQueryClient(),
    [planCode, setPlanCode] = useState("soundkit_premium_artist"),
    [search, setSearch] = useState(""),
    [selectedUserIds, setSelectedUserIds] = useState<string[]>([]),
    usersQuery = useQuery({
      enabled: search.trim().length >= 2,
      queryFn: async () => {
        const response = await fetch(
          `${API_V1_URL}/admin/finance/payments/users?q=${encodeURIComponent(search.trim())}`,
          { credentials: "include" }
        );
        if (!response.ok) {
          throw new Error("Unable to search users.");
        }
        return (await response.json()) as { users: AdminUserSummary[] };
      },
      queryKey: ["admin", "premium-user-search", search.trim()],
    }),
    grantMutation = useMutation({
      mutationFn: async () => {
        const response = await fetch(
            `${API_V1_URL}/admin/finance/payments/grant-premium`,
            {
              body: JSON.stringify({ planCode, userIds: selectedUserIds }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
            }
          ),
          body = (await response.json().catch(() => ({}))) as {
            grantedCount?: number;
            message?: string;
          };
        if (!response.ok) {
          throw new Error(body.message ?? "Unable to grant Premium.");
        }
        return body;
      },
      onError: (error) => {
        toast({
          description: error.message,
          title: "Premium grant failed",
          variant: "destructive",
        });
      },
      onSuccess: async (result) => {
        setSearch("");
        setSelectedUserIds([]);
        await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        toast({
          description: `${result.grantedCount ?? 0} user account${result.grantedCount === 1 ? "" : "s"} updated. Email and in-app notifications were sent.`,
          title: "Premium granted",
        });
      },
    }),
    searchResults = usersQuery.data?.users ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRoundCog className="size-4 text-primary" />
          Grant SoundKit Premium
        </CardTitle>
        <CardDescription>
          Search by name, email, or handle, select one or more users, then grant
          one year of complimentary Premium. Recipients receive an email and
          in-app welcome notification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="grid gap-2">
            <Label htmlFor="premium-plan">Premium plan</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              id="premium-plan"
              onChange={(event) => setPlanCode(event.target.value)}
              value={planCode}
            >
              <option value="soundkit_premium_artist">Artist Premium</option>
              <option value="soundkit_premium_fan">Fan Premium</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="premium-user-search">Find users</Label>
            <Input
              autoComplete="off"
              id="premium-user-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, or @handle"
              value={search}
            />
          </div>
        </div>

        {selectedUserIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
            <span className="text-sm font-medium">
              {selectedUserIds.length} selected
            </span>
            <Button
              onClick={() => setSelectedUserIds([])}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          </div>
        ) : null}

        {search.trim().length >= 2 ? (
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {usersQuery.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Searching…</p>
            ) : usersQuery.error ? (
              <p className="p-4 text-sm text-destructive">
                {usersQuery.error.message}
              </p>
            ) : searchResults.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No matching users.
              </p>
            ) : (
              searchResults.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <button
                    aria-pressed={isSelected}
                    className="flex w-full items-center justify-between gap-3 border-b p-3 text-left last:border-b-0 hover:bg-muted/40"
                    key={user.id}
                    onClick={() =>
                      setSelectedUserIds((current) =>
                        isSelected
                          ? current.filter((id) => id !== user.id)
                          : [...current, user.id]
                      )
                    }
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {user.name}
                        {user.username ? ` · @${user.username}` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {user.premiumPlan ? (
                        <Badge variant="outline">Already Premium</Badge>
                      ) : null}
                      <Badge variant={isSelected ? "default" : "secondary"}>
                        {isSelected ? "Selected" : "Select"}
                      </Badge>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Enter at least two characters to search the user database.
          </p>
        )}

        <Button
          className="w-full font-bold"
          disabled={selectedUserIds.length === 0 || grantMutation.isPending}
          onClick={() => grantMutation.mutate()}
          type="button"
        >
          {grantMutation.isPending
            ? "Granting Premium…"
            : `Grant Premium to ${selectedUserIds.length || 0} user${selectedUserIds.length === 1 ? "" : "s"}`}
        </Button>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold">
              Subscription Catalog
            </CardTitle>
            <CardDescription className="text-xs">
              Link SoundKit plan rows to Stripe prices and checkout environment
              keys.
            </CardDescription>
          </div>
          <Badge className="font-semibold" variant="outline">
            {plans.length} Plans
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {plans.map((plan) => (
            <PaymentPlanCard
              key={`${plan.code}:${plan.stripeMonthlyPriceId}:${plan.stripeAnnualPriceId}`}
              plan={plan}
              stripePrices={stripePrices}
            />
          ))}
        </div>
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
  const importMutation = useImportStripePlanMutation(),
    suggestedMonthly =
      stripePrices.find(
        (price) => price.planCode === plan.code && price.interval === "month"
      )?.id ?? "",
    suggestedAnnual =
      stripePrices.find(
        (price) => price.planCode === plan.code && price.interval === "year"
      )?.id ?? "",
    [monthlyPriceId, setMonthlyPriceId] = useState(
      plan.stripeMonthlyPriceId ?? suggestedMonthly
    ),
    [annualPriceId, setAnnualPriceId] = useState(
      plan.stripeAnnualPriceId ?? suggestedAnnual
    ),
    monthlyCheckoutReady =
      Boolean(plan.stripeMonthlyPriceId) &&
      plan.stripeMonthlyPriceId === plan.envMonthlyPriceId,
    annualCheckoutReady =
      !plan.annualPriceCents ||
      (Boolean(plan.stripeAnnualPriceId) &&
        plan.stripeAnnualPriceId === plan.envAnnualPriceId),
    checkoutReady = monthlyCheckoutReady && annualCheckoutReady,
    handleImport = () => {
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
    <div className="flex flex-col justify-between rounded-xl border bg-card/60 p-4 shadow-sm transition-all hover:border-border/80">
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
          <div className="min-w-0">
            <h4 className="font-bold text-sm tracking-tight text-foreground">
              {plan.name}
            </h4>
            <p className="font-mono text-xs text-muted-foreground truncate">
              {plan.code}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <Badge className="text-[11px] capitalize" variant="outline">
                {plan.audience}
              </Badge>
              <Badge
                className="text-[11px]"
                variant={plan.isActive ? "secondary" : "outline"}
              >
                {plan.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "text-xs font-semibold",
                checkoutReady
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              )}
              variant="outline"
            >
              {checkoutReady ? "Ready" : "Needs Setup"}
            </Badge>
            <Button
              className="h-8 gap-1.5 text-xs font-medium"
              disabled={importMutation.isPending}
              onClick={handleImport}
              size="sm"
              variant="outline"
            >
              <UploadCloud className="size-3.5" />
              {importMutation.isPending ? "Saving…" : "Save IDs"}
            </Button>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 text-xs">
          <div>
            <span className="block text-[11px] text-muted-foreground">
              Monthly Price
            </span>
            <span className="font-bold text-foreground text-sm tabular-nums">
              {formatCurrency(plan.monthlyPriceCents)}
            </span>
            <span className="text-[11px] text-muted-foreground"> / mo</span>
          </div>
          <div>
            <span className="block text-[11px] text-muted-foreground">
              Annual Price
            </span>
            <span className="font-bold text-foreground text-sm tabular-nums">
              {plan.annualPriceCents
                ? formatCurrency(plan.annualPriceCents)
                : "—"}
            </span>
            {plan.annualPriceCents ? (
              <span className="text-[11px] text-muted-foreground"> / yr</span>
            ) : null}
          </div>
        </div>

        {/* Stripe Price IDs Input Form */}
        <div className="space-y-3">
          <PriceIdField
            id={`${plan.code}-monthly`}
            label="Monthly Stripe Price ID"
            onChange={setMonthlyPriceId}
            value={monthlyPriceId}
          />
          {plan.annualPriceCents ? (
            <PriceIdField
              id={`${plan.code}-annual`}
              label="Annual Stripe Price ID"
              onChange={setAnnualPriceId}
              value={annualPriceId}
            />
          ) : null}
        </div>

        {/* Required Environment Keys */}
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
          <p className="font-semibold text-[11px] text-muted-foreground tracking-wider uppercase">
            Required Environment Variables
          </p>
          <EnvKeyLine
            isReady={monthlyCheckoutReady}
            label="Monthly Env Key"
            value={plan.envMonthlyKey ?? "not required"}
          />
          {plan.envAnnualKey ? (
            <EnvKeyLine
              isReady={annualCheckoutReady}
              label="Annual Env Key"
              value={plan.envAnnualKey}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EnvKeyLine({
  isReady,
  label,
  value,
}: Readonly<{ isReady: boolean; label: string; value: string }>) {
  const [copied, setCopied] = useState(false),
    handleCopy = async () => {
      if (!value || value === "not required") {
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ description: `${label} copied to clipboard.` });
      } catch {
        // ignore
      }
    };

  return (
    <div className="flex min-w-0 items-start justify-between gap-2 rounded-md bg-background/60 p-2 text-xs transition-colors hover:bg-background/90">
      <div className="flex min-w-0 items-start gap-2">
        {isReady ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
        ) : (
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        )}
        <div className="min-w-0">
          <p className="font-medium text-[11px] text-foreground">{label}</p>
          <p className="break-all font-mono text-[11px] text-muted-foreground">
            {value}
          </p>
        </div>
      </div>
      {value && value !== "not required" ? (
        <Button
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          size="icon"
          title="Copy env var name"
          type="button"
          variant="ghost"
        >
          {copied ? (
            <Check className="size-3 text-emerald-400" />
          ) : (
            <Copy className="size-3" />
          )}
        </Button>
      ) : null}
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
      <Label className="font-medium text-xs text-foreground/90" htmlFor={id}>
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
        <CardTitle className="text-base font-bold">
          Recent transactions
        </CardTitle>
        <CardDescription className="text-xs">
          Latest successful payments and platform fees.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[440px]">
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
                    <TableCell className="font-medium capitalize">
                      {transaction.transactionType}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {formatCurrency(transaction.amountCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
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
        <CardTitle className="text-base font-bold">Stripe prices</CardTitle>
        <CardDescription className="text-xs">
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
                <p className="font-medium text-sm">{price.productName}</p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {price.id}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-semibold tabular-nums">
                  {typeof price.unitAmount === "number"
                    ? formatCurrency(price.unitAmount)
                    : "-"}
                </p>
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3 text-emerald-500" />
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
  return <CouponsManagerCard />;
}
