/* eslint-disable one-var, sort-vars */
import { createFileRoute } from "@tanstack/react-router";
import { BadgeDollarSign, MessageCircleHeart, Settings2 } from "lucide-react";
import { useState } from "react";

import { CommunityExperience } from "@/components/community/community-experience";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { useImmersiveDashboardSidebar } from "@/hooks/use-immersive-dashboard-sidebar";
import { toast } from "@/hooks/use-toast";
import type { DbCommunity } from "@/lib/data-db";
import { useDbCommunities, useDbCommunityActions } from "@/lib/data-db";
import { useGenresQuery, useMeQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/community")({
  component: CommunityDashboard,
  ssr: false,
});

function CommunityDashboard() {
  const meQuery = useMeQuery(),
    { data: communities, isLoading } = useDbCommunities(),
    ownedCommunity = communities.find(
      (community) => community.artistUserId === meQuery.data?.user.id
    );

  useImmersiveDashboardSidebar();

  if (isLoading || meQuery.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Loading your community…
      </div>
    );
  }

  if (!ownedCommunity) {
    return (
      <div className="h-full w-full overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="flex items-center gap-2 font-bold text-3xl">
              <MessageCircleHeart className="size-7 text-primary" />
              Create your community
            </h1>
            <p className="mt-2 text-muted-foreground">
              Every SoundKit artist can start free. Enable paid membership when
              Premium and payouts are ready.
            </p>
          </div>
          <CommunityEditor />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <CommunityExperience
        communityId={ownedCommunity.id}
        creatorMode
        ownerActions={<CommunitySettings community={ownedCommunity} />}
      />
    </div>
  );
}

function CommunityEditor() {
  const genresQuery = useGenresQuery(),
    { create } = useDbCommunityActions(),
    [access, setAccess] = useState<"free" | "paid">("free"),
    [description, setDescription] = useState(""),
    [genreId, setGenreId] = useState<string>("none"),
    [isSaving, setIsSaving] = useState(false),
    [name, setName] = useState(""),
    [price, setPrice] = useState("4.99"),
    submit = async () => {
      if (!name.trim()) {
        return;
      }
      setIsSaving(true);
      try {
        await create({
          description: description.trim() || undefined,
          genreId: genreId === "none" ? null : genreId,
          monthlyPriceCents:
            access === "free" ? 0 : Math.round(Number(price) * 100),
          name: name.trim(),
        });
      } catch (error) {
        setIsSaving(false);
        toast({
          description:
            error instanceof Error
              ? error.message
              : "The community could not be created.",
          title: "Community unavailable",
          variant: "destructive",
        });
        return;
      }
      setIsSaving(false);
      toast({
        description: "Your creator space is ready for its first members.",
        title: "Community created",
      });
    };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Community details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="community-name">Name</Label>
          <Input
            id="community-name"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder="The Midnight Room"
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="community-description">Description</Label>
          <Textarea
            id="community-description"
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should members expect here?"
            value={description}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Primary genre</Label>
            <Select onValueChange={setGenreId} value={genreId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All genres</SelectItem>
                {(genresQuery.data ?? []).map((genre) => (
                  <SelectItem key={genre.id} value={genre.id}>
                    {genre.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Membership</Label>
            <Select
              onValueChange={(value: "free" | "paid") => setAccess(value)}
              value={access}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free for members</SelectItem>
                <SelectItem value="paid">Paid monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {access === "paid" ? (
          <div className="space-y-2">
            <Label htmlFor="community-price">
              Monthly price ($2.99–$99.99)
            </Label>
            <Input
              id="community-price"
              max="99.99"
              min="2.99"
              onChange={(event) => setPrice(event.target.value)}
              step="0.01"
              type="number"
              value={price}
            />
            <p className="text-muted-foreground text-xs">
              Paid communities require Premium and an enabled Stripe payout
              account. SoundKit retains the existing platform fee.
            </p>
          </div>
        ) : null}
        <Button disabled={isSaving || !name.trim()} onClick={submit}>
          {isSaving ? "Creating…" : "Create Community"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CommunitySettings({ community }: { community: DbCommunity }) {
  const { update } = useDbCommunityActions(),
    genresQuery = useGenresQuery(),
    [access, setAccess] = useState<"free" | "paid">(
      community.monthlyPriceCents > 0 ? "paid" : "free"
    ),
    [description, setDescription] = useState(community.description ?? ""),
    [genreId, setGenreId] = useState<string>(community.genre?.id ?? "none"),
    [name, setName] = useState(community.name),
    [open, setOpen] = useState(false),
    [price, setPrice] = useState(
      `${Math.max(299, community.monthlyPriceCents || 499) / 100}`
    ),
    saveSettings = async () => {
      if (!name.trim()) {
        toast({
          description: "Community name is required.",
          title: "Name required",
          variant: "destructive",
        });
        return;
      }
      const transaction = update({
        communityId: community.id,
        description: description.trim(),
        genreId: genreId === "none" ? null : genreId,
        monthlyPriceCents:
          access === "free" ? 0 : Math.round(Number(price) * 100),
        name: name.trim(),
      });
      try {
        await transaction.isPersisted.promise;
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Update failed.",
          title: "Community was not updated",
          variant: "destructive",
        });
        return;
      }
      setOpen(false);
      toast({ title: "Community updated" });
    };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <Settings2 data-icon="inline-start" /> Community settings
      </Button>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Community settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="community-settings-name">Name</Label>
            <Input
              id="community-settings-name"
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="community-settings-description">Description</Label>
            <Textarea
              id="community-settings-description"
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should members expect here?"
              value={description}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Primary genre</Label>
              <Select onValueChange={setGenreId} value={genreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All genres</SelectItem>
                  {(genresQuery.data ?? []).map((genre) => (
                    <SelectItem key={genre.id} value={genre.id}>
                      {genre.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Membership access</Label>
              <Select
                onValueChange={(value: "free" | "paid") => setAccess(value)}
                value={access}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {access === "paid" ? (
            <div className="space-y-2">
              <Label htmlFor="community-settings-price">
                Monthly price ($2.99–$99.99)
              </Label>
              <Input
                id="community-settings-price"
                max="99.99"
                min="2.99"
                onChange={(event) => setPrice(event.target.value)}
                step="0.01"
                type="number"
                value={price}
              />
              <p className="text-muted-foreground text-xs">
                Paid communities require Premium and an enabled Stripe payout
                account.
              </p>
            </div>
          ) : null}
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <BadgeDollarSign className="size-3.5 text-primary" />
            Changes are visible to members immediately.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button onClick={() => setOpen(false)} variant="outline">
            Cancel
          </Button>
          <Button onClick={saveSettings}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
