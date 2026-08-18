"use client";

import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleDollarSign,
  Globe2,
  Map as MapIcon,
  Megaphone,
  PlayCircle,
  Plus,
  Radio,
  Trash2,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { WorldAndUSAMap } from "@/components/explore/world-and-usa-map";
import type { MapScope } from "@/components/explore/world-and-usa-map";
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
  DialogTrigger,
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
import { Separator } from "@/components/ui/separator";
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
import {
  useAdCampaignsQuery,
  useAdWalletQuery,
  useCreateAdCampaignMutation,
} from "@/lib/soundkit-api-hooks";
import type {
  AdBillingType,
  AdCreativeFormat,
  AdPlacement,
  AdTarget,
  CreateAdCampaignBody,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/ai-studio")({
  component: AdsManagerPage,
});

interface TargetOption {
  aliases?: readonly string[];
  code: string;
  label: string;
  scope: MapScope;
  type: AdTarget["targetType"];
}

const targetOptions: readonly TargetOption[] = [
    { code: "US-AL", label: "Alabama", scope: "north-america", type: "state" },
    { code: "US-AK", label: "Alaska", scope: "north-america", type: "state" },
    { code: "US-AZ", label: "Arizona", scope: "north-america", type: "state" },
    { code: "US-AR", label: "Arkansas", scope: "north-america", type: "state" },
    {
      code: "US-CA",
      label: "California",
      scope: "north-america",
      type: "state",
    },
    { code: "US-CO", label: "Colorado", scope: "north-america", type: "state" },
    {
      code: "US-FL",
      label: "Florida",
      scope: "north-america",
      type: "state",
    },
    { code: "US-GA", label: "Georgia", scope: "north-america", type: "state" },
    { code: "US-IL", label: "Illinois", scope: "north-america", type: "state" },
    {
      code: "US-LA",
      label: "Louisiana",
      scope: "north-america",
      type: "state",
    },
    { code: "US-NY", label: "New York", scope: "north-america", type: "state" },
    {
      code: "US-TN",
      label: "Tennessee",
      scope: "north-america",
      type: "state",
    },
    { code: "US-TX", label: "Texas", scope: "north-america", type: "state" },
    {
      aliases: ["United States of America", "United States"],
      code: "US",
      label: "United States",
      scope: "global",
      type: "country",
    },
    { code: "CA", label: "Canada", scope: "global", type: "country" },
    { code: "MX", label: "Mexico", scope: "latin-america", type: "country" },
    { code: "BR", label: "Brazil", scope: "latin-america", type: "country" },
    {
      aliases: ["United Kingdom"],
      code: "GB",
      label: "United Kingdom",
      scope: "europe",
      type: "country",
    },
    { code: "FR", label: "France", scope: "europe", type: "country" },
    { code: "DE", label: "Germany", scope: "europe", type: "country" },
    { code: "NG", label: "Nigeria", scope: "africa", type: "country" },
    { code: "ZA", label: "South Africa", scope: "africa", type: "country" },
    { code: "JP", label: "Japan", scope: "asia", type: "country" },
    { code: "KR", label: "South Korea", scope: "asia", type: "country" },
    { code: "AU", label: "Australia", scope: "oceania", type: "country" },
  ] as const,
  targetKey = (target: AdTarget) => `${target.targetType}:${target.targetCode}`,
  targetOptionByRegion = new Map(
    targetOptions.flatMap((target) =>
      [target.label, ...(target.aliases ?? [])].map(
        (label) => [label.toLowerCase(), target] as const
      )
    )
  ),
  targetOptionByKey = new Map(
    targetOptions.map((target) => [targetKey(toAdTarget(target)), target])
  );

function toAdTarget(target: TargetOption): AdTarget {
  return {
    targetCode: target.code,
    targetType: target.type,
  };
}

function targetLabel(target: AdTarget) {
  return targetOptionByKey.get(targetKey(target))?.label ?? target.targetCode;
}

function targetRegionNames(target: AdTarget) {
  const option = targetOptionByKey.get(targetKey(target));

  if (!option) {
    return [target.targetCode];
  }

  return [option.label, ...(option.aliases ?? [])];
}

const money = (cents: number | null | undefined) =>
    cents === null || cents === undefined
      ? "—"
      : new Intl.NumberFormat("en-US", {
          currency: "USD",
          style: "currency",
        }).format(cents / 100),
  formatPercent = (value: number) => `${value.toFixed(2)}%`;

