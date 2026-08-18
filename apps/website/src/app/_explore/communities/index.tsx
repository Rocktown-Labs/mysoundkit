import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_V1_URL } from "@/lib/api";

export const Route = createFileRoute("/_explore/communities/")({
  component: CommunitiesPage,
});

interface Community {
  artistUserId: string;
  description: string | null;
  id: string;
  monthlyPriceCents: number;
  name: string;
  slug: string;
}

function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]),
    [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadCommunities = async () => {
      try {
        const response = await fetch(`${API_V1_URL}/communities`, {
          credentials: "include",
        });
        setCommunities((await response.json()) as Community[]);
      } catch {
        setCommunities([]);
      }
    };

    void loadCommunities();
  }, []);

  const joinCommunity = async (communityId: string) => {
    const response = await fetch(`${API_V1_URL}/community-billing/checkout`, {
        body: JSON.stringify({
          cancelUrl: window.location.href,
          communityId,
          successUrl: window.location.href,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      payload = (await response.json()) as {
        checkoutUrl?: string | null;
        message?: string;
      };

    if (payload.checkoutUrl) {
      window.location.assign(payload.checkoutUrl);
      return;
    }

    setMessage(payload.message ?? "Community checkout is not available.");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-black">Artist Communities</h1>
      <p className="mt-3 text-muted-foreground">
        Join private artist spaces with member-only posts and group chat.
      </p>
      {message ? (
        <p className="mt-4 text-sm text-destructive">{message}</p>
      ) : null}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {communities.map((community) => (
          <Card key={community.id}>
            <CardHeader>
              <CardTitle>{community.name}</CardTitle>
              <p className="font-bold">
                ${(community.monthlyPriceCents / 100).toFixed(2)}/month
              </p>
            </CardHeader>
            <CardContent>
              <p className="mb-5 text-sm text-muted-foreground">
                {community.description ??
                  "A private space for this artist's fans."}
              </p>
              <Button
                className="w-full"
                onClick={() => void joinCommunity(community.id)}
              >
                Join Community
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
