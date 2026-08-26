/* eslint-disable one-var, sort-vars */
import { createFileRoute } from "@tanstack/react-router";
import { BadgeDollarSign, MessageCircleHeart, Settings2 } from "lucide-react";
import { useState } from "react";

import { CommunityExperience } from "@/components/community/community-experience";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (isLoading || meQuery.isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading your community…
      </div>
    );
  }

  if (!ownedCommunity) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl">Your Community</h1>
          <p className="mt-1 text-muted-foreground">
            Share updates, chat with members, and keep moderation controls close
            without putting them in everyone’s way.
          </p>
        </div>
        <CommunitySettings community={ownedCommunity} />
      </div>
      <CommunityExperience communityId={ownedCommunity.id} creatorMode />
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
    [access, setAccess] = useState<"free" | "paid">(
      community.monthlyPriceCents > 0 ? "paid" : "free"
    ),
    [open, setOpen] = useState(false),
    [price, setPrice] = useState(
      `${Math.max(299, community.monthlyPriceCents || 499) / 100}`
    ),
    saveSettings = async () => {
      const transaction = update({
        communityId: community.id,
        monthlyPriceCents:
          access === "free" ? 0 : Math.round(Number(price) * 100),
      });
      try {
        await transaction.isPersisted.promise;
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Update failed.",
          title: "Membership was not updated",
          variant: "destructive",
        });
        return;
      }
      setOpen(false);
      toast({ title: "Community membership updated" });
    };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline">
        <Settings2 data-icon="inline-start" /> Membership settings
      </Button>
    );
  }

  return (
    <Card className="w-full sm:max-w-md">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 font-medium text-sm">
          <BadgeDollarSign className="size-4 text-primary" />
          Membership access
        </div>
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
        {access === "paid" ? (
          <Input
            aria-label="Monthly community price"
            max="99.99"
            min="2.99"
            onChange={(event) => setPrice(event.target.value)}
            step="0.01"
            type="number"
            value={price}
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} size="sm" variant="ghost">
            Cancel
          </Button>
          <Button onClick={saveSettings} size="sm">
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
