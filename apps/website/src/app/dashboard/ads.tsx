"use client";

import { useUploadFiles } from "@better-upload/client";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleDollarSign,
  Globe2,
  MapPin,
  Megaphone,
  PlayCircle,
  Plus,
  Radio,
  Upload,
  WalletCards,
  ChevronDown,
  Layers,
  Sparkles,
  Eye,
  MousePointerClick,
  Info,
} from "lucide-react";
import { useMemo, useState } from "react";

import { WorldAndUSAMap } from "@/components/explore/world-and-usa-map";
import type { MapScope } from "@/components/explore/world-and-usa-map";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { MEDIA_BASE_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
import {
  useAdCampaignsQuery,
  useAdWalletQuery,
  useBillingCheckoutMutation,
  useCreateAdCampaignMutation,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import type {
  AdBillingType,
  AdCampaignSummary,
  AdCreativeFormat,
  AdPlacement,
  AdTarget,
  CreateAdCampaignBody,
} from "@/lib/soundkit-api-hooks";

interface AdsSearch {
  tab?: "builder" | "campaigns" | "library" | "wallet";
}

export const Route = createFileRoute("/dashboard/ads")({
  component: DashboardAdsPage,
  validateSearch: (search: Record<string, unknown>): AdsSearch => ({
    tab:
      search.tab === "builder" ||
      search.tab === "library" ||
      search.tab === "wallet" ||
      search.tab === "campaigns"
        ? search.tab
        : undefined,
  }),
});

interface TargetOption {
  code: string;
  label: string;
  regionGroup: "africa" | "europe" | "north-america" | "other";
  scope: MapScope;
  type: AdTarget["targetType"];
}

const targetOptions: readonly TargetOption[] = [
  // North America
  {
    code: "US-AL",
    label: "Alabama",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-AK",
    label: "Alaska",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-AZ",
    label: "Arizona",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-AR",
    label: "Arkansas",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-CA",
    label: "California",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-CO",
    label: "Colorado",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-FL",
    label: "Florida",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-GA",
    label: "Georgia",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-NY",
    label: "New York",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },
  {
    code: "US-TX",
    label: "Texas",
    regionGroup: "north-america",
    scope: "north-america",
    type: "state",
  },

  // Europe
  {
    code: "EU-UK",
    label: "United Kingdom",
    regionGroup: "europe",
    scope: "global",
    type: "country",
  },
  {
    code: "EU-DE",
    label: "Germany",
    regionGroup: "europe",
    scope: "global",
    type: "country",
  },
  {
    code: "EU-FR",
    label: "France",
    regionGroup: "europe",
    scope: "global",
    type: "country",
  },
  {
    code: "EU-ES",
    label: "Spain",
    regionGroup: "europe",
    scope: "global",
    type: "country",
  },
  {
    code: "EU-NL",
    label: "Netherlands",
    regionGroup: "europe",
    scope: "global",
    type: "country",
  },

  // Africa
  {
    code: "AF-NG",
    label: "Nigeria",
    regionGroup: "africa",
    scope: "global",
    type: "country",
  },
  {
    code: "AF-ZA",
    label: "South Africa",
    regionGroup: "africa",
    scope: "global",
    type: "country",
  },
  {
    code: "AF-EG",
    label: "Egypt",
    regionGroup: "africa",
    scope: "global",
    type: "country",
  },
  {
    code: "AF-KE",
    label: "Kenya",
    regionGroup: "africa",
    scope: "global",
    type: "country",
  },
  {
    code: "AF-GH",
    label: "Ghana",
    regionGroup: "africa",
    scope: "global",
    type: "country",
  },
];

function DashboardAdsPage() {
  const navigate = Route.useNavigate(),
    search = Route.useSearch(),
    activeTab = search.tab ?? "campaigns",
    { toast } = useToast(),
    campaignsQuery = useAdCampaignsQuery(),
    walletQuery = useAdWalletQuery(),
    createCampaignMutation = useCreateAdCampaignMutation(),
    checkoutMutation = useBillingCheckoutMutation(),
    campaigns = campaignsQuery.data ?? [],
    wallet = walletQuery.data,
    [selectedCampaign, setSelectedCampaign] =
      useState<AdCampaignSummary | null>(null),
    handleTabChange = (val: string) => {
      navigate({ search: { tab: val as AdsSearch["tab"] } });
    },
    handleTopUpWallet = async (amountCents: number) => {
      try {
        const result = await checkoutMutation.mutateAsync({
          cancelUrl: window.location.href,
          customerType: "organization",
          planCode: "artist_pro",
          successUrl: window.location.href,
        });
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        }
      } catch {
        toast({
          description: "Redirecting to Stripe Billing checkout...",
          title: "Stripe Billing",
        });
      }
    };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            SoundKit Ads & Pre-Roll Campaigns
          </h1>
          <p className="text-muted-foreground">
            Run audio & video pre-roll ads, target macro regions & continents,
            and manage your advertiser balance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleTabChange("builder")}
            className="gap-2 font-bold"
          >
            <Plus className="size-4" /> Create Campaign
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="campaigns">
            Active Campaigns ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="builder">Campaign Builder</TabsTrigger>
          <TabsTrigger value="library">Media Library</TabsTrigger>
          <TabsTrigger value="wallet">Wallet &amp; Billing</TabsTrigger>
        </TabsList>

        {/* Tab 1: Active Campaigns */}
        <TabsContent value="campaigns" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Impressions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaigns
                    .reduce((sum, c) => sum + c.metrics.impressions, 0)
                    .toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all active campaigns
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Clicks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaigns
                    .reduce((sum, c) => sum + c.metrics.clicks, 0)
                    .toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Direct listener interactions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Ad Wallet Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {new Intl.NumberFormat("en-US", {
                      currency: wallet?.currency ?? "USD",
                      style: "currency",
                    }).format((wallet?.balanceCents ?? 0) / 100)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prepaid ad balance
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("wallet")}
                >
                  Top Up
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active &amp; Past Campaigns</CardTitle>
              <CardDescription>
                Inspect live campaign metrics, creative placements, and target
                regions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                  <Megaphone className="mx-auto size-10 mb-3 opacity-50" />
                  <p className="font-semibold text-foreground">
                    No campaigns created yet
                  </p>
                  <p className="mt-1 text-sm">
                    Create your first audio or video pre-roll campaign to reach
                    listeners.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => handleTabChange("builder")}
                  >
                    Build First Campaign
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Placement</TableHead>
                      <TableHead>Impressions</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold">
                          {c.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === "active"
                                ? "default"
                                : (c.status === "exhausted_for_today"
                                  ? "secondary"
                                  : "outline")
                            }
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {c.placement.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.metrics.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {c.metrics.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedCampaign(c)}
                          >
                            View Info &amp; ID
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Accordion-Based Campaign Builder */}
        <TabsContent value="builder" className="mt-6 space-y-6">
          <AccordionBuilderForm
            isPending={createCampaignMutation.isPending}
            onCreate={async (body) => {
              try {
                await createCampaignMutation.mutateAsync(body);
                toast({
                  description: `Campaign "${body.name}" has been created and set to active!`,
                  title: "Campaign Launched",
                });
                handleTabChange("campaigns");
              } catch {
                toast({
                  description: "Could not create campaign.",
                  title: "Error",
                  variant: "destructive",
                });
              }
            }}
          />
        </TabsContent>

        {/* Tab 3: Media Library */}
        <TabsContent value="library" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Creative Media Library</CardTitle>
              <CardDescription>
                Your pre-roll audio tracks, video clips, and display banners.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((campaign) => (
                  <div
                    className="space-y-3 rounded-lg border bg-card p-4"
                    key={`creative-${campaign.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-sm">
                        {campaign.name}
                      </p>
                      <Badge variant="outline">{campaign.creativeFormat}</Badge>
                    </div>
                    {campaign.creativeFormat === "audio" ? (
                      <audio
                        className="w-full"
                        controls
                        src={campaign.creativeUrl}
                      />
                    ) : (campaign.creativeFormat === "video" ? (
                      <video
                        className="aspect-video w-full rounded object-cover"
                        controls
                        src={campaign.creativeUrl}
                      />
                    ) : (
                      <AppImage
                        alt={campaign.name}
                        className="aspect-video w-full rounded object-cover"
                        height={180}
                        src={campaign.creativeImageUrl ?? campaign.creativeUrl}
                        width={320}
                      />
                    ))}
                  </div>
                ))}
                {campaigns.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No uploaded ad creatives yet.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Wallet & Stripe Billing */}
        <TabsContent value="wallet" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="size-5 text-primary" />
                SoundKit Ads Wallet &amp; Billing
              </CardTitle>
              <CardDescription>
                Prepay your advertiser balance via Stripe to fund live pre-roll
                campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-lg border bg-accent/30">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Current Available Balance
                  </p>
                  <p className="text-4xl font-bold text-emerald-400 mt-1">
                    {new Intl.NumberFormat("en-US", {
                      currency: wallet?.currency ?? "USD",
                      style: "currency",
                    }).format((wallet?.balanceCents ?? 0) / 100)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => handleTopUpWallet(5000)}>
                    +$50 Top Up
                  </Button>
                  <Button
                    onClick={() => handleTopUpWallet(10_000)}
                    variant="outline"
                  >
                    +$100 Top Up
                  </Button>
                  <Button
                    onClick={() => handleTopUpWallet(25_000)}
                    variant="outline"
                  >
                    +$250 Top Up
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  Automatic Campaign Billing
                </p>
                <p className="text-xs text-muted-foreground">
                  When you launch campaigns, impressions are automatically
                  billed against your balance at a CPM rate. Admin house ads run
                  with zero budget.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign Detail Dialog */}
      {selectedCampaign && (
        <Dialog
          open={Boolean(selectedCampaign)}
          onOpenChange={() => setSelectedCampaign(null)}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedCampaign.name}</span>
                <Badge variant="outline">{selectedCampaign.status}</Badge>
              </DialogTitle>
              <DialogDescription>
                Campaign ID:{" "}
                <code className="text-xs text-primary font-mono">
                  {selectedCampaign.id}
                </code>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted text-xs">
                <div>
                  <span className="text-muted-foreground">Placement:</span>
                  <p className="font-semibold">
                    {selectedCampaign.placement.replaceAll("_", " ")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Format:</span>
                  <p className="font-semibold">
                    {selectedCampaign.creativeFormat}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Total Impressions:
                  </span>
                  <p className="font-semibold">
                    {selectedCampaign.metrics.impressions.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Clicks:</span>
                  <p className="font-semibold">
                    {selectedCampaign.metrics.clicks.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold">
                  Target Regions ({selectedCampaign.targets.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedCampaign.targets.map((t) => (
                    <Badge
                      key={t.targetCode}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {t.targetCode} ({t.targetType})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Accordion-Based Campaign Builder
function AccordionBuilderForm({
  isPending,
  onCreate,
}: {
  isPending: boolean;
  onCreate: (body: CreateAdCampaignBody) => void;
}) {
  const [activeStep, setActiveStep] = useState<string>("step-1"),
    tracksQuery = useTracksQuery(),
    catalogTracks = tracksQuery.data ?? [],
    // Form State
    [name, setName] = useState(""),
    [placement, setPlacement] = useState<AdPlacement>("audio_preroll"),
    [format, setFormat] = useState<AdCreativeFormat>("audio"),
    [destinationUrl, setDestinationUrl] = useState("https://mysoundkit.com"),
    [attachedFile, setAttachedFile] = useState<File | null>(null),
    [mediaPreviewUrl, setMediaPreviewUrl] = useState(""),
    [creativeUrl, setCreativeUrl] = useState(""),
    [mapScope, setMapScope] = useState<MapScope>("north-america"),
    [selectedCodes, setSelectedCodes] = useState<string[]>(["US-AR"]),
    [billingType, setBillingType] = useState<AdBillingType>("prepaid_wallet"),
    [budgetDollars, setBudgetDollars] = useState(50),
    { isPending: isUploading, upload } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      onError: () => {
        setCreativeUrl("");
      },
      onUploadComplete: ({ files }) => {
        const uploadedFile = files[0];
        if (uploadedFile) {
          setCreativeUrl(`${MEDIA_BASE_URL}/${uploadedFile.objectInfo.key}`);
        }
      },
      route: "media",
    }),
    handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      const maxBytes = file.type.startsWith("image/")
        ? 10 * 1024 * 1024
        : 100 * 1024 * 1024;
      if (file.size > maxBytes) {
        return;
      }
      setAttachedFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      const nextFormat = file.type.startsWith("video/")
        ? "video"
        : (file.type.startsWith("image/")
          ? "image"
          : "audio");
      setFormat(nextFormat);
      setPlacement(
        nextFormat === "audio"
          ? "audio_preroll"
          : (nextFormat === "video"
            ? "video_preroll"
            : "video_overlay")
      );
      void upload([file]);
    },
    handleMacroSelect = (
      group: "africa" | "all" | "europe" | "north-america"
    ) => {
      if (group === "all") {
        setSelectedCodes(targetOptions.map((t) => t.code));
      } else {
        setSelectedCodes(
          targetOptions
            .filter((t) => t.regionGroup === group)
            .map((t) => t.code)
        );
      }
    },
    handleSubmit = () => {
      if (!name.trim()) {
        return;
      }

      const targets: AdTarget[] = selectedCodes.map((code) => {
        const match = targetOptions.find((t) => t.code === code);
        return {
          targetCode: code,
          targetType: match?.type ?? "state",
        };
      });

      onCreate({
        billingType,
        clickthroughUrl: destinationUrl,
        creativeFormat: format,
        creativeImageUrl: format === "image" ? creativeUrl : undefined,
        creativeUrl,
        dailyBudgetCents: budgetDollars * 100,
        dailyImpressionCap: 1000,
        name,
        placement,
        targets:
          targets.length > 0
            ? targets
            : [{ targetCode: "US-AR", targetType: "state" }],
      });
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Campaign Builder (3 Step Accordion)
        </CardTitle>
        <CardDescription>
          Complete creative details, select macro audience targets, and launch
          your ad campaign.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion
          type="single"
          value={activeStep}
          onValueChange={setActiveStep}
          collapsible
          className="w-full"
        >
          {/* Step 1: Creative & Media */}
          <AccordionItem value="step-1">
            <AccordionTrigger className="font-semibold text-base">
              Step 1: Campaign Info &amp; Creative Asset Attachment
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ad-name">Campaign Name *</Label>
                  <Input
                    id="ad-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Summer Single Pre-Roll"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placement">Ad Placement</Label>
                  <Select
                    value={placement}
                    onValueChange={(val) => setPlacement(val as AdPlacement)}
                  >
                    <SelectTrigger id="placement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="audio_preroll">
                        Audio Pre-Roll
                      </SelectItem>
                      <SelectItem value="video_preroll">
                        Video Pre-Roll
                      </SelectItem>
                      <SelectItem value="video_overlay">
                        Display Overlay
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="catalog-ad-track">
                  Promote an uploaded song
                </Label>
                <Select
                  onValueChange={(trackId) => {
                    const track = catalogTracks.find(
                      (item) => item.id === trackId
                    );
                    if (!track) {
                      return;
                    }
                    setDestinationUrl(
                      `${window.location.origin}/tracks/${track.id}`
                    );
                    if (track.coverArtUrl) {
                      setCreativeUrl(track.coverArtUrl);
                      setMediaPreviewUrl(track.coverArtUrl);
                      setFormat("image");
                      setPlacement("video_overlay");
                    }
                    setName((current) => current || `Promote ${track.title}`);
                  }}
                >
                  <SelectTrigger id="catalog-ad-track">
                    <SelectValue placeholder="Select one of your tracks (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogTracks.map((track) => (
                      <SelectItem key={track.id} value={track.id}>
                        {track.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Attachment Upload */}
              <div className="space-y-2 border border-dashed rounded-lg p-4 bg-muted/30">
                <Label className="font-semibold">
                  Attach Creative Asset File
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="audio/*,video/*,image/*"
                    onChange={handleFileSelected}
                  />
                </div>
                {mediaPreviewUrl ? (
                  <div className="mt-3 overflow-hidden rounded-lg border bg-background p-3">
                    {format === "audio" ? (
                      <audio
                        className="w-full"
                        controls
                        src={mediaPreviewUrl}
                      />
                    ) : (format === "video" ? (
                      <video
                        className="aspect-video w-full rounded object-cover"
                        controls
                        src={mediaPreviewUrl}
                      />
                    ) : (
                      <img
                        alt="Ad creative preview"
                        className="max-h-64 w-full rounded object-contain"
                        src={mediaPreviewUrl}
                      />
                    ))}
                  </div>
                ) : null}
                {attachedFile && (
                  <div className="mt-2 p-2 rounded bg-accent/40 text-xs font-semibold flex items-center justify-between">
                    <span>
                      Attached: {attachedFile.name} (
                      {(attachedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Ready
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dest-url">Destination URL</Label>
                <Input
                  id="dest-url"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://mysoundkit.com/artist/..."
                />
              </div>

              <Button
                type="button"
                className="mt-2"
                onClick={() => setActiveStep("step-2")}
                disabled={!name.trim()}
              >
                Proceed to Step 2: Targeting
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* Step 2: Target Audience & Macro Regions */}
          <AccordionItem value="step-2">
            <AccordionTrigger className="font-semibold text-base">
              Step 2: Target Audience &amp; Macro Region Selection (
              {selectedCodes.length} Selected)
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Select an entire continent or pick specific states and
                countries.
              </p>

              {/* Macro Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMacroSelect("north-america")}
                >
                  All North America (
                  {
                    targetOptions.filter(
                      (t) => t.regionGroup === "north-america"
                    ).length
                  }
                  )
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMacroSelect("europe")}
                >
                  All Europe (
                  {
                    targetOptions.filter((t) => t.regionGroup === "europe")
                      .length
                  }
                  )
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMacroSelect("africa")}
                >
                  All Africa (
                  {
                    targetOptions.filter((t) => t.regionGroup === "africa")
                      .length
                  }
                  )
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleMacroSelect("all")}
                >
                  Global / All Regions ({targetOptions.length})
                </Button>
              </div>

              {/* Interactive Map */}
              <div className="rounded-lg border overflow-hidden p-2 bg-background">
                <WorldAndUSAMap
                  mapScope={mapScope}
                  onRegionSelect={(regionName) => {
                    const target = targetOptions.find(
                      (option) =>
                        option.code === regionName ||
                        option.label === regionName
                    );
                    if (target) {
                      setSelectedCodes([target.code]);
                    }
                  }}
                  onScopeChange={setMapScope}
                  selectedRegion={
                    selectedCodes.length === 1 ? selectedCodes[0] : null
                  }
                  selectedRegions={selectedCodes}
                />
              </div>

              <Button
                type="button"
                className="mt-2"
                onClick={() => setActiveStep("step-3")}
              >
                Proceed to Step 3: Budget &amp; Launch
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* Step 3: Budget & Launch */}
          <AccordionItem value="step-3">
            <AccordionTrigger className="font-semibold text-base">
              Step 3: Budget &amp; Campaign Launch
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Type</Label>
                  <Select
                    value={billingType}
                    onValueChange={(val) =>
                      setBillingType(val as AdBillingType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepaid_wallet">
                        Prepaid Wallet
                      </SelectItem>
                      <SelectItem value="upfront_recurring">
                        Recurring Billing
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Budget Amount ($ USD)</Label>
                  <Input
                    type="number"
                    value={budgetDollars}
                    onChange={(e) => setBudgetDollars(Number(e.target.value))}
                  />
                </div>
              </div>

              <Button
                type="button"
                className="w-full font-bold text-base py-6"
                disabled={
                  isPending || isUploading || !name.trim() || !creativeUrl
                }
                onClick={handleSubmit}
              >
                {isUploading
                  ? "Uploading Creative..."
                  : (isPending
                    ? "Launching Campaign..."
                    : "Launch Ad Campaign")}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
