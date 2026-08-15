import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_V1_URL } from "@/lib/api";

export const Route = createFileRoute("/dashboard/community")({
  component: CommunityDashboard,
});

function CommunityDashboard() {
  const [description, setDescription] = useState(""),
   [message, setMessage] = useState<string | null>(null),
   [name, setName] = useState(""),
   [price, setPrice] = useState("4.99"),

   createCommunity = async () => {
    const response = await fetch(`${API_V1_URL}/communities`, {
      body: JSON.stringify({
        description,
        monthlyPriceCents: Math.round(Number(price) * 100),
        name,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
     payload = (await response.json()) as {
      message?: string;
      name?: string;
    };
    setMessage(
      response.ok
        ? `${payload.name ?? name} is ready.`
        : (payload.message ?? "Unable to create community.")
    );
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Paid Community</CardTitle>
          <p className="text-sm text-muted-foreground">
            Artist Premium artists with an enabled payout account can create one
            private community. SoundKit retains 10%.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="community-name">Name</Label>
            <Input
              id="community-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="community-description">Description</Label>
            <Input
              id="community-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="community-price">
              Monthly price ($2.99-$99.99)
            </Label>
            <Input
              id="community-price"
              min="2.99"
              max="99.99"
              step="0.01"
              type="number"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
          {message ? <p className="text-sm">{message}</p> : null}
          <Button onClick={() => void createCommunity()}>
            Create Community
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
