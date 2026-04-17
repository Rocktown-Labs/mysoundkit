import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="px-4 py-8 md:px-6 lg:px-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">Upgrade to Premium</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Premium unlocks live battle viewing, creator streams, and advanced
            fan experiences.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/signup">Create Account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/live">Back to Live</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
