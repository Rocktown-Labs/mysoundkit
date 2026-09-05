/* eslint-disable complexity, no-nested-ternary, oxc/branches-sharing-code, react/no-unescaped-entities, no-unused-vars, sort-vars, one-var, prefer-destructuring, jsx-a11y/media-has-caption */
import { useUploadFiles } from "@better-upload/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  BrainCircuit,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Disc3,
  ExternalLink,
  Globe2,
  Landmark,
  Megaphone,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UploadCloud,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AudioDiagnosticsPanel } from "@/components/admin/audio-diagnostics-panel";
import { AdCreativeUploader } from "@/components/ads/ad-creative-uploader";
import type { AdSlotKind } from "@/components/ads/ad-creative-uploader";
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
  CardFooter,
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
  useAdminAudioIndexMutation,
  useAdminAudioSpikeMutation,
  useAdminEmbeddingBackfillMutation,
  useAdminEmbeddingStatusQuery,
  useAdminFinanceSummaryQuery,
  useAdminOverviewQuery,
  useAdminPaymentsQuery,
  useBackfillTrackDurationsMutation,
  useImportStripePlanMutation,
  useSyncStripePlansMutation,
  useTrackDurationBackfillStatusQuery,
} from "@/lib/soundkit-api-hooks";
import type { AudioSpikeReport } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/admin")({
  component: AdminDashboard,
});

type PendingAction =
  | { action: "ban"; userId: string; userName: string }
  | { action: "delete"; userId: string; userName: string }
  | { action: "revoke"; userId: string; userName: string }
  | null;

interface StripeWebhookSetupResult {
  connect: boolean;
  id: string | null;
  secret: string | null;
  secretConfigured: boolean;
  status: "created" | "enabled" | "missing" | "skipped";
  url: string;
}

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
  creatorEligibility: "independent" | "major_label_affiliated" | null;
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
      .includes("admin") ?? false,
  isUsableStripeId = (priceId: string | null) =>
    Boolean(priceId && !priceId.startsWith("price_dev_"));

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

      <Tabs defaultValue={initialAdminTab()}>
        <div className="max-w-full pb-1">
          <TabsList
            className="h-auto w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-10"
            style={{ display: "grid" }}
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="ads">Ads</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger className="scroll-mt-20" value="genres">
              Genres
            </TabsTrigger>
            <TabsTrigger className="scroll-mt-20" value="regions">
              Regions
            </TabsTrigger>
            <TabsTrigger className="scroll-mt-20" value="open-verses">
              Open Verses
            </TabsTrigger>
          </TabsList>
        </div>
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
        <TabsContent value="operations" className="mt-6">
          <PlatformOperationsPanel />
        </TabsContent>
        <TabsContent value="audio" className="mt-6">
          <AudioDiagnosticsPanel />
        </TabsContent>
        <TabsContent value="genres" className="mt-6">
          <GenreCatalogPanel />
        </TabsContent>
        <TabsContent value="regions" className="mt-6">
          <RegionCoveragePanel />
        </TabsContent>
        <TabsContent value="open-verses" className="mt-6">
          <OpenVerseAdminPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function initialAdminTab() {
  if (typeof window === "undefined") {
    return "overview";
  }
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "audio" ? "audio" : "overview";
}

