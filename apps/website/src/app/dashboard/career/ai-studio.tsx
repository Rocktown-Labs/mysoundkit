"use client";

import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  CircleDollarSign,
  Globe2,
  Map,
  Megaphone,
  PlayCircle,
  Plus,
  Radio,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  type AdBillingType,
  type AdCreativeFormat,
  type AdPlacement,
  type AdTarget,
  type CreateAdCampaignBody,
  useAdCampaignsQuery,
  useAdWalletQuery,
  useCreateAdCampaignMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/ai-studio")({
  component: AdsManagerPage,
});

const targetOptions = [
  { code: "US-AR", label: "Arkansas", type: "state" },
  { code: "US-CA", label: "California", type: "state" },
  { code: "US-GA", label: "Georgia", type: "state" },
  { code: "US-NY", label: "New York", type: "state" },
  { code: "US-TX", label: "Texas", type: "state" },
  { code: "CA", label: "Canada", type: "country" },
  { code: "MX", label: "Mexico", type: "country" },
  { code: "GB", label: "United Kingdom", type: "country" },
] as const;

const money = (cents: number | null | undefined) =>
  cents === null || cents === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        currency: "USD",
        style: "currency",
      }).format(cents / 100);

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

function AdsManagerPage() {
  const { toast } = useToast();
  const campaignsQuery = useAdCampaignsQuery();
  const walletQuery = useAdWalletQuery();
  const createCampaign = useCreateAdCampaignMutation();
  const campaigns = campaignsQuery.data ?? [];
  const totals = useMemo(
    () =>
      campaigns.reduce(
        (acc, campaign) => ({
          clicks: acc.clicks + campaign.metrics.clicks,
          impressions: acc.impressions + campaign.metrics.impressions,
          spendCents: acc.spendCents + campaign.metrics.spendCents,
        }),
        { clicks: 0, impressions: 0, spendCents: 0 }
      ),
    [campaigns]
  );

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
        <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
          <WalletCards className="size-4" />
          Wallet {money(walletQuery.data?.balanceCents ?? 0)}
        </Badge>
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
  icon: typeof BarChart3;
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

function CampaignBuilder({
  isPending,
  onCreate,
}: {
  isPending: boolean;
  onCreate: (body: CreateAdCampaignBody) => void;
}) {
  const [name, setName] = useState("SoundKit house pre-roll");
  const [creativeUrl, setCreativeUrl] = useState("");
  const [creativeImageUrl, setCreativeImageUrl] = useState("");
  const [clickthroughUrl, setClickthroughUrl] = useState("");
  const [creativeFormat, setCreativeFormat] =
    useState<AdCreativeFormat>("audio");
  const [placement, setPlacement] = useState<AdPlacement>("audio_preroll");
  const [billingType, setBillingType] =
    useState<AdBillingType>("prepaid_wallet");
  const [dailyBudgetCents, setDailyBudgetCents] = useState(500);
  const [dailyImpressionCap, setDailyImpressionCap] = useState(1000);
  const [selectedTargets, setSelectedTargets] = useState<AdTarget[]>([
    { targetCode: "US-AR", targetType: "state" },
  ]);

  const toggleTarget = (target: AdTarget) => {
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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="size-5" />
          Campaign Builder
        </CardTitle>
        <CardDescription>
          Choose regions, creative assets, billing mode, and the daily cap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
              onValueChange={(value) => setBillingType(value as AdBillingType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prepaid_wallet">Prepaid wallet</SelectItem>
                <SelectItem value="upfront_recurring">
                  Upfront campaign
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                <SelectItem value="audio_preroll">Audio pre-roll</SelectItem>
                <SelectItem value="video_preroll">Video pre-roll</SelectItem>
                <SelectItem value="video_overlay">Video overlay</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                onChange={(event) =>
                  setDailyBudgetCents(
                    Math.max(100, Math.round(Number(event.target.value) * 100))
                  )
                }
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
                  setDailyImpressionCap(
                    Math.max(100, Math.round(Number(event.target.value)))
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Globe2 className="size-4" />
            Target regions
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {targetOptions.map((target) => {
              const checked = selectedTargets.some(
                (item) =>
                  item.targetCode === target.code &&
                  item.targetType === target.type
              );

              return (
                <label
                  key={target.code}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      toggleTarget({
                        targetCode: target.code,
                        targetType: target.type,
                      })
                    }
                  />
                  <span>{target.label}</span>
                </label>
              );
            })}
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