function AdsManagerPage() {
  const { toast } = useToast(),
    campaignsQuery = useAdCampaignsQuery(),
    walletQuery = useAdWalletQuery(),
    createCampaign = useCreateAdCampaignMutation(),
    totals = useMemo(() => {
      const nextTotals = { clicks: 0, impressions: 0, spendCents: 0 };

      for (const campaign of campaignsQuery.data ?? []) {
        nextTotals.clicks += campaign.metrics.clicks;
        nextTotals.impressions += campaign.metrics.impressions;
        nextTotals.spendCents += campaign.metrics.spendCents;
      }

      return nextTotals;
    }, [campaignsQuery.data]),
    campaigns = campaignsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Megaphone className="size-4" />
            SoundKit Ads
          </div>
          <h1 className="mt-1 text-3xl font-bold">Ads</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Create audio and video pre-roll campaigns, target regions, and keep
            your house ads ready for unauthenticated playback.
          </p>
        </div>
        <WalletDialog
          balanceCents={walletQuery.data?.balanceCents ?? 0}
          currency={walletQuery.data?.currency ?? "USD"}
          isLoading={walletQuery.isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Radio}
          label="Impressions"
          value={totals.impressions.toLocaleString()}
        />
        <MetricCard
          icon={PlayCircle}
          label="Clicks"
          value={totals.clicks.toLocaleString()}
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Spend"
          value={money(totals.spendCents)}
        />
      </div>

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>
        <TabsContent value="builder" className="mt-6">
          <CampaignBuilder
            isPending={createCampaign.isPending}
            onCreate={(body) => {
              createCampaign.mutate(body, {
                onError: (error) => {
                  toast({
                    description: error.message,
                    title: "Campaign not saved",
                    variant: "destructive",
                  });
                },
                onSuccess: () => {
                  toast({
                    description:
                      "Campaign draft created. Billing activation will happen through the server-side Stripe flow.",
                    title: "Campaign saved",
                  });
                },
              });
            }}
          />
        </TabsContent>
        <TabsContent value="library" className="mt-6">
          <CampaignLibrary campaigns={campaigns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function WalletDialog({
  balanceCents,
  currency,
  isLoading,
}: {
  balanceCents: number;
  currency: string;
  isLoading: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit gap-2 rounded-full">
          <WalletCards className="size-4" />
          Wallet {isLoading ? "..." : money(balanceCents)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ad Wallet</DialogTitle>
          <DialogDescription>
            Track the prepaid balance available for SoundKit Ads campaigns.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Available balance</p>
            <p className="mt-1 text-3xl font-semibold">
              {isLoading ? "Loading..." : money(balanceCents)}
            </p>
            <p className="mt-1 text-xs uppercase text-muted-foreground">
              {currency}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Prepaid wallet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Draft campaigns can spend from this balance once billing is
                activated server-side.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Upfront campaigns</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the Billing dropdown in the builder when a campaign should
                be charged as an upfront placement.
              </p>
            </div>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Wallet top-ups are not exposed by the API yet. This panel keeps the
            balance visible while the campaign billing flow remains server-side.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CampaignBuilder({
  isPending,
  onCreate,
}: {
  isPending: boolean;
  onCreate: (body: CreateAdCampaignBody) => void;
}) {
  const [name, setName] = useState("SoundKit house pre-roll"),
    [creativeUrl, setCreativeUrl] = useState(""),
    [creativeImageUrl, setCreativeImageUrl] = useState(""),
    [clickthroughUrl, setClickthroughUrl] = useState(""),
    [creativeFormat, setCreativeFormat] = useState<AdCreativeFormat>("audio"),
    [placement, setPlacement] = useState<AdPlacement>("audio_preroll"),
    [billingType, setBillingType] = useState<AdBillingType>("prepaid_wallet"),
    [dailyBudgetCents, setDailyBudgetCents] = useState(500),
    [dailyImpressionCap, setDailyImpressionCap] = useState(1000),
    [mapScope, setMapScope] = useState<MapScope>("north-america"),
    [selectedTargets, setSelectedTargets] = useState<AdTarget[]>([
      { targetCode: "US-AR", targetType: "state" },
    ]),
    toggleTarget = (target: AdTarget) => {
      setSelectedTargets((current) => {
        const exists = current.some(
          (item) =>
            item.targetCode === target.targetCode &&
            item.targetType === target.targetType
        );

        if (exists) {
          return current.filter(
            (item) =>
              !(
                item.targetCode === target.targetCode &&
                item.targetType === target.targetType
              )
          );
        }

        return [...current, target];
      });
    },
    selectedTargetKeys = new Set(selectedTargets.map(targetKey)),
    selectedTargetRegionNames = selectedTargets.flatMap(targetRegionNames),
    availableTargets = targetOptions.filter(
      (target) => !selectedTargetKeys.has(targetKey(toAdTarget(target)))
    ),
    addTargetFromMap = (regionName: string) => {
      const option = targetOptionByRegion.get(regionName.toLowerCase());

      if (!option) {
        return;
      }

      toggleTarget(toAdTarget(option));
    },
    updateDailyBudget = (value: string) => {
      const dollars = Number(value);

      if (Number.isNaN(dollars)) {
        return;
      }

      const cents = Math.round(dollars * 100);
      setDailyBudgetCents(Math.max(100, cents));
    },
    updateDailyImpressionCap = (value: string) => {
      const impressions = Number(value);

      if (Number.isNaN(impressions)) {
        return;
      }

      setDailyImpressionCap(Math.max(100, Math.round(impressions)));
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapIcon className="size-5" />
          Campaign Builder
        </CardTitle>
        <CardDescription>
          Choose regions, creative assets, billing mode, and the daily cap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ad-name">Campaign name</Label>
                <Input
                  id="ad-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Billing</Label>
                <Select
                  value={billingType}
                  onValueChange={(value) =>
                    setBillingType(value as AdBillingType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid_wallet">
                      Prepaid wallet
                    </SelectItem>
                    <SelectItem value="upfront_recurring">
                      Upfront campaign
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Creative format</Label>
                <Select
                  value={creativeFormat}
                  onValueChange={(value) =>
                    setCreativeFormat(value as AdCreativeFormat)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="image">Image + audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Placement</Label>
                <Select
                  value={placement}
                  onValueChange={(value) => setPlacement(value as AdPlacement)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="audio_preroll">
                      Audio pre-roll
                    </SelectItem>
                    <SelectItem value="video_preroll">
                      Video pre-roll
                    </SelectItem>
                    <SelectItem value="video_overlay">Video overlay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="creative-url">Creative media URL</Label>
                <Input
                  id="creative-url"
                  value={creativeUrl}
                  onChange={(event) => setCreativeUrl(event.target.value)}
                  placeholder="https://media.example.com/ad.mp3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creative-image-url">Companion image URL</Label>
                <Input
                  id="creative-image-url"
                  value={creativeImageUrl}
                  onChange={(event) => setCreativeImageUrl(event.target.value)}
                  placeholder="https://media.example.com/ad-cover.jpg"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_320px]">
              <div className="space-y-2">
                <Label htmlFor="clickthrough-url">Clickthrough URL</Label>
                <Input
                  id="clickthrough-url"
                  value={clickthroughUrl}
                  onChange={(event) => setClickthroughUrl(event.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="daily-budget">Daily budget</Label>
                  <Input
                    id="daily-budget"
                    min={5}
                    type="number"
                    value={dailyBudgetCents / 100}
                    onChange={(event) => updateDailyBudget(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily-cap">Daily cap</Label>
                  <Input
                    id="daily-cap"
                    min={100}
                    type="number"
                    value={dailyImpressionCap}
                    onChange={(event) =>
                      updateDailyImpressionCap(event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CircleDollarSign className="size-4" />
              Campaign estimate
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Daily budget</p>
                <p className="font-semibold">{money(dailyBudgetCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Daily cap</p>
                <p className="font-semibold">
                  {dailyImpressionCap.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Regions</p>
                <p className="font-semibold">{selectedTargets.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Billing</p>
                <p className="font-semibold">
                  {billingType === "prepaid_wallet" ? "Wallet" : "Upfront"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Globe2 className="size-4" />
                Target regions
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Select multiple states or countries from the map, then refine
                with the dropdown.
              </p>
            </div>
            <div className="flex gap-2">
              <Select
                value=""
                onValueChange={(value) => {
                  const target = targetOptions.find(
                    (option) => targetKey(toAdTarget(option)) === value
                  );

                  if (target) {
                    toggleTarget(toAdTarget(target));
                  }
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Add region" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargets.map((target) => (
                    <SelectItem
                      key={targetKey(toAdTarget(target))}
                      value={targetKey(toAdTarget(target))}
                    >
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <WorldAndUSAMap
            mapScope={mapScope}
            onRegionSelect={addTargetFromMap}
            onScopeChange={setMapScope}
            selectedRegion={null}
            selectedRegions={selectedTargetRegionNames}
          />
          <div className="flex flex-wrap gap-2">
            {selectedTargets.map((target) => (
              <Badge
                key={targetKey(target)}
                variant="secondary"
                className="gap-2 py-1.5"
              >
                <Check className="size-3" />
                {targetLabel(target)}
                <button
                  type="button"
                  className="rounded-full text-muted-foreground transition hover:text-foreground"
                  onClick={() => toggleTarget(target)}
                  aria-label={`Remove ${targetLabel(target)}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
            {selectedTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Choose at least one target region.
              </p>
            ) : null}
          </div>
        </div>

        <Button
          disabled={
            isPending ||
            !(name && creativeUrl && clickthroughUrl && selectedTargets.length)
          }
          onClick={() =>
            onCreate({
              billingType,
              clickthroughUrl,
              creativeFormat,
              creativeImageUrl: creativeImageUrl || undefined,
              creativeUrl,
              dailyBudgetCents,
              dailyImpressionCap,
              name,
              placement,
              targets: selectedTargets,
            })
          }
        >
          <Plus className="size-4" />
          Save Campaign Draft
        </Button>
      </CardContent>
    </Card>
  );
}

function CampaignLibrary({
  campaigns,
}: {
  campaigns: ReturnType<typeof useAdCampaignsQuery>["data"] | undefined;
}) {
  const rows = campaigns ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creative Library</CardTitle>
        <CardDescription>
          Drafts stay inactive until the server-side billing activation flow
          approves them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Regions</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>CPM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No ad campaigns yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    {campaign.placement.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{campaign.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {campaign.targets
                      .map((target) => target.targetCode)
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    {formatPercent(campaign.metrics.ctrPercent)}
                  </TableCell>
                  <TableCell>{money(campaign.metrics.cpmCents)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