function PlatformOperationsPanel() {
  const financeQuery = useAdminFinanceSummaryQuery(),
    embeddingsQuery = useAdminEmbeddingStatusQuery(),
    backfillEmbeddings = useAdminEmbeddingBackfillMutation(),
    audioSpike = useAdminAudioSpikeMutation(),
    audioIndex = useAdminAudioIndexMutation(),
    embeddingCounts = embeddingsQuery.data?.byEntityType ?? {},
    [spikeTracks, setSpikeTracks] = useState(""),
    [spikeProbes, setSpikeProbes] = useState("summer, dark, anthemic"),
    [spikeReport, setSpikeReport] = useState<AudioSpikeReport | null>(null),
    runSpike = () => {
      const trackIds = spikeTracks
          .split(/[\n,]/u)
          .map((part) => part.trim())
          .filter(Boolean),
        probes = spikeProbes
          .split(/[\n,]/u)
          .map((part) => part.trim())
          .filter(Boolean);
      if (trackIds.length === 0 || probes.length === 0) {
        toast({
          description: "Add track IDs and at least one probe word.",
          title: "Spike needs input",
          variant: "destructive",
        });
        return;
      }
      setSpikeReport(null);
      audioSpike.mutate(
        { probes, trackIds },
        {
          onError: () => {
            toast({
              description:
                "The audio spike failed — check the model id and API key.",
              title: "Spike failed",
              variant: "destructive",
            });
          },
          onSuccess: (report) => {
            setSpikeReport(report);
            toast({
              description: `${report.tested.length} tracks tested · ${report.skipped.length} skipped. Judge whether text queries land on the right tracks.`,
              title: "Spike complete",
            });
          },
        }
      );
    };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Finance summary</CardTitle>
          <CardDescription>
            Successful transaction volume and retained platform fees.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <AdminMetric
            label="Transactions"
            value={`${financeQuery.data?.transactionCount ?? 0}`}
          />
          <AdminMetric
            label="Successful volume"
            value={formatCurrency(
              financeQuery.data?.successfulTransactionCents ?? 0
            )}
          />
          <AdminMetric
            label="Platform fees"
            value={formatCurrency(financeQuery.data?.platformFeeCents ?? 0)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="size-5 text-primary" /> Search embeddings
          </CardTitle>
          <CardDescription>
            Monitor semantic-search coverage and backfill missing catalog
            embeddings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {embeddingsQuery.data?.total ?? 0} indexed
            </Badge>
            {Object.entries(embeddingCounts).map(([entityType, count]) => (
              <Badge key={entityType} variant="outline">
                {entityType}: {count}
              </Badge>
            ))}
          </div>
          <Button
            disabled={backfillEmbeddings.isPending}
            onClick={() =>
              backfillEmbeddings.mutate(100, {
                onError: () => {
                  toast({
                    description: "The embedding backfill failed to run.",
                    title: "Backfill failed",
                    variant: "destructive",
                  });
                },
                onSuccess: (result) => {
                  toast({
                    description: `${result.indexed} indexed · ${result.skipped} unchanged skipped.`,
                    title: "Backfill complete",
                  });
                },
              })
            }
          >
            <RefreshCw
              className={cn(
                "size-4",
                backfillEmbeddings.isPending && "animate-spin"
              )}
              data-icon="inline-start"
            />
            {backfillEmbeddings.isPending
              ? "Indexing catalog…"
              : "Backfill 100 per type"}
          </Button>
          <div className="space-y-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Audio cross-modal spike</p>
              <p className="text-xs text-muted-foreground">
                Embed up to 5 tracks&apos; audio and rank them per probe word.
                If text queries land on the right tracks, the shared-space bet
                is real — then index audio vectors and try ?fuse=0.3 on semantic
                search.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="spike-tracks">
                  Track IDs (comma separated)
                </Label>
                <Input
                  id="spike-tracks"
                  onChange={(event) => setSpikeTracks(event.target.value)}
                  placeholder="track_abc, track_def"
                  value={spikeTracks}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="spike-probes">Probe words</Label>
                <Input
                  id="spike-probes"
                  onChange={(event) => setSpikeProbes(event.target.value)}
                  value={spikeProbes}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={audioSpike.isPending}
                onClick={runSpike}
                size="sm"
                variant="outline"
              >
                {audioSpike.isPending ? "Testing…" : "Run spike"}
              </Button>
              <Button
                disabled={
                  audioIndex.isPending || spikeTracks.trim().length === 0
                }
                onClick={() =>
                  audioIndex.mutate(
                    {
                      trackIds: spikeTracks
                        .split(/[\n,]/u)
                        .map((part) => part.trim())
                        .filter(Boolean),
                    },
                    {
                      onError: () => {
                        toast({
                          description: "Audio indexing failed.",
                          title: "Index failed",
                          variant: "destructive",
                        });
                      },
                      onSuccess: (result) => {
                        const done = result.results.filter(
                          (entry) => entry.status === "inserted"
                        ).length;
                        toast({
                          description: `${done} audio vectors stored. Try semantic search with ?fuse=0.3.`,
                          title: "Audio indexed",
                        });
                      },
                    }
                  )
                }
                size="sm"
                variant="outline"
              >
                {audioIndex.isPending ? "Indexing…" : "Index audio vectors"}
              </Button>
            </div>
            {spikeReport && (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  Model {spikeReport.model} · {spikeReport.tested.length} tested
                  {spikeReport.skipped.length > 0
                    ? ` · skipped: ${spikeReport.skipped.map((entry) => `${entry.title} (${entry.reason})`).join("; ")}`
                    : ""}
                </p>
                {spikeReport.probes.map((probe) => (
                  <div key={probe.query}>
                    <p className="font-medium">“{probe.query}”</p>
                    {probe.topTracks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No tracks ranked.
                      </p>
                    ) : (
                      <ol className="list-decimal pl-5 text-xs">
                        {probe.topTracks.map((hit) => (
                          <li key={hit.trackId}>
                            {hit.title} — {(hit.similarity * 100).toFixed(1)}%
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold text-lg tabular-nums">{value}</p>
    </div>
  );
}

interface AdminGenre {
  battleCount: number;
  description: string | null;
  id: string;
  name: string;
  openVerseCount: number;
  partyCount: number;
  projectCount: number;
  slug: string;
  totalCount: number;
  trackCount: number;
  videoCount: number;
}

function GenreCatalogPanel() {
  const queryClient = useQueryClient(),
    genresQuery = useQuery<AdminGenre[]>({
      queryFn: async () => {
        const response = await fetch(`${API_V1_URL}/admin/genres`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load genres.");
        }
        return (await response.json()) as AdminGenre[];
      },
      queryKey: ["admin", "genres"],
    }),
    createGenre = useMutation({
      mutationFn: async ({
        description,
        name,
      }: {
        description: string;
        name: string;
      }) => {
        const response = await fetch(`${API_V1_URL}/admin/genres`, {
          body: JSON.stringify({ description: description || undefined, name }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => null)) as
          | AdminGenre
          | { message?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            payload && "message" in payload
              ? payload.message
              : "Unable to create genre."
          );
        }
        return payload as AdminGenre;
      },
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "genres"] }),
    }),
    [name, setName] = useState(""),
    [description, setDescription] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Genre Catalog</CardTitle>
        <CardDescription>
          Manage the canonical genres used by onboarding and discovery. Genres
          are never deleted because catalog content references them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            createGenre.mutate(
              { description, name },
              {
                onError: (error) =>
                  toast({
                    description: error.message,
                    title: "Genre not created",
                    variant: "destructive",
                  }),
                onSuccess: () => {
                  setName("");
                  setDescription("");
                },
              }
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="new-genre-name">Name</Label>
            <Input
              id="new-genre-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Alternative R&B"
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-genre-description">
              Description (optional)
            </Label>
            <Input
              id="new-genre-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short catalog description"
              value={description}
            />
          </div>
          <Button
            className="self-end"
            disabled={!name.trim() || createGenre.isPending}
            type="submit"
          >
            <Plus className="mr-2 size-4" />
            {createGenre.isPending ? "Adding…" : "Add genre"}
          </Button>
        </form>
        {genresQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading genres…</p>
        ) : null}
        {genresQuery.error ? (
          <p className="text-sm text-destructive">
            Unable to load the genre catalog.
          </p>
        ) : null}
        {genresQuery.data ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Tracks</TableHead>
                  <TableHead>Videos</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Battles</TableHead>
                  <TableHead>Parties</TableHead>
                  <TableHead>Open Verses</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {genresQuery.data.map((genre) => (
                  <TableRow key={genre.id}>
                    <TableCell className="font-medium">{genre.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {genre.slug}
                    </TableCell>
                    <TableCell>{genre.trackCount}</TableCell>
                    <TableCell>{genre.videoCount}</TableCell>
                    <TableCell>{genre.projectCount}</TableCell>
                    <TableCell>{genre.battleCount}</TableCell>
                    <TableCell>{genre.partyCount}</TableCell>
                    <TableCell>{genre.openVerseCount}</TableCell>
                    <TableCell className="font-semibold">
                      {genre.totalCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface AdminOpenVerseListing {
  accessRequestCount: number;
  baseMasterAssetId: string | null;
  createdAt: string;
  genre: string | null;
  id: string;
  ownerDisplayName: string | null;
  ownerUserId: string;
  ownerUsername: string | null;
  previewAssetId: string | null;
  status: string;
  submissionCount: number;
  title: string;
  trackId: string;
  trackTitle: string | null;
}

const openVerseMediaHealth = (listing: AdminOpenVerseListing) =>
  listing.baseMasterAssetId
    ? listing.previewAssetId
      ? "Ready"
      : "Preview missing"
    : "Legacy / incomplete";

interface AdminRegionOverview {
  missingCountryCount: number;
  missingStateCount: number;
  regions: {
    artistCount: number;
    country: string;
    profileCount: number;
    projectCount: number;
    state: string;
    totalUploadCount: number;
    trackCount: number;
    videoCount: number;
  }[];
  totalProfileCount: number;
}

function RegionCoveragePanel() {
  const regionsQuery = useQuery<AdminRegionOverview>({
    queryFn: async () => {
      const response = await fetch(`${API_V1_URL}/admin/regions`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Unable to load regional coverage.");
      }
      return (await response.json()) as AdminRegionOverview;
    },
    queryKey: ["admin", "regions"],
  });

  if (regionsQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading regional coverage…
      </p>
    );
  }

  if (regionsQuery.error || !regionsQuery.data) {
    return (
      <p className="text-sm text-destructive">
        Unable to load regional coverage.
      </p>
    );
  }

  const coverage = regionsQuery.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="size-4 text-primary" />
          Regional catalog coverage
        </CardTitle>
        <CardDescription>
          See where SoundKit has members and uploads, and identify profiles that
          cannot participate in regional discovery yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricRow
            label="Profiles"
            value={coverage.totalProfileCount.toLocaleString()}
          />
          <MetricRow
            label="Missing country"
            value={coverage.missingCountryCount.toLocaleString()}
          />
          <MetricRow
            label="Missing state"
            value={coverage.missingStateCount.toLocaleString()}
          />
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>State / Region</TableHead>
                <TableHead>Profiles</TableHead>
                <TableHead>Artists</TableHead>
                <TableHead>Tracks</TableHead>
                <TableHead>Videos</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Uploads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverage.regions.map((region) => (
                <TableRow key={`${region.country}:${region.state}`}>
                  <TableCell className="font-medium">
                    {region.country}
                  </TableCell>
                  <TableCell>{region.state}</TableCell>
                  <TableCell>{region.profileCount}</TableCell>
                  <TableCell>{region.artistCount}</TableCell>
                  <TableCell>{region.trackCount}</TableCell>
                  <TableCell>{region.videoCount}</TableCell>
                  <TableCell>{region.projectCount}</TableCell>
                  <TableCell className="font-semibold">
                    {region.totalUploadCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function OpenVerseAdminPanel() {
  const queryClient = useQueryClient(),
    [listingToDelete, setListingToDelete] =
      useState<AdminOpenVerseListing | null>(null),
    listingsQuery = useQuery<AdminOpenVerseListing[]>({
      queryFn: async () => {
        const response = await fetch(`${API_V1_URL}/admin/open-verses`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load Open Verse listings.");
        }
        return (await response.json()) as AdminOpenVerseListing[];
      },
      queryKey: ["admin", "open-verses"],
    }),
    deleteListing = useMutation({
      mutationFn: async (listingId: string) => {
        const response = await fetch(
          `${API_V1_URL}/open-verses/${encodeURIComponent(listingId)}`,
          { credentials: "include", method: "DELETE" }
        );
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        if (!response.ok) {
          throw new Error(payload?.message ?? "Unable to delete the listing.");
        }
        return payload;
      },
      onError: (error) => {
        toast({
          description: error.message,
          title: "Listing not deleted",
          variant: "destructive",
        });
      },
      onSettled: () => setListingToDelete(null),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["admin", "open-verses"],
        });
        toast({
          description:
            "The listing and its access requests and submissions were removed. The underlying track was preserved.",
          title: "Open Verse deleted",
        });
      },
    });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Open Verse Catalog</CardTitle>
          <CardDescription>
            Inspect raw persisted listings, including legacy entries that cannot
            complete the current submission flow. Deleting a listing preserves
            its underlying track.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listingsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading Open Verse listings…
            </p>
          ) : null}
          {listingsQuery.error ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Unable to load Open Verses</AlertTitle>
              <AlertDescription>
                Refresh the page and try loading the catalog again.
              </AlertDescription>
            </Alert>
          ) : null}
          {listingsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Open Verse listings are stored.
            </p>
          ) : null}
          {listingsQuery.data?.length ? (
            <div className="flex flex-col gap-3 md:hidden">
              {listingsQuery.data.map((listing) => {
                const mediaHealth = openVerseMediaHealth(listing);
                return (
                  <Card key={listing.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {listing.title}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {listing.id}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {listing.status.replaceAll("_", " ")}
                        </Badge>
                        <Badge
                          variant={
                            mediaHealth === "Ready"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {mediaHealth}
                        </Badge>
                      </div>
                      <p>
                        <span className="text-muted-foreground">Owner:</span>{" "}
                        {listing.ownerDisplayName ?? "Unknown owner"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Track:</span>{" "}
                        {listing.trackTitle ?? "Missing track"}
                      </p>
                      <p className="text-muted-foreground">
                        {listing.accessRequestCount} requests ·{" "}
                        {listing.submissionCount} submissions ·{" "}
                        {new Date(listing.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button
                        aria-label={`Delete ${listing.title}`}
                        className="w-full"
                        onClick={() => setListingToDelete(listing)}
                        variant="destructive"
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : null}
          {listingsQuery.data?.length ? (
            <div className="hidden overflow-x-auto rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Track</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Media health</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Submissions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="sticky right-0 bg-background text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listingsQuery.data.map((listing) => {
                    const mediaHealth = openVerseMediaHealth(listing);
                    return (
                      <TableRow key={listing.id}>
                        <TableCell>
                          <div className="min-w-56">
                            <p className="font-medium">{listing.title}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {listing.id}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p>{listing.ownerDisplayName ?? "Unknown owner"}</p>
                          <p className="text-xs text-muted-foreground">
                            {listing.ownerUsername
                              ? `@${listing.ownerUsername}`
                              : listing.ownerUserId}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>{listing.trackTitle ?? "Missing track"}</p>
                          <p className="text-xs text-muted-foreground">
                            {listing.genre ?? "No genre"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {listing.status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              mediaHealth === "Ready"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {mediaHealth}
                          </Badge>
                        </TableCell>
                        <TableCell>{listing.accessRequestCount}</TableCell>
                        <TableCell>{listing.submissionCount}</TableCell>
                        <TableCell>
                          {new Date(listing.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="sticky right-0 bg-background text-right">
                          <Button
                            aria-label={`Delete ${listing.title}`}
                            onClick={() => setListingToDelete(listing)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !deleteListing.isPending) {
            setListingToDelete(null);
          }
        }}
        open={Boolean(listingToDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Open Verse?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{listingToDelete?.title}”, its access
              requests, and its submissions. The underlying track and unrelated
              media remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteListing.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!listingToDelete || deleteListing.isPending}
              onClick={() => {
                if (listingToDelete) {
                  deleteListing.mutate(listingToDelete.id);
                }
              }}
            >
              {deleteListing.isPending ? "Deleting…" : "Delete listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
    [dealEndsAt, setDealEndsAt] = useState(""),
    [readyCreative, setReadyCreative] = useState<File | null>(null),
    { isPending: isUploading, upload } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      onUploadComplete: ({ files }) => {
        const uploadedFile = files[0];
        if (uploadedFile) {
          setCreativeUrl(`${MEDIA_BASE_URL}/${uploadedFile.objectInfo.key}`);
        }
      },
      route: "media",
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
            endDate: dealEndsAt
              ? new Date(dealEndsAt).toISOString()
              : undefined,
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
        setDealEndsAt("");
        setReadyCreative(null);
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
        status: "active" | "paused" | "rejected";
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
            <AdCreativeUploader
              onFileReady={(readyFile) => {
                setReadyCreative(readyFile);
                setPreviewUrl(URL.createObjectURL(readyFile));
                const nextFormat = readyFile.type.startsWith("audio/")
                  ? "audio"
                  : readyFile.type.startsWith("video/")
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
                void upload([readyFile]);
              }}
              slot={
                (creativeFormat === "audio"
                  ? "audio"
                  : creativeFormat === "video"
                    ? "video"
                    : "image") satisfies AdSlotKind
              }
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
            <div className="space-y-2">
              <Label htmlFor="house-ad-deal-ends">Deal ends (optional)</Label>
              <Input
                id="house-ad-deal-ends"
                onChange={(event) => setDealEndsAt(event.target.value)}
                type="datetime-local"
                value={dealEndsAt}
              />
            </div>
            {readyCreative && (
              <p className="text-xs text-muted-foreground">
                Ready to upload: {readyCreative.name}
              </p>
            )}
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
                    {campaign.status === "pending_review" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({
                              campaignId: campaign.id,
                              status: "active",
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({
                              campaignId: campaign.id,
                              status: "rejected",
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            campaignId: campaign.id,
                            status:
                              campaign.status === "active"
                                ? "paused"
                                : "active",
                          })
                        }
                      >
                        Toggle Run Status
                      </Button>
                    )}
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
    completionHandledRef = useRef(false),
    runStartedRef = useRef(false),
    backfillStatus = useTrackDurationBackfillStatusQuery(backfillRunId),
    backfillSnapshot = backfillStatus.data,
    // Derive run state during render instead of syncing query data back
    // into state from effects (React Compiler set-state-in-effect).
    backfillInFlight =
      (backfillSnapshot?.queued ?? 0) + (backfillSnapshot?.processing ?? 0) > 0,
    displayRunId = backfillRunId ?? backfillSnapshot?.runId ?? null;

  useEffect(() => {
    // Completion toast only: refs and the toast external system are
    // effect-safe — no setState here. The started-ref gates this to runs
    // the admin actually kicked off, so stale latest-run data on mount
    // never toasts.
    if (
      !runStartedRef.current ||
      completionHandledRef.current ||
      !backfillSnapshot
    ) {
      return;
    }
    if (backfillSnapshot.processing + backfillSnapshot.queued > 0) {
      return;
    }
    completionHandledRef.current = true;
    runStartedRef.current = false;
    toast({
      description: `Backfill finished · ${backfillSnapshot.done} done${backfillSnapshot.failed > 0 ? ` · ${backfillSnapshot.failed} failed` : ""}.`,
      title: "Track durations backfilled",
    });
  }, [backfillSnapshot]);

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
          runStartedRef.current = true;
          setBackfillRunId(result.runId);
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
                {displayRunId && backfillStatus.data ? (
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
              disabled={backfillDurations.isPending || backfillInFlight}
              onClick={handleBackfillDurations}
              size="sm"
            >
              {backfillDurations.isPending || backfillInFlight ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              {backfillDurations.isPending
                ? "Backfilling..."
                : backfillInFlight
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
        } else if (action.action === "delete") {
          const result = await authClient.admin.removeUser({
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
          description:
            action.action === "delete"
              ? "The user account was deleted."
              : "The user account was updated.",
          title: action.action === "delete" ? "Deleted" : "Updated",
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
              <TableHead>Eligibility</TableHead>
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
                    <Badge variant="outline">
                      {user.creatorEligibility === "major_label_affiliated"
                        ? "Major-label affiliated"
                        : user.creatorEligibility === "independent"
                          ? "Independent"
                          : "Not declared"}
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={isSelf}
                          onSelect={() =>
                            setPendingAction({
                              action: "delete",
                              userId: user.id,
                              userName: user.name,
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                          Delete user
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
                : pendingAction?.action === "delete"
                  ? "Delete this user?"
                  : "Revoke all sessions?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "ban"
                ? `${pendingAction.userName} will be signed out and unable to sign in.`
                : pendingAction?.action === "delete"
                  ? `${pendingAction.userName}'s account and sessions will be permanently removed. Content they own is not deleted and would become orphaned.`
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
    syncMutation = useSyncStripePlansMutation(),
    [webhookSetup, setWebhookSetup] = useState<
      StripeWebhookSetupResult[] | null
    >(null);

  if (paymentsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payments...</p>;
  }

  if (paymentsQuery.error || !paymentsQuery.data) {
    return <p className="text-sm text-destructive">Unable to load payments.</p>;
  }

  const { data } = paymentsQuery,
    missingCheckoutEnv = data.plans.filter(
      (plan) =>
        !(
          isUsableStripeId(plan.envMonthlyPriceId) ||
          isUsableStripeId(plan.stripeMonthlyPriceId)
        )
    ),
    configuredPlanCount = data.plans.filter((plan) =>
      isUsableStripeId(plan.stripeMonthlyPriceId)
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
            setWebhookSetup(result.webhookEndpoints);
            const createdCount = result.results.filter(
                (r) => r.status === "created"
              ).length,
              matchedCount = result.results.filter(
                (r) => r.status === "matched"
              ).length,
              skippedCount = result.results.filter(
                (r) => r.status === "skipped"
              ).length;

            if (
              result.message?.includes("Stripe API note:") ||
              (createdCount === 0 && matchedCount === 0 && skippedCount > 0)
            ) {
              toast({
                description:
                  result.message ||
                  "No plans could be synced with Stripe. Verify your STRIPE_SECRET_KEY.",
                title: "Stripe Sync Notice",
                variant: "destructive",
              });
            } else {
              toast({
                description:
                  createdCount > 0
                    ? `${createdCount} subscription plan${createdCount === 1 ? "" : "s"} created & synced to Stripe.`
                    : `${matchedCount} subscription plan${matchedCount === 1 ? "" : "s"} checked & up to date.`,
                title: "Stripe Catalog Synced",
              });
            }
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
                    ? `${missingCheckoutEnv.length} plan has no Stripe price linked to checkout yet.`
                    : "Stripe setup is live and all linked checkout plans are ready from synced Stripe IDs."
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
                : "Sync Stripe Catalog & Webhooks"}
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
            {missingCheckoutEnv.length} Plan Lacks a Checkout Price
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Run Sync Stripe Catalog &amp; Webhooks to auto-create Stripe
            products, prices, and webhook endpoints and wire them into checkout,
            or enter matching price IDs below.
          </AlertDescription>
        </Alert>
      )}

      {webhookSetup ? (
        <StripeWebhookSetupCard endpoints={webhookSetup} />
      ) : null}

      <PaymentPlanCatalog plans={data.plans} stripePrices={data.stripePrices} />

      <StripeConnectManagerCard
        connectStats={data.connectStats}
        stripeConfigured={data.stripeConfigured}
      />

      <PremiumGrantCard />

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentTransactions transactions={data.recentTransactions} />
        <StripeCatalog prices={data.stripePrices} />
      </section>
    </div>
  );
}

function StripeWebhookSetupCard({
  endpoints,
}: {
  endpoints: StripeWebhookSetupResult[];
}) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Stripe webhook setup</CardTitle>
        <CardDescription>
          Sync creates or reuses the platform subscription, platform commerce,
          and Connect event endpoints. New signing secrets are shown only in
          this response.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {endpoints.map((endpoint) => (
          <div
            className="rounded-lg border bg-background/70 p-3"
            key={`${endpoint.url}:${endpoint.connect}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {endpoint.connect
                    ? "Connect events"
                    : endpoint.url.includes("/auth/")
                      ? "Better Auth subscriptions"
                      : "Platform commerce"}
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {endpoint.url}
                </p>
              </div>
              <Badge
                variant={
                  endpoint.status === "missing" ? "destructive" : "secondary"
                }
              >
                {endpoint.status}
              </Badge>
            </div>
            {endpoint.secret ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 text-xs">
                  {endpoint.secret}
                </code>
                <Button
                  onClick={() => {
                    void navigator.clipboard.writeText(endpoint.secret ?? "");
                    toast({
                      description:
                        "Webhook secret copied. Save it in the matching GitHub environment secret.",
                      title: "Secret copied",
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Copy className="mr-2 size-3.5" /> Copy secret
                </Button>
              </div>
            ) : endpoint.secretConfigured ? (
              <p className="mt-2 text-xs text-emerald-400">
                Signing secret is configured for this endpoint.
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-400">
                Endpoint exists, but its signing secret is not configured in the
                matching environment secret.
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StripeConnectManagerCard({
  connectStats,
  stripeConfigured,
}: {
  connectStats?: {
    activeCount: number;
    pendingCount: number;
    totalAccounts: number;
  };
  stripeConfigured: boolean;
}) {
  const total = connectStats?.totalAccounts ?? 0,
    active = connectStats?.activeCount ?? 0,
    pending = connectStats?.pendingCount ?? 0;

  return (
    <Card className="border-border/60 bg-card/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="size-4 text-primary" />
              <CardTitle className="text-base font-bold">
                Stripe Connect &amp; Artist Payouts
              </CardTitle>
              <Badge className="text-xs" variant="outline">
                Express / Split Payments
              </Badge>
            </div>
            <CardDescription className="mt-1 text-xs">
              Multi-party marketplace payout architecture for artist tracks,
              sample kits, and live event tips.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <a
              href="https://dashboard.stripe.com/connect/accounts/overview"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="mr-1.5 size-3.5" />
              Stripe Connect Dashboard
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground font-medium">
              Connected Artists
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">{total}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Accounts initialized
            </p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground font-medium">
              Payouts Enabled
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-500">
              {active}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Active &amp; verified
            </p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground font-medium">
              Onboarding Incomplete
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-amber-500">
              {pending}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Action required
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5 text-xs space-y-2.5">
          <p className="font-semibold text-foreground">
            Connect Routing &amp; Charge Model
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">
                  Charge Pattern:
                </span>{" "}
                <span className="text-muted-foreground">
                  Destination Charges with Platform Fee (10% on release sales)
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">
                  Onboarding Type:
                </span>{" "}
                <span className="text-muted-foreground">
                  Stripe Hosted Express Onboarding (V2 API + V1 Fallback)
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">
                  Capabilities:
                </span>{" "}
                <span className="text-muted-foreground">
                  card_payments &amp; transfers enabled
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">
                  Dashboard Access:
                </span>{" "}
                <span className="text-muted-foreground">
                  Express Dashboard for artists, full platform control for
                  SoundKit admin
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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

      let res: Response;
      try {
        res = await fetch(`${API_V1_URL}/admin/finance/payments/coupons`, {
          body: JSON.stringify(payload),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      } catch {
        toast({
          description: "Could not create coupon. Please try again.",
          title: "Error",
          variant: "destructive",
        });
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast({
          description: body.message ?? "Failed to create coupon",
          title: "Error",
          variant: "destructive",
        });
        return;
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
    },
    handleDeleteCoupon = async (couponId: string) => {
      let res: Response;
      try {
        res = await fetch(
          `${API_V1_URL}/admin/finance/payments/coupons/${encodeURIComponent(couponId)}`,
          {
            credentials: "include",
            method: "DELETE",
          }
        );
      } catch {
        toast({
          description: "Could not delete coupon.",
          title: "Error",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast({
          description: body.message ?? "Failed to delete coupon",
          title: "Error",
          variant: "destructive",
        });
        return;
      }
      refetch();
      toast({
        description: `Coupon ${couponId} archived.`,
        title: "Coupon Deleted",
      });
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
      isUsableStripeId(plan.envMonthlyPriceId) ||
      isUsableStripeId(plan.stripeMonthlyPriceId),
    monthlyEnvReady = Boolean(plan.envMonthlyPriceId),
    annualCheckoutReady =
      !plan.annualPriceCents ||
      isUsableStripeId(plan.envAnnualPriceId) ||
      isUsableStripeId(plan.stripeAnnualPriceId),
    annualEnvReady = Boolean(plan.envAnnualPriceId),
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

        {/* Optional Deploy-Time Env Keys */}
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
          <p className="font-semibold text-[11px] text-muted-foreground tracking-wider uppercase">
            Environment Variables (optional)
          </p>
          <EnvKeyLine
            isReady={monthlyEnvReady}
            label="Monthly Env Key"
            value={plan.envMonthlyKey ?? "not required"}
          />
          {plan.envAnnualKey ? (
            <EnvKeyLine
              isReady={annualEnvReady}
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
