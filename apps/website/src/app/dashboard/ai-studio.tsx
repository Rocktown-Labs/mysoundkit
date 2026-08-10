import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/ai-studio")({
  component: DashboardAdsRoute,
});

function DashboardAdsRoute() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="size-6 text-primary" />
            SoundKit Ads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Build audio and video pre-roll campaigns, target regions, and manage
            your creative library.
          </p>
          <Button asChild className="gap-2 font-bold">
            <Link to="/dashboard/career/ai-studio">
              Open Ads <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
